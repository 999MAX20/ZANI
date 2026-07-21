from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.businesses.models import Business, BusinessMember
from apps.clients.models import Client
from apps.conversations.models import QuickReplyTemplate
from apps.crm.models import Deal, PipelineStage
from apps.integrations.models import BusinessConnector, BusinessEvent
from apps.leads.models import Lead
from apps.scheduling.models import Appointment, WorkingHours
from apps.services.models import Service
from apps.bots.models import BotChannel, BotConversation, BotMessage
from apps.tasks.models import Task


class OnboardingTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.owner = User.objects.create_user(username="owner", email="owner@example.com", password="pass")
        self.operator = User.objects.create_user(username="operator", email="operator@example.com", password="pass")
        self.other_owner = User.objects.create_user(username="other", email="other@example.com", password="pass")
        self.business = Business.objects.create(owner=self.owner, name="New Clinic", slug="new-clinic")
        self.other_business = Business.objects.create(owner=self.other_owner, name="Other Clinic", slug="other-onboarding")
        BusinessMember.objects.create(business=self.business, user=self.owner, role=BusinessMember.Roles.OWNER)
        BusinessMember.objects.create(business=self.business, user=self.operator, role=BusinessMember.Roles.OPERATOR)
        BusinessMember.objects.create(business=self.other_business, user=self.other_owner, role=BusinessMember.Roles.OWNER)

    def test_templates_are_listed(self):
        self.api.force_authenticate(self.owner)

        response = self.api.get("/api/onboarding/templates/")

        self.assertEqual(response.status_code, 200)
        self.assertGreaterEqual(len(response.data), 7)

    def test_owner_can_apply_niche_template(self):
        self.api.force_authenticate(self.owner)

        response = self.api.post(
            "/api/onboarding/apply-template/",
            {"business": self.business.id, "template_key": "dentistry"},
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.business.refresh_from_db()
        self.assertEqual(self.business.business_type, Business.BusinessTypes.DENTISTRY)
        self.assertGreaterEqual(Service.objects.filter(business=self.business).count(), 3)
        self.assertGreaterEqual(PipelineStage.objects.filter(business=self.business).count(), 6)
        self.assertGreaterEqual(QuickReplyTemplate.objects.filter(business=self.business).count(), 2)
        self.assertGreaterEqual(WorkingHours.objects.filter(business=self.business).count(), 7)
        self.assertGreaterEqual(response.data["checklist"]["progress"], 50)

    def test_operator_cannot_apply_template(self):
        self.api.force_authenticate(self.operator)

        response = self.api.post(
            "/api/onboarding/apply-template/",
            {"business": self.business.id, "template_key": "beauty"},
            format="json",
        )

        self.assertEqual(response.status_code, 403)

    def test_other_merchant_cannot_read_status(self):
        self.api.force_authenticate(self.other_owner)

        response = self.api.get("/api/onboarding/status/", {"business": self.business.id})

        self.assertEqual(response.status_code, 403)

    def test_demo_data_creates_first_flow(self):
        self.api.force_authenticate(self.owner)
        self.api.post(
            "/api/onboarding/apply-template/",
            {"business": self.business.id, "template_key": "medical"},
            format="json",
        )

        response = self.api.post("/api/onboarding/demo-data/", {"business": self.business.id}, format="json")

        self.assertEqual(response.status_code, 201)
        self.assertTrue(Client.objects.filter(business=self.business).exists())
        self.assertTrue(Lead.objects.filter(business=self.business).exists())
        self.assertTrue(Deal.objects.filter(business=self.business).exists())
        self.assertTrue(Task.objects.filter(business=self.business, deal__isnull=False, appointment__isnull=False).exists())
        self.assertTrue(Appointment.objects.filter(business=self.business).exists())
        self.assertGreaterEqual(response.data["completed"], 8)
        self.assertTrue(response.data["demo"])
        self.assertEqual(response.data["mode"], "demo")

    def test_operator_cannot_create_demo_data(self):
        self.api.force_authenticate(self.operator)

        response = self.api.post("/api/onboarding/demo-data/", {"business": self.business.id}, format="json")

        self.assertEqual(response.status_code, 403)
        self.assertFalse(Client.objects.filter(business=self.business).exists())

    def test_other_merchant_cannot_create_demo_data(self):
        self.api.force_authenticate(self.other_owner)

        response = self.api.post("/api/onboarding/demo-data/", {"business": self.business.id}, format="json")

        self.assertEqual(response.status_code, 403)
        self.assertFalse(Client.objects.filter(business=self.business).exists())

    @override_settings(ALLOW_DEMO_MERCHANT_FLOWS=False)
    def test_demo_data_is_disabled_when_demo_flows_are_not_allowed(self):
        self.api.force_authenticate(self.owner)

        response = self.api.post("/api/onboarding/demo-data/", {"business": self.business.id}, format="json")

        self.assertEqual(response.status_code, 403)
        self.assertFalse(Client.objects.filter(business=self.business).exists())

    def test_owner_can_setup_first_website_channel(self):
        self.api.force_authenticate(self.owner)

        response = self.api.post(
            "/api/onboarding/setup-channel/",
            {"business": self.business.id, "channel": "website"},
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertTrue(BotChannel.objects.filter(bot__business=self.business, channel=BotChannel.Channels.WEBSITE, status=BotChannel.Statuses.ACTIVE).exists())
        connector = BusinessConnector.objects.get(business=self.business, provider=BusinessConnector.Providers.WEBSITE)
        self.assertEqual(connector.status, BusinessConnector.Statuses.CONNECTED)
        self.assertTrue(BusinessEvent.objects.filter(business=self.business, source=BusinessConnector.Providers.WEBSITE, event_type="channel_connected").exists())
        self.assertIn("public_token", response.data)
        self.assertTrue(next(item for item in response.data["status"]["items"] if item["key"] == "first_channel")["is_completed"])

    def test_first_message_creates_inbox_conversation_and_lead(self):
        self.api.force_authenticate(self.owner)
        self.api.post(
            "/api/onboarding/apply-template/",
            {"business": self.business.id, "template_key": "beauty"},
            format="json",
        )

        response = self.api.post("/api/onboarding/first-message/", {"business": self.business.id}, format="json")

        self.assertEqual(response.status_code, 201)
        self.assertTrue(BotConversation.objects.filter(business=self.business, channel=BotConversation.Channels.WEBSITE, handoff_required=True).exists())
        self.assertTrue(BotMessage.objects.filter(conversation__business=self.business, external_message_id="onboarding-first-message").exists())
        self.assertTrue(Lead.objects.filter(business=self.business, source=Lead.Sources.WEBSITE).exists())
        self.assertTrue(BusinessEvent.objects.filter(business=self.business, source=BusinessConnector.Providers.WEBSITE, event_type="message_received").exists())
        self.assertTrue(next(item for item in response.data["status"]["items"] if item["key"] == "first_message")["is_completed"])

    def test_operator_cannot_setup_channel(self):
        self.api.force_authenticate(self.operator)

        response = self.api.post(
            "/api/onboarding/setup-channel/",
            {"business": self.business.id, "channel": "website"},
            format="json",
        )

        self.assertEqual(response.status_code, 403)
