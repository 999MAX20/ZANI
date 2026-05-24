from django.core.cache import cache
from django.core.management import call_command
from django.contrib.auth.tokens import default_token_generator
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from django.test import TestCase
from io import StringIO
from unittest.mock import patch
from rest_framework.test import APIClient

from apps.accounts.auth_views import ThrottledTokenObtainPairView, ThrottledTokenRefreshView
from apps.accounts.models import SocialIdentity, User
from apps.accounts.social_auth import SocialUserClaims
from apps.businesses.models import Business, BusinessMember, BusinessRole
from apps.crm.models import Pipeline
from apps.core.models import LoginHistory


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

    def test_auth_views_have_scoped_throttles(self):
        self.assertEqual(ThrottledTokenObtainPairView.throttle_scope, "auth_login")
        self.assertEqual(ThrottledTokenRefreshView.throttle_scope, "auth_refresh")

    def test_login_and_rotating_refresh_flow_works(self):
        login_response = self.api.post(
            "/api/auth/token/",
            {"email": self.user.email, "password": "StrongPass123"},
            format="json",
        )

        self.assertEqual(login_response.status_code, 200)
        self.assertIn("access", login_response.data)
        self.assertIn("refresh", login_response.data)

        old_refresh = login_response.data["refresh"]
        refresh_response = self.api.post(
            "/api/auth/token/refresh/",
            {"refresh": old_refresh},
            format="json",
        )

        self.assertEqual(refresh_response.status_code, 200)
        self.assertIn("access", refresh_response.data)
        self.assertIn("refresh", refresh_response.data)
        self.assertNotEqual(refresh_response.data["refresh"], old_refresh)

        reused_refresh_response = self.api.post(
            "/api/auth/token/refresh/",
            {"refresh": old_refresh},
            format="json",
        )

        self.assertEqual(reused_refresh_response.status_code, 401)

    def test_login_endpoint_is_throttled(self):
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
        self.assertIn("refresh", response.data)
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
        user = User.objects.get(email="new-owner@example.com")
        business = Business.objects.get(owner=user)
        self.assertEqual(user.role, User.Roles.BUSINESS_OWNER)
        self.assertEqual(business.name, "Fresh Salon")
        self.assertTrue(BusinessMember.objects.filter(business=business, user=user, role=BusinessMember.Roles.OWNER, is_active=True).exists())

    def test_password_reset_request_and_confirm_flow(self):
        request_response = self.api.post(
            "/api/auth/password-reset/request/",
            {"email": self.user.email, "delivery_channel": "manual"},
            format="json",
        )

        self.assertEqual(request_response.status_code, 200)
        self.assertTrue(request_response.data["ok"])
        self.assertIn("reset_path", request_response.data)

        confirm_response = self.api.post(
            "/api/auth/password-reset/confirm/",
            {
                "uid": request_response.data["uid"],
                "token": request_response.data["token"],
                "password": "NewStrongPass123",
            },
            format="json",
        )

        self.assertEqual(confirm_response.status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("NewStrongPass123"))

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
