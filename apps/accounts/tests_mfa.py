from datetime import timedelta

import pyotp
from django.core.cache import cache
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.mfa import MfaStepUpRequired, issue_step_up_token, validate_step_up_token
from apps.accounts.models import MfaChallenge, MfaDevice, MfaRecoveryCode, User
from apps.businesses.models import Business, BusinessMember
from apps.core.models import AuditLog
from apps.integrations.credential_encryption import decrypt_credential_value


@override_settings(
    AUTH_PRIVILEGED_MFA_REQUIRED=True,
    AUTH_MFA_CHALLENGE_SECONDS=300,
    AUTH_MFA_STEP_UP_SECONDS=300,
)
class PrivilegedMfaTests(TestCase):
    password = "Correct-Horse-Battery-Staple-2026!"

    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.owner = User.objects.create_user(
            username="owner@example.com",
            email="owner@example.com",
            password=self.password,
            role=User.Roles.BUSINESS_OWNER,
        )
        self.business = Business.objects.create(owner=self.owner, name="MFA Clinic", slug="mfa-clinic")
        BusinessMember.objects.create(
            business=self.business,
            user=self.owner,
            role=BusinessMember.Roles.OWNER,
            is_active=True,
        )

    def test_owner_enrolls_then_uses_totp_at_login_and_replay_is_rejected(self):
        login = self._login()
        self.assertEqual(login.status_code, 202)
        self.assertEqual(login.data["code"], "mfa_enrollment_required")
        self.assertNotIn("access", login.data)
        self.assertNotIn("refresh", login.data)

        start = self.client.post(
            "/api/auth/mfa/enrollment/start/",
            {"challenge_token": login.data["challenge_token"]},
            format="json",
        )
        self.assertEqual(start.status_code, 200)
        self.assertIn("otpauth_uri", start.data)
        self.assertIn("manual_key", start.data)

        code = pyotp.TOTP(start.data["manual_key"]).now()
        confirm = self.client.post(
            "/api/auth/mfa/enrollment/confirm/",
            {"challenge_token": login.data["challenge_token"], "code": code},
            format="json",
        )
        self.assertEqual(confirm.status_code, 200)
        self.assertIn("access", confirm.data)
        self.assertEqual(len(confirm.data["recovery_codes"]), 10)
        self.assertNotIn("refresh", confirm.data)
        self.assertEqual(MfaRecoveryCode.objects.filter(user=self.owner, used_at__isnull=True).count(), 10)

        self.client.cookies.clear()
        next_login = self._login()
        self.assertEqual(next_login.status_code, 202)
        self.assertEqual(next_login.data["code"], "mfa_required")
        future_code = pyotp.TOTP(start.data["manual_key"]).at(timezone.now() + timedelta(seconds=30))
        verified = self.client.post(
            "/api/auth/mfa/verify/",
            {"challenge_token": next_login.data["challenge_token"], "code": future_code},
            format="json",
        )
        self.assertEqual(verified.status_code, 200)

        replay_login = self._login()
        replay = self.client.post(
            "/api/auth/mfa/verify/",
            {"challenge_token": replay_login.data["challenge_token"], "code": future_code},
            format="json",
        )
        self.assertEqual(replay.status_code, 401)
        self.assertEqual(replay.data.get("code"), "mfa_code_invalid", replay.data)

    def test_recovery_code_is_single_use_and_never_returned_by_status(self):
        recovery_codes, _ = self._enroll_owner()
        recovery = recovery_codes[0]
        self.client.cookies.clear()

        login = self._login()
        first = self.client.post(
            "/api/auth/mfa/verify/",
            {"challenge_token": login.data["challenge_token"], "code": recovery},
            format="json",
        )
        self.assertEqual(first.status_code, 200)
        self.assertEqual(MfaRecoveryCode.objects.filter(user=self.owner, used_at__isnull=True).count(), 9)

        self.client.cookies.clear()
        second_login = self._login()
        second = self.client.post(
            "/api/auth/mfa/verify/",
            {"challenge_token": second_login.data["challenge_token"], "code": recovery},
            format="json",
        )
        self.assertEqual(second.status_code, 401)

        self.client.force_authenticate(self.owner)
        status_response = self.client.get("/api/auth/mfa/status/")
        self.assertEqual(status_response.status_code, 200)
        self.assertEqual(status_response.data["recovery_codes_remaining"], 9)
        self.assertNotIn("recovery_codes", status_response.data)
        self.assertNotIn("manual_key", status_response.data)

    def test_challenge_locks_after_five_failures_and_records_security_audit(self):
        self._enroll_owner()
        self.client.cookies.clear()
        login = self._login()
        token = login.data["challenge_token"]

        for _ in range(5):
            response = self.client.post(
                "/api/auth/mfa/verify/",
                {"challenge_token": token, "code": "000000"},
                format="json",
            )
            self.assertEqual(response.status_code, 401)

        challenge = MfaChallenge.objects.get(token_hash__isnull=False, purpose=MfaChallenge.Purposes.LOGIN)
        self.assertEqual(challenge.failed_attempts, 5)
        self.assertIsNotNone(challenge.consumed_at)
        self.assertTrue(
            AuditLog.objects.filter(actor=self.owner, metadata__event="mfa_login_failed").exists()
        )

    def test_lower_role_is_not_forced_into_mfa(self):
        employee = User.objects.create_user(
            username="operator@example.com",
            email="operator@example.com",
            password=self.password,
            role=User.Roles.BUSINESS_OPERATOR,
        )
        BusinessMember.objects.create(
            business=self.business,
            user=employee,
            role=BusinessMember.Roles.OPERATOR,
            is_active=True,
        )

        response = self.client.post(
            "/api/auth/token/",
            {"email": employee.email, "password": self.password},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn("access", response.data)

    def test_legacy_privileged_refresh_without_mfa_claim_is_rejected(self):
        raw_refresh = str(RefreshToken.for_user(self.owner))
        self.client.cookies["zani_refresh"] = raw_refresh

        response = self.client.post("/api/auth/token/refresh/", {}, format="json")

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.data["code"], "token_not_valid")

    def test_disable_requires_reason_password_and_factor_and_is_audited(self):
        _, secret = self._enroll_owner()
        self.client.force_authenticate(self.owner)
        code = pyotp.TOTP(secret).at(timezone.now() + timedelta(seconds=30))

        missing_reason = self.client.post(
            "/api/auth/mfa/disable/",
            {"password": self.password, "code": code, "reason": "short"},
            format="json",
        )
        self.assertEqual(missing_reason.status_code, 400)

        response = self.client.post(
            "/api/auth/mfa/disable/",
            {"password": self.password, "code": code, "reason": "Owner changed authenticator device"},
            format="json",
        )
        self.assertEqual(response.status_code, 202)
        self.assertEqual(response.data["code"], "mfa_enrollment_required")
        self.assertNotIn("access", response.data)
        self.assertFalse(MfaDevice.objects.filter(user=self.owner).exists())
        audit = AuditLog.objects.filter(actor=self.owner, metadata__event="mfa_disabled").first()
        self.assertIsNotNone(audit)
        self.assertEqual(audit.metadata["reason"], "Owner changed authenticator device")

    def test_active_business_admin_is_forced_into_mfa(self):
        admin = User.objects.create_user(
            username="admin@example.com",
            email="admin@example.com",
            password=self.password,
            role=User.Roles.BUSINESS_MANAGER,
        )
        BusinessMember.objects.create(
            business=self.business,
            user=admin,
            role=BusinessMember.Roles.ADMIN,
            is_active=True,
        )

        response = self.client.post(
            "/api/auth/token/",
            {"email": admin.email, "password": self.password},
            format="json",
        )

        self.assertEqual(response.status_code, 202)
        self.assertEqual(response.data["code"], "mfa_enrollment_required")
        self.assertNotIn("access", response.data)

    def test_expired_challenge_is_rejected(self):
        login = self._login()
        MfaChallenge.objects.filter(purpose=MfaChallenge.Purposes.ENROLLMENT).update(
            expires_at=timezone.now() - timedelta(seconds=1)
        )

        response = self.client.post(
            "/api/auth/mfa/enrollment/start/",
            {"challenge_token": login.data["challenge_token"]},
            format="json",
        )

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.data["code"], "mfa_challenge_invalid")

    def test_step_up_token_is_bound_to_user_and_expires(self):
        _, secret = self._enroll_owner()
        code = pyotp.TOTP(secret).at(timezone.now() + timedelta(seconds=30))
        token = issue_step_up_token(self.owner, code)
        self.assertTrue(validate_step_up_token(self.owner, token))

        other = User.objects.create_user(
            username="step-up-other@example.com",
            email="step-up-other@example.com",
            password=self.password,
        )
        with self.assertRaises(MfaStepUpRequired):
            validate_step_up_token(other, token)
        with override_settings(AUTH_MFA_STEP_UP_SECONDS=-1), self.assertRaises(MfaStepUpRequired):
            validate_step_up_token(self.owner, token)

    def test_password_change_requires_factor_and_reissues_verified_session(self):
        _, secret = self._enroll_owner()
        self.client.force_authenticate(self.owner)
        new_password = "Changed-Correct-Horse-Battery-2026!"

        rejected = self.client.post(
            "/api/auth/change-password/",
            {
                "current_password": self.password,
                "new_password": new_password,
                "mfa_code": "000000",
            },
            format="json",
        )
        self.assertEqual(rejected.status_code, 401)

        code = pyotp.TOTP(secret).at(timezone.now() + timedelta(seconds=30))
        changed = self.client.post(
            "/api/auth/change-password/",
            {
                "current_password": self.password,
                "new_password": new_password,
                "mfa_code": code,
            },
            format="json",
        )
        self.assertEqual(changed.status_code, 200)
        replacement = RefreshToken(changed.cookies["zani_refresh"].value)
        self.assertTrue(replacement["mfa_verified"])
        self.owner.refresh_from_db()
        self.assertTrue(self.owner.check_password(new_password))

    def test_owner_signup_requires_enrollment_before_session_is_issued(self):
        response = self.client.post(
            "/api/auth/signup/owner/",
            {
                "email": "new-owner@example.com",
                "password": self.password,
                "full_name": "New Owner",
                "business_name": "New MFA Business",
                "business_type": "dentistry",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 202)
        self.assertEqual(response.data["code"], "mfa_enrollment_required")
        self.assertNotIn("access", response.data)
        self.assertNotIn("refresh", response.data)

    def test_mfa_endpoints_cannot_target_another_tenant_user(self):
        other = User.objects.create_user(
            username="other-owner@example.com",
            email="other-owner@example.com",
            password=self.password,
            role=User.Roles.BUSINESS_OWNER,
        )
        other_business = Business.objects.create(owner=other, name="Other", slug="other-mfa")
        BusinessMember.objects.create(
            business=other_business,
            user=other,
            role=BusinessMember.Roles.OWNER,
            is_active=True,
        )
        self.client.force_authenticate(self.owner)

        response = self.client.get(f"/api/auth/mfa/status/?user={other.pk}&business={other_business.pk}")

        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data["enabled"])
        self.assertFalse(MfaDevice.objects.filter(user=other).exists())

    def _login(self):
        return self.client.post(
            "/api/auth/token/",
            {"email": self.owner.email, "password": self.password},
            format="json",
        )

    def _enroll_owner(self):
        login = self._login()
        start = self.client.post(
            "/api/auth/mfa/enrollment/start/",
            {"challenge_token": login.data["challenge_token"]},
            format="json",
        )
        secret = start.data["manual_key"]
        confirm = self.client.post(
            "/api/auth/mfa/enrollment/confirm/",
            {"challenge_token": login.data["challenge_token"], "code": pyotp.TOTP(secret).now()},
            format="json",
        )
        self.assertEqual(confirm.status_code, 200)
        encrypted = MfaDevice.objects.get(user=self.owner).encrypted_secret
        self.assertNotIn(secret, encrypted)
        self.assertEqual(decrypt_credential_value(encrypted), secret)
        stored_hashes = list(MfaRecoveryCode.objects.filter(user=self.owner).values_list("code_hash", flat=True))
        self.assertTrue(all(len(value) == 64 for value in stored_hashes))
        self.assertTrue(all(code.replace("-", "") not in stored_hashes for code in confirm.data["recovery_codes"]))
        return confirm.data["recovery_codes"], secret
