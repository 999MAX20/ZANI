from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.billing.models import Subscription
from apps.businesses.activation import activate_landing_business
from apps.businesses.models import Business, BusinessMember
from apps.crm.models import PipelineStage
from apps.leads.models import Lead, LeadForm


class LandingActivationFlowTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.platform_user = User.objects.create_user(
            username="platform-manager",
            email="platform-manager@example.com",
            password="pass12345",
            role=User.Roles.PLATFORM_MANAGER,
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
        self.api.force_authenticate(self.platform_user)
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
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["business"]["landing_id"], "landing-api-001")
        self.assertEqual(response.data["subscription"]["status"], Subscription.Statuses.TRIAL)
        self.assertEqual(response.data["lead_form"]["landing_id"], "landing-api-001")

        self.api.force_authenticate(user=None)
        login_response = self.api.post(
            "/api/auth/token/",
            {"email": "api-owner@example.com", "password": "ZaniTest123!"},
            format="json",
        )
        self.assertEqual(login_response.status_code, 200)

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
