import re
from datetime import timedelta
from io import StringIO
from unittest.mock import patch

from django.contrib.auth.tokens import default_token_generator
from django.core import mail
from django.core.cache import cache
from django.core.management import call_command
from django.test import TestCase, override_settings
from django.utils import timezone
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.test import APIClient
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.auth_views import ThrottledTokenObtainPairView, ThrottledTokenRefreshView
from apps.accounts.models import SocialIdentity, User
from apps.accounts.social_auth import SocialUserClaims
from apps.businesses.models import Business, BusinessMember, BusinessRole
from apps.crm.models import Pipeline
from apps.core.models import AuditLog, LoginHistory
from apps.scheduling.models import Appointment


class AuthSecurityBaselineTests(TestCase):
    def setUp(self):
        cache.clear()
        self.api = APIClient()
        self.user = User.objects.create_user(
            username="auth-user",
            email="auth-user@example.com",
            password="StrongPass123",
            role=User.Roles.BUSINESS_OWNER,
        )

    def tearDown(self):
        cache.clear()

    def login(self, client=None, *, password="StrongPass123"):
        client = client or self.api
        return client.post(
            "/api/auth/token/",
            {"email": self.user.email, "password": password},
            format="json",
        )

    def refresh_with(self, raw_token):
        client = APIClient()
        client.cookies["zani_refresh"] = raw_token
        return client.post("/api/auth/token/refresh/", {}, format="json")

    def test_auth_views_have_scoped_throttles(self):
        self.assertEqual(ThrottledTokenObtainPairView.throttle_scope, "auth_login")
        self.assertEqual(ThrottledTokenRefreshView.throttle_scope, "auth_refresh")

    def test_login_and_rotating_refresh_flow_works(self):
        login_response = self.login()

        self.assertEqual(login_response.status_code, 200)
        self.assertIn("access", login_response.data)
        self.assertNotIn("refresh", login_response.data)
        self.assertIn("zani_refresh", login_response.cookies)
        self.assertTrue(login_response.cookies["zani_refresh"]["httponly"])

        old_refresh = login_response.cookies["zani_refresh"].value
        login_event = LoginHistory.objects.filter(user=self.user).latest("created_at")
        self.assertEqual(login_event.metadata, {"event": "login", "outcome": LoginHistory.Statuses.SUCCESS})
        self.assertNotIn("StrongPass123", str(login_event.metadata))
        self.assertNotIn(old_refresh, str(login_event.metadata))
        refresh_response = self.api.post("/api/auth/token/refresh/", {}, format="json")

        self.assertEqual(refresh_response.status_code, 200)
        self.assertIn("access", refresh_response.data)
        self.assertNotIn("refresh", refresh_response.data)
        self.assertIn("zani_refresh", refresh_response.cookies)
        self.assertNotEqual(refresh_response.cookies["zani_refresh"].value, old_refresh)

        reused_refresh_response = self.refresh_with(old_refresh)

        self.assertEqual(reused_refresh_response.status_code, 401)
        self.assertEqual(reused_refresh_response.data["detail"], "Session expired or invalid.")
        self.assertNotIn(old_refresh, str(reused_refresh_response.data))
        self.assertEqual(reused_refresh_response.cookies["zani_refresh"]["max-age"], 0)

    def test_refresh_cookie_restores_session_and_logout_revokes_it(self):
        login_response = self.login()
        self.assertEqual(login_response.status_code, 200)
        raw_refresh = login_response.cookies["zani_refresh"].value
        refresh_jti = RefreshToken(raw_refresh)["jti"]

        refresh_response = self.api.post("/api/auth/token/refresh/", {}, format="json")

        self.assertEqual(refresh_response.status_code, 200)
        self.assertIn("access", refresh_response.data)
        self.assertNotIn("refresh", refresh_response.data)
        self.assertIn("zani_refresh", refresh_response.cookies)
        active_refresh = refresh_response.cookies["zani_refresh"].value
        active_jti = RefreshToken(active_refresh)["jti"]

        logout_response = self.api.post("/api/auth/logout/", {}, format="json")

        self.assertEqual(logout_response.status_code, 200)
        self.assertEqual(logout_response.cookies["zani_refresh"]["max-age"], 0)
        self.assertTrue(BlacklistedToken.objects.filter(token__jti=refresh_jti).exists())
        self.assertTrue(BlacklistedToken.objects.filter(token__jti=active_jti).exists())
        self.assertEqual(self.refresh_with(active_refresh).status_code, 401)
        event = AuditLog.objects.get(actor=self.user, metadata__event="logout")
        self.assertEqual(event.category, AuditLog.Categories.SECURITY)
        self.assertNotIn(active_refresh, str(event.metadata))

    def test_logout_is_idempotent_for_invalid_or_already_revoked_tokens(self):
        self.api.cookies["zani_refresh"] = "not-a-token"
        invalid_response = self.api.post("/api/auth/logout/", {}, format="json")
        self.assertEqual(invalid_response.status_code, 200)
        self.assertEqual(invalid_response.cookies["zani_refresh"]["max-age"], 0)

        login_response = self.login()
        raw_refresh = login_response.cookies["zani_refresh"].value
        self.assertEqual(self.api.post("/api/auth/logout/", {}, format="json").status_code, 200)
        self.api.cookies["zani_refresh"] = raw_refresh
        repeated_response = self.api.post("/api/auth/logout/", {}, format="json")
        self.assertEqual(repeated_response.status_code, 200)
        self.assertEqual(repeated_response.cookies["zani_refresh"]["max-age"], 0)

    def test_refresh_rejects_missing_malformed_and_expired_credentials_safely(self):
        missing_response = APIClient().post("/api/auth/token/refresh/", {}, format="json")
        self.assertEqual(missing_response.status_code, 400)
        self.assertEqual(missing_response.data["code"], "validation_error")
        self.assertIn("refresh", missing_response.data["errors"])

        expired = RefreshToken.for_user(self.user)
        expired.set_exp(lifetime=timedelta(seconds=-1))
        for raw_token in ("not-a-token", str(expired)):
            with self.subTest(raw_token=raw_token[:12]):
                response = self.refresh_with(raw_token)
                self.assertEqual(response.status_code, 401)
                self.assertEqual(response.data["detail"], "Session expired or invalid.")
                self.assertNotIn(raw_token, str(response.data))
                self.assertEqual(response.cookies["zani_refresh"]["max-age"], 0)

    def test_refresh_endpoint_is_throttled(self):
        previous_rates = ScopedRateThrottle.THROTTLE_RATES
        ScopedRateThrottle.THROTTLE_RATES = {**previous_rates, "auth_refresh": "1/min"}
        cache.clear()
        try:
            self.assertEqual(self.login().status_code, 200)
            self.assertEqual(self.api.post("/api/auth/token/refresh/", {}, format="json").status_code, 200)
            throttled_response = self.api.post("/api/auth/token/refresh/", {}, format="json")
            self.assertEqual(throttled_response.status_code, 429)
            self.assertEqual(throttled_response.data["code"], "rate_limited")
        finally:
            ScopedRateThrottle.THROTTLE_RATES = previous_rates
            cache.clear()

    @override_settings(
        AUTH_REFRESH_COOKIE_PATH="/api/auth/",
        AUTH_REFRESH_COOKIE_SECURE=False,
        AUTH_REFRESH_COOKIE_SAMESITE="Lax",
    )
    def test_refresh_cookie_has_safe_local_attributes(self):
        cookie = self.login().cookies["zani_refresh"]
        self.assertTrue(cookie["httponly"])
        self.assertFalse(cookie["secure"])
        self.assertEqual(cookie["samesite"], "Lax")
        self.assertEqual(cookie["path"], "/api/auth/")

    @override_settings(
        AUTH_REFRESH_COOKIE_PATH="/api/auth/",
        AUTH_REFRESH_COOKIE_SECURE=True,
        AUTH_REFRESH_COOKIE_SAMESITE="Strict",
    )
    def test_refresh_cookie_has_safe_production_like_attributes(self):
        cookie = self.login().cookies["zani_refresh"]
        self.assertTrue(cookie["httponly"])
        self.assertTrue(cookie["secure"])
        self.assertEqual(cookie["samesite"], "Strict")
        self.assertEqual(cookie["path"], "/api/auth/")

    def test_login_endpoint_is_throttled(self):
        previous_rates = ScopedRateThrottle.THROTTLE_RATES
        ScopedRateThrottle.THROTTLE_RATES = {**previous_rates, "auth_login": "10/min"}
        cache.clear()
        try:
            for _ in range(10):
                response = self.api.post(
                    "/api/auth/token/",
                    {"email": self.user.email, "password": "wrong"},
                    format="json",
                )
                self.assertEqual(response.status_code, 401)

            throttled_response = self.api.post(
                "/api/auth/token/",
                {"email": self.user.email, "password": "wrong"},
                format="json",
            )

            self.assertEqual(throttled_response.status_code, 429)
        finally:
            ScopedRateThrottle.THROTTLE_RATES = previous_rates
            cache.clear()

    def test_login_endpoint_respects_stricter_throttle_rate(self):
        previous_rates = ScopedRateThrottle.THROTTLE_RATES
        ScopedRateThrottle.THROTTLE_RATES = {**previous_rates, "auth_login": "1/min"}
        cache.clear()
        try:
            response = self.api.post(
                "/api/auth/token/",
                {"email": self.user.email, "password": "wrong"},
                format="json",
            )
            self.assertEqual(response.status_code, 401)

            throttled_response = self.api.post(
                "/api/auth/token/",
                {"email": self.user.email, "password": "wrong"},
                format="json",
            )

            self.assertEqual(throttled_response.status_code, 429)
        finally:
            ScopedRateThrottle.THROTTLE_RATES = previous_rates
            cache.clear()

    @patch("apps.accounts.views.verify_social_id_token")
    def test_social_login_creates_merchant_user_and_business(self, verify_token):
        verify_token.return_value = SocialUserClaims(
            provider=SocialIdentity.Providers.GOOGLE,
            subject="google-user-1",
            email="social-owner@example.com",
            email_verified=True,
            full_name="Social Owner",
            claims={"sub": "google-user-1", "email": "social-owner@example.com"},
        )

        response = self.api.post(
            "/api/auth/social/",
            {"provider": "google", "id_token": "mock-id-token"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn("access", response.data)
        self.assertNotIn("refresh", response.data)
        self.assertIn("zani_refresh", response.cookies)
        self.assertTrue(response.data["created"])
        user = User.objects.get(email="social-owner@example.com")
        self.assertEqual(user.role, User.Roles.BUSINESS_OWNER)
        self.assertFalse(user.has_usable_password())
        self.assertTrue(SocialIdentity.objects.filter(user=user, provider=SocialIdentity.Providers.GOOGLE).exists())
        self.assertTrue(BusinessMember.objects.filter(user=user, role=BusinessMember.Roles.OWNER, is_active=True).exists())
        business = Business.objects.get(owner=user)
        self.assertTrue(BusinessRole.objects.filter(business=business, preset_key=BusinessMember.Roles.OWNER, is_active=True).exists())
        self.assertTrue(Pipeline.objects.filter(business=business).exists())
        self.assertTrue(LoginHistory.objects.filter(user=user, status=LoginHistory.Statuses.SUCCESS).exists())

    @patch("apps.accounts.views.verify_social_id_token")
    def test_social_login_links_existing_user_by_email(self, verify_token):
        verify_token.return_value = SocialUserClaims(
            provider=SocialIdentity.Providers.APPLE,
            subject="apple-user-1",
            email=self.user.email,
            email_verified=True,
            full_name="",
            claims={"sub": "apple-user-1", "email": self.user.email},
        )

        response = self.api.post(
            "/api/auth/social/",
            {"provider": "apple", "id_token": "mock-id-token"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data["created"])
        self.assertEqual(User.objects.filter(email=self.user.email).count(), 1)
        self.assertTrue(SocialIdentity.objects.filter(user=self.user, provider=SocialIdentity.Providers.APPLE).exists())

    def test_owner_signup_creates_user_business_and_membership(self):
        response = self.api.post(
            "/api/auth/signup/owner/",
            {
                "email": "new-owner@example.com",
                "password": "StrongPass123",
                "full_name": "New Owner",
                "phone": "+77015550101",
                "business_name": "Fresh Salon",
                "business_type": "beauty",
                "city": "Almaty",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertIn("access", response.data)
        self.assertNotIn("refresh", response.data)
        self.assertIn("zani_refresh", response.cookies)
        user = User.objects.get(email="new-owner@example.com")
        business = Business.objects.get(owner=user)
        self.assertEqual(user.role, User.Roles.BUSINESS_OWNER)
        self.assertEqual(business.name, "Fresh Salon")
        self.assertTrue(BusinessMember.objects.filter(business=business, user=user, role=BusinessMember.Roles.OWNER, is_active=True).exists())

    def test_owner_signup_applies_django_password_policy(self):
        response = self.api.post(
            "/api/auth/signup/owner/",
            {
                "email": "weak-owner@example.com",
                "password": "password",
                "business_name": "Weak Password Business",
                "business_type": "other",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("password", response.data["errors"])
        self.assertFalse(User.objects.filter(email="weak-owner@example.com").exists())

    def test_current_user_can_update_personal_profile(self):
        self.api.force_authenticate(self.user)

        response = self.api.patch(
            "/api/auth/me/",
            {
                "full_name": "Updated User",
                "phone": "+77015550999",
                "role": User.Roles.PLATFORM_ADMIN,
                "preferences": {"language": "en", "timezone": "Europe/London", "start_page": "conversations"},
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.assertEqual(self.user.full_name, "Updated User")
        self.assertEqual(self.user.phone, "+77015550999")
        self.assertEqual(self.user.role, User.Roles.BUSINESS_OWNER)
        self.assertEqual(response.data["preferences"]["language"], "en")
        self.assertEqual(response.data["preferences"]["timezone"], "Europe/London")
        self.assertEqual(response.data["preferences"]["start_page"], "conversations")

    def test_current_user_can_change_password(self):
        self.api.force_authenticate(self.user)

        response = self.api.post(
            "/api/auth/change-password/",
            {"current_password": "StrongPass123", "new_password": "NewStrongPass123"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn("zani_refresh", response.cookies)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("NewStrongPass123"))

    def test_change_password_revokes_old_sessions_and_reissues_current_cookie(self):
        current_client = APIClient()
        other_client = APIClient()
        current_login = self.login(current_client)
        other_login = self.login(other_client)
        current_refresh = current_login.cookies["zani_refresh"].value
        other_refresh = other_login.cookies["zani_refresh"].value
        current_client.credentials(HTTP_AUTHORIZATION=f"Bearer {current_login.data['access']}")

        response = current_client.post(
            "/api/auth/change-password/",
            {"current_password": "StrongPass123", "new_password": "NewStrongPass123"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn("zani_refresh", response.cookies)
        replacement_refresh = response.cookies["zani_refresh"].value
        self.assertNotEqual(replacement_refresh, current_refresh)
        self.assertEqual(self.refresh_with(current_refresh).status_code, 401)
        self.assertEqual(self.refresh_with(other_refresh).status_code, 401)
        self.assertEqual(self.refresh_with(replacement_refresh).status_code, 200)
        event = AuditLog.objects.get(actor=self.user, metadata__event="password_changed")
        self.assertGreaterEqual(event.metadata["sessions_revoked"], 2)
        self.assertNotIn(current_refresh, str(event.metadata))
        self.assertNotIn(other_refresh, str(event.metadata))

    def test_change_password_applies_django_password_policy(self):
        self.api.force_authenticate(self.user)

        response = self.api.post(
            "/api/auth/change-password/",
            {"current_password": "StrongPass123", "new_password": "password"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("new_password", response.data["errors"])
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("StrongPass123"))

    def test_change_password_rejects_wrong_current_password(self):
        self.api.force_authenticate(self.user)

        response = self.api.post(
            "/api/auth/change-password/",
            {"current_password": "wrong-password", "new_password": "NewStrongPass123"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("StrongPass123"))

    def test_current_user_login_history_returns_only_own_entries(self):
        other_user = User.objects.create_user(
            username="other-user",
            email="other-user@example.com",
            password="StrongPass123",
            role=User.Roles.BUSINESS_OPERATOR,
        )
        LoginHistory.objects.create(user=self.user, email=self.user.email, status=LoginHistory.Statuses.SUCCESS)
        LoginHistory.objects.create(user=other_user, email=other_user.email, status=LoginHistory.Statuses.SUCCESS)
        self.api.force_authenticate(self.user)

        response = self.api.get("/api/auth/login-history/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["email"], self.user.email)

    def test_password_reset_request_and_confirm_flow(self):
        request_response = self.api.post(
            "/api/auth/password-reset/request/",
            {"email": self.user.email, "delivery_channel": "email"},
            format="json",
        )

        self.assertEqual(request_response.status_code, 200)
        self.assertTrue(request_response.data["ok"])
        self.assertNotIn("uid", request_response.data)
        self.assertNotIn("token", request_response.data)
        self.assertNotIn("reset_path", request_response.data)
        self.assertEqual(len(mail.outbox), 1)
        reset_request_event = AuditLog.objects.get(actor=self.user, metadata__event="password_reset_requested")
        self.assertEqual(
            set(reset_request_event.metadata),
            {"category", "risk_level", "event", "sessions_revoked"},
        )
        match = re.search(r"/reset-password/(?P<uid>[^/]+)/(?P<token>[^\s/]+)", mail.outbox[0].body)
        self.assertIsNotNone(match)

        confirm_response = self.api.post(
            "/api/auth/password-reset/confirm/",
            {
                "uid": match.group("uid"),
                "token": match.group("token"),
                "password": "NewStrongPass123",
            },
            format="json",
        )

        self.assertEqual(confirm_response.status_code, 200)
        self.assertEqual(confirm_response.cookies["zani_refresh"]["max-age"], 0)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("NewStrongPass123"))

    def test_password_reset_revokes_all_existing_refresh_sessions(self):
        first_refresh = self.login(APIClient()).cookies["zani_refresh"].value
        second_refresh = self.login(APIClient()).cookies["zani_refresh"].value
        self.user.refresh_from_db()
        uid = urlsafe_base64_encode(force_bytes(self.user.pk))
        token = default_token_generator.make_token(self.user)
        reset_client = APIClient()
        reset_client.cookies["zani_refresh"] = first_refresh

        response = reset_client.post(
            "/api/auth/password-reset/confirm/",
            {"uid": uid, "token": token, "password": "NewStrongPass123"},
            format="json",
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.cookies["zani_refresh"]["max-age"], 0)
        self.assertEqual(self.refresh_with(first_refresh).status_code, 401)
        self.assertEqual(self.refresh_with(second_refresh).status_code, 401)
        event = AuditLog.objects.get(actor=self.user, metadata__event="password_reset_confirmed")
        self.assertGreaterEqual(event.metadata["sessions_revoked"], 2)
        self.assertNotIn(first_refresh, str(event.metadata))
        self.assertNotIn(second_refresh, str(event.metadata))

    def test_password_reset_applies_django_password_policy(self):
        uid = urlsafe_base64_encode(force_bytes(self.user.pk))
        token = default_token_generator.make_token(self.user)

        response = self.api.post(
            "/api/auth/password-reset/confirm/",
            {"uid": uid, "token": token, "password": "password"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("password", response.data["errors"])
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("StrongPass123"))

    def test_password_reset_request_does_not_leak_account_existence_or_tokens(self):
        existing_response = self.api.post(
            "/api/auth/password-reset/request/",
            {"email": self.user.email, "delivery_channel": "email"},
            format="json",
        )
        missing_response = self.api.post(
            "/api/auth/password-reset/request/",
            {"email": "missing@example.com", "delivery_channel": "email"},
            format="json",
        )

        self.assertEqual(existing_response.status_code, 200)
        self.assertEqual(missing_response.status_code, 200)
        self.assertEqual(existing_response.data, missing_response.data)
        self.assertNotIn("uid", existing_response.data)
        self.assertNotIn("token", existing_response.data)
        self.assertNotIn("reset_path", existing_response.data)

    def test_password_reset_rejects_invalid_token(self):
        uid = urlsafe_base64_encode(force_bytes(self.user.pk))
        token = default_token_generator.make_token(self.user)
        self.user.set_password("ChangedBeforeConfirm123")
        self.user.save(update_fields=["password"])

        response = self.api.post(
            "/api/auth/password-reset/confirm/",
            {"uid": uid, "token": token, "password": "NewStrongPass123"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)


class CreatePlatformAdminCommandTests(TestCase):
    def test_command_creates_and_updates_platform_admin(self):
        output = StringIO()

        call_command(
            "create_platform_admin",
            email="admin@zani.local",
            password="admin12345",
            stdout=output,
        )

        user = User.objects.get(email="admin@zani.local")
        self.assertEqual(user.role, User.Roles.PLATFORM_ADMIN)
        self.assertTrue(user.is_staff)
        self.assertTrue(user.is_superuser)
        self.assertTrue(user.check_password("admin12345"))

        call_command(
            "create_platform_admin",
            email="admin@zani.local",
            password="newpass123",
            full_name="Platform Owner",
            stdout=output,
        )

        user.refresh_from_db()
        self.assertEqual(User.objects.filter(email="admin@zani.local").count(), 1)
        self.assertEqual(user.full_name, "Platform Owner")
        self.assertTrue(user.check_password("newpass123"))


class PrepareE2ESmokeDataCommandTests(TestCase):
    def test_repeat_run_restores_specialist_appointment_lifecycle_and_archive_state(self):
        command_options = {
            "password": "ZaniTest123!",
            "business_slug": "repeatable-e2e-seed",
            "business_name": "Repeatable E2E Seed",
            "stdout": StringIO(),
        }
        call_command("prepare_e2e_smoke_data", **command_options)

        specialist = User.objects.get(email="business_specialist@example.com")
        appointment = Appointment.objects.get(
            business__slug="repeatable-e2e-seed",
            notes="E2E specialist-owned appointment.",
        )
        appointment.status = Appointment.Statuses.CANCELLED
        appointment.is_archived = True
        appointment.archived_at = timezone.now()
        appointment.archived_by = specialist
        appointment.archive_reason = "Repeat-run regression fixture"
        appointment.save(
            update_fields=[
                "status",
                "is_archived",
                "archived_at",
                "archived_by",
                "archive_reason",
                "updated_at",
            ],
        )

        call_command("prepare_e2e_smoke_data", **command_options)

        appointment.refresh_from_db()
        self.assertEqual(appointment.status, Appointment.Statuses.CREATED)
        self.assertFalse(appointment.is_archived)
        self.assertIsNone(appointment.archived_at)
        self.assertIsNone(appointment.archived_by)
        self.assertEqual(appointment.archive_reason, "")
        self.assertEqual(appointment.resource.linked_user, specialist)
