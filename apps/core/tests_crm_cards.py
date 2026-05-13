from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.activities.models import ActivityEvent, Note
from apps.bots.models import Bot, BotConversation, BotMessage
from apps.businesses.models import Business, BusinessMember
from apps.clients.models import Client
from apps.crm.models import Deal, Pipeline, PipelineStage
from apps.leads.models import Lead
from apps.scheduling.models import Appointment
from apps.services.models import Service
from apps.tasks.models import Task


class CrmCardEndpointTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.owner = User.objects.create_user(
            username="crm-card-owner",
            email="crm-card-owner@example.com",
            password="pass",
            role=User.Roles.BUSINESS_OWNER,
        )
        self.other_owner = User.objects.create_user(
            username="crm-card-other",
            email="crm-card-other@example.com",
            password="pass",
            role=User.Roles.BUSINESS_OWNER,
        )
        self.business = Business.objects.create(owner=self.owner, name="CRM Card Clinic", slug="crm-card-clinic")
        self.other_business = Business.objects.create(owner=self.other_owner, name="Other CRM Card", slug="other-crm-card")
        BusinessMember.objects.create(business=self.business, user=self.owner, role=BusinessMember.Roles.OWNER)
        BusinessMember.objects.create(business=self.other_business, user=self.other_owner, role=BusinessMember.Roles.OWNER)

        self.client = Client.objects.create(
            business=self.business,
            full_name="CRM Card Client",
            phone="+77015550123",
            email="client@example.com",
        )
        self.service = Service.objects.create(business=self.business, name="Consultation", duration_minutes=60)
        self.lead = Lead.objects.create(
            business=self.business,
            client=self.client,
            service=self.service,
            message="Need a consultation",
            source=Lead.Sources.WEBSITE,
        )
        self.pipeline = Pipeline.objects.create(business=self.business, name="Main", slug="main", is_default=True)
        self.stage = PipelineStage.objects.create(
            business=self.business,
            pipeline=self.pipeline,
            name="New",
            order=1,
            probability=20,
        )
        self.deal = Deal.objects.create(
            business=self.business,
            client=self.client,
            lead=self.lead,
            pipeline=self.pipeline,
            stage=self.stage,
            title="Consultation deal",
            amount=12000,
        )
        start_at = datetime(2026, 5, 13, 10, 0, tzinfo=ZoneInfo("Asia/Almaty"))
        self.appointment = Appointment.objects.create(
            business=self.business,
            client=self.client,
            lead=self.lead,
            service=self.service,
            start_at=start_at,
            end_at=start_at + timedelta(hours=1),
        )
        Task.objects.create(
            business=self.business,
            title="Call client",
            client=self.client,
            lead=self.lead,
            deal=self.deal,
            appointment=self.appointment,
        )
        self.bot = Bot.objects.create(business=self.business, name="Website bot")
        self.conversation = BotConversation.objects.create(
            business=self.business,
            bot=self.bot,
            channel=BotConversation.Channels.WEBSITE,
            client=self.client,
            lead=self.lead,
            external_user_id="visitor-1",
        )
        BotMessage.objects.create(
            conversation=self.conversation,
            direction=BotMessage.Directions.INBOUND,
            text="Hello",
        )
        ActivityEvent.objects.create(
            business=self.business,
            client=self.client,
            category=ActivityEvent.Categories.CRM,
            event_type="deal.created",
            entity_type="Deal",
            entity_id=str(self.deal.id),
            text="Deal created",
        )
        Note.objects.create(
            business=self.business,
            client=self.client,
            entity_type="Deal",
            entity_id=str(self.deal.id),
            text="Important note",
        )

    def test_client_crm_card_returns_related_context(self):
        self.api.force_authenticate(self.owner)

        response = self.api.get(f"/api/clients/{self.client.id}/crm-card/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["client"]["id"], self.client.id)
        self.assertEqual(response.data["lead"]["id"], self.lead.id)
        self.assertEqual(response.data["deal"]["id"], self.deal.id)
        self.assertEqual(response.data["appointment"]["id"], self.appointment.id)
        self.assertEqual(len(response.data["tasks"]), 1)
        self.assertEqual(len(response.data["conversations"]), 1)
        self.assertEqual(len(response.data["timeline"]), 1)
        self.assertEqual(len(response.data["notes"]), 1)

    def test_crm_card_endpoints_exist_for_core_entities(self):
        self.api.force_authenticate(self.owner)

        endpoints = [
            f"/api/leads/{self.lead.id}/crm-card/",
            f"/api/deals/{self.deal.id}/crm-card/",
            f"/api/appointments/{self.appointment.id}/crm-card/",
        ]

        for endpoint in endpoints:
            response = self.api.get(endpoint)
            self.assertEqual(response.status_code, 200, endpoint)
            self.assertEqual(response.data["client"]["id"], self.client.id)

    def test_crm_card_is_tenant_filtered(self):
        self.api.force_authenticate(self.other_owner)

        response = self.api.get(f"/api/clients/{self.client.id}/crm-card/")

        self.assertEqual(response.status_code, 404)
