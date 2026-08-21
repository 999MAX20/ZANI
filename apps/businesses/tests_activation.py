import pyotp
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.mfa import issue_step_up_token
from apps.accounts.models import MfaDevice, User
from apps.billing.models import Subscription
from apps.businesses.activation import activate_landing_business
from apps.businesses.models import Business, BusinessMember
from apps.crm.models import PipelineStage
from apps.core.domain_errors import OwnershipConflict
from apps.core.models import AuditLog
from apps.leads.models import Lead, LeadForm
from apps.integrations.credential_encryption import encrypt_credential_value


class LandingActivationFlowTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.platform_manager = User.objects.create_user(
            username="platform-manager",
            email="platform-manager@example.com",
            password="pass12345",
            role=User.Roles.PLATFORM_MANAGER,
        )
        self.platform_admin = User.objects.create_user(
            username="platform-admin",
            email="platform-admin@example.com",
            password="pass12345",
            role=User.Roles.PLATFORM_ADMIN,
        )

    def test_activation_service_creates_owner_business_trial_pipeline_and_lead_form(self):
        result = activate_landing_business(
            landing_id="landing-activation-001",
            owner_email="new-owner@example.com",
            owner_password="ZaniTest123!",
            owner_full_name="New Owner",
            business_name="Activated Clinic",
            business_type=Business.BusinessTypes.MEDICAL,
            landing_domain="promo.activated.test",
            landing_preview_url="https://preview.example/activated",
            city="Almaty",
            phone="+77010000001",
        )

        business = result.business
        owner = result.owner
        self.assertTrue(result.created_owner)
        self.assertTrue(result.created_business)
        self.assertEqual(business.owner, owner)
        self.assertEqual(business.status, Business.Statuses.TRIAL)
        self.assertEqual(business.landing_id, "landing-activation-001")
        self.assertEqual(business.landing_domain, "promo.activated.test")
        self.assertEqual(business.business_type, Business.BusinessTypes.MEDICAL)
        self.assertEqual(business.timezone, "Asia/Almaty")
        self.assertTrue(owner.check_password("ZaniTest123!"))
        self.assertTrue(BusinessMember.objects.filter(business=business, user=owner, role=BusinessMember.Roles.OWNER, is_active=True).exists())

        subscription = Subscription.objects.get(business=business)
        self.assertEqual(subscription.status, Subscription.Statuses.TRIAL)
        self.assertEqual(subscription.plan.code, "growth")
        self.assertGreaterEqual(subscription.next_payment_at, timezone.now() + timezone.timedelta(days=29))

        stage_names = list(PipelineStage.objects.filter(business=business).order_by("order").values_list("name", flat=True))
        self.assertEqual(
            stage_names,
            ["Новая заявка", "Связались", "Записан / в работе", "Оплатил / закрыт", "Не дозвонились", "Отказ"],
        )
        form = LeadForm.objects.get(business=business, landing_id="landing-activation-001")
        self.assertEqual(form.source, Lead.Sources.LANDING)
        self.assertEqual(form.public_id, result.lead_form.public_id)
        self.assertTrue(form.fields.filter(key="phone", is_required=True).exists())

    def test_platform_endpoint_activates_merchant_and_owner_can_login(self):
        self.api.force_authenticate(self.platform_admin)
        response = self.api.post(
            "/api/platform/activate-landing/",
            {
                "landing_id": "landing-api-001",
                "owner_email": "api-owner@example.com",
                "owner_password": "ZaniTest123!",
                "owner_full_name": "API Owner",
                "business_name": "API Clinic",
                "business_type": Business.BusinessTypes.DENTISTRY,
                "landing_domain": "api-clinic.example",
                "landing_preview_url": "https://preview.example/api-clinic",
            },
            format="json",
            HTTP_X_ZANI_MFA_STEP_UP=self._step_up_token(self.platform_admin),
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["business"]["landing_id"], "landing-api-001")
        self.assertEqual(response.data["subscription"]["status"], Subscription.Statuses.TRIAL)
        self.assertEqual(response.data["lead_form"]["landing_id"], "landing-api-001")
        audit = AuditLog.objects.get(entity_type="Business", entity_id=str(response.data["business"]["id"]))
        self.assertEqual(audit.actor, self.platform_admin)
        self.assertEqual(audit.category, AuditLog.Categories.SECURITY)
        self.assertEqual(audit.risk_level, AuditLog.RiskLevels.CRITICAL)
        self.assertEqual(audit.metadata["kind"], "platform_activation")

        self.api.force_authenticate(user=None)
        login_response = self.api.post(
            "/api/auth/token/",
            {"email": "api-owner@example.com", "password": "ZaniTest123!"},
            format="json",
        )
        self.assertEqual(login_response.status_code, 200)

    def test_platform_manager_cannot_activate_landing_business(self):
        self.api.force_authenticate(self.platform_manager)

        response = self.api.post(
            "/api/platform/activate-landing/",
            {
                "landing_id": "landing-manager-forbidden-001",
                "owner_email": "manager-target@example.com",
                "owner_password": "ZaniTest123!",
                "business_name": "Manager Forbidden Clinic",
            },
            format="json",
            HTTP_X_ZANI_MFA_STEP_UP=self._step_up_token(self.platform_manager),
        )

        self.assertEqual(response.status_code, 403)
        self.assertFalse(Business.objects.filter(landing_id="landing-manager-forbidden-001").exists())

    def test_platform_admin_requires_recent_mfa_step_up(self):
        self.api.force_authenticate(self.platform_admin)

        response = self.api.post(
            "/api/platform/activate-landing/",
            {
                "landing_id": "landing-step-up-required-001",
                "owner_email": "step-up-target@example.com",
                "owner_password": "ZaniTest123!",
                "business_name": "Step-up Clinic",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.data["code"], "mfa_step_up_required")
        self.assertFalse(Business.objects.filter(landing_id="landing-step-up-required-001").exists())

    def test_platform_endpoint_rejects_existing_landing_owner_replacement(self):
        original = activate_landing_business(
            landing_id="landing-endpoint-owner-locked-001",
            owner_email="endpoint-original-owner@example.com",
            owner_password="Original-Zani-Password-2026!",
            business_name="Endpoint Owner Locked Clinic",
        )
        self.api.force_authenticate(self.platform_admin)

        response = self.api.post(
            "/api/platform/activate-landing/",
            {
                "landing_id": "landing-endpoint-owner-locked-001",
                "owner_email": "endpoint-replacement-owner@example.com",
                "owner_password": "Replacement-Zani-Password-2026!",
                "business_name": "Endpoint Hijacked Clinic",
            },
            format="json",
            HTTP_X_ZANI_MFA_STEP_UP=self._step_up_token(self.platform_admin),
        )

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data["code"], "ownership_conflict")
        original.business.refresh_from_db()
        self.assertEqual(original.business.owner, original.owner)
        self.assertEqual(original.business.name, "Endpoint Owner Locked Clinic")
        self.assertFalse(User.objects.filter(email="endpoint-replacement-owner@example.com").exists())

    def test_platform_endpoint_applies_full_password_policy(self):
        self.api.force_authenticate(self.platform_admin)

        response = self.api.post(
            "/api/platform/activate-landing/",
            {
                "landing_id": "landing-weak-password-001",
                "owner_email": "weak-password-owner@example.com",
                "owner_password": "password",
                "business_name": "Weak Password Clinic",
            },
            format="json",
            HTTP_X_ZANI_MFA_STEP_UP=self._step_up_token(self.platform_admin),
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["code"], "validation_error")
        self.assertIn("owner_password", response.data["errors"])
        self.assertFalse(Business.objects.filter(landing_id="landing-weak-password-001").exists())

    def test_merchant_cannot_activate_landing_business(self):
        merchant = User.objects.create_user(
            username="merchant-owner",
            email="merchant-owner@example.com",
            password="pass12345",
            role=User.Roles.BUSINESS_OWNER,
        )
        self.api.force_authenticate(merchant)

        response = self.api.post(
            "/api/platform/activate-landing/",
            {
                "landing_id": "landing-forbidden-001",
                "owner_email": "forbidden-owner@example.com",
                "business_name": "Forbidden Clinic",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 403)
        self.assertFalse(Business.objects.filter(landing_id="landing-forbidden-001").exists())

    def test_activation_is_idempotent_for_same_landing_id(self):
        first = activate_landing_business(
            landing_id="landing-idempotent-001",
            owner_email="idempotent-owner@example.com",
            owner_password="ZaniTest123!",
            business_name="First Name",
        )
        second = activate_landing_business(
            landing_id="landing-idempotent-001",
            owner_email="idempotent-owner@example.com",
            owner_password="ZaniTest123!",
            business_name="Updated Name",
        )

        self.assertEqual(first.business.id, second.business.id)
        self.assertFalse(second.created_business)
        self.assertEqual(Business.objects.filter(landing_id="landing-idempotent-001").count(), 1)
        self.assertEqual(LeadForm.objects.filter(landing_id="landing-idempotent-001").count(), 1)
        self.assertEqual(first.business.owner_id, second.business.owner_id)

    def test_existing_landing_owner_cannot_be_reassigned(self):
        original = activate_landing_business(
            landing_id="landing-owner-locked-001",
            owner_email="original-owner@example.com",
            owner_password="Original-Zani-Password-2026!",
            business_name="Owner Locked Clinic",
        )

        with self.assertRaises(OwnershipConflict):
            activate_landing_business(
                landing_id="landing-owner-locked-001",
                owner_email="replacement-owner@example.com",
                owner_password="Replacement-Zani-Password-2026!",
                business_name="Hijacked Clinic",
            )

        original.business.refresh_from_db()
        original.owner.refresh_from_db()
        self.assertEqual(original.business.owner, original.owner)
        self.assertEqual(original.business.name, "Owner Locked Clinic")
        self.assertTrue(original.owner.check_password("Original-Zani-Password-2026!"))
        self.assertFalse(User.objects.filter(email="replacement-owner@example.com").exists())

    def test_existing_user_security_state_is_not_mutated_during_activation(self):
        existing = User.objects.create_user(
            username="existing-account",
            email="existing-account@example.com",
            password="Existing-Zani-Password-2026!",
            role=User.Roles.PLATFORM_MANAGER,
            is_active=False,
        )

        result = activate_landing_business(
            landing_id="landing-existing-account-001",
            owner_email=existing.email,
            owner_password="Attacker-Replacement-Password-2026!",
            owner_full_name="Activation Name",
            business_name="Existing Account Clinic",
        )

        existing.refresh_from_db()
        self.assertFalse(result.created_owner)
        self.assertEqual(existing.role, User.Roles.PLATFORM_MANAGER)
        self.assertFalse(existing.is_active)
        self.assertTrue(existing.check_password("Existing-Zani-Password-2026!"))
        self.assertFalse(existing.check_password("Attacker-Replacement-Password-2026!"))

    @staticmethod
    def _step_up_token(user):
        secret = pyotp.random_base32()
        MfaDevice.objects.create(
            user=user,
            encrypted_secret=encrypt_credential_value(secret),
            confirmed_at=timezone.now(),
        )
        return issue_step_up_token(user, pyotp.TOTP(secret).now())
