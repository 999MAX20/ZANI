from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.bots.models import Bot, BotConversation
from apps.businesses.models import Business, BusinessMember
from apps.clients.models import Client
from apps.crm.models import Deal, Pipeline, PipelineStage
from apps.leads.models import Lead
from apps.scheduling.models import Appointment
from apps.services.models import Service
from apps.tasks.models import Task


def _result_ids(response):
    payload = response.data
    rows = payload.get("results", payload) if isinstance(payload, dict) else payload
    return [item["id"] for item in rows]


class WorkspaceRelatedFilterContractTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.owner = User.objects.create_user(
            username="workspace-owner",
            email="workspace-owner@example.com",
            password="pass",
            role=User.Roles.BUSINESS_OWNER,
        )
        self.other_owner = User.objects.create_user(
            username="workspace-other-owner",
            email="workspace-other-owner@example.com",
            password="pass",
            role=User.Roles.BUSINESS_OWNER,
        )
        self.business = Business.objects.create(owner=self.owner, name="Workspace Clinic", slug="workspace-clinic")
        self.other_business = Business.objects.create(owner=self.other_owner, name="Other Workspace", slug="other-workspace")
        BusinessMember.objects.create(business=self.business, user=self.owner, role=BusinessMember.Roles.OWNER)
        BusinessMember.objects.create(business=self.other_business, user=self.other_owner, role=BusinessMember.Roles.OWNER)

        self.client = Client.objects.create(business=self.business, full_name="Workspace Client")
        self.second_client = Client.objects.create(business=self.business, full_name="Second Workspace Client")
        self.other_client = Client.objects.create(business=self.other_business, full_name="Other Workspace Client")
        self.service = Service.objects.create(business=self.business, name="Consultation", duration_minutes=60)
        self.other_service = Service.objects.create(business=self.other_business, name="Other Consultation", duration_minutes=60)
        self.lead = Lead.objects.create(business=self.business, client=self.client, service=self.service, message="Primary lead")
        self.second_lead = Lead.objects.create(business=self.business, client=self.second_client, service=self.service, message="Second lead")
        self.other_lead = Lead.objects.create(business=self.other_business, client=self.other_client, service=self.other_service, message="Other lead")

        self.pipeline = Pipeline.objects.create(business=self.business, name="Main", slug="main", is_default=True)
        self.stage = PipelineStage.objects.create(business=self.business, pipeline=self.pipeline, name="New", order=1)
        self.other_pipeline = Pipeline.objects.create(business=self.other_business, name="Other", slug="other", is_default=True)
        self.other_stage = PipelineStage.objects.create(business=self.other_business, pipeline=self.other_pipeline, name="Other New", order=1)
        self.deal = Deal.objects.create(business=self.business, client=self.client, lead=self.lead, pipeline=self.pipeline, stage=self.stage, title="Primary deal")
        self.second_deal = Deal.objects.create(business=self.business, client=self.second_client, lead=self.second_lead, pipeline=self.pipeline, stage=self.stage, title="Second deal")
        self.other_deal = Deal.objects.create(business=self.other_business, client=self.other_client, lead=self.other_lead, pipeline=self.other_pipeline, stage=self.other_stage, title="Other deal")

        start_at = datetime(2026, 7, 20, 10, 0, tzinfo=ZoneInfo("Asia/Almaty"))
        self.appointment = Appointment.objects.create(
            business=self.business,
            client=self.client,
            lead=self.lead,
            service=self.service,
            start_at=start_at,
            end_at=start_at + timedelta(hours=1),
        )
        self.second_appointment = Appointment.objects.create(
            business=self.business,
            client=self.second_client,
            lead=self.second_lead,
            service=self.service,
            start_at=start_at + timedelta(days=1),
            end_at=start_at + timedelta(days=1, hours=1),
        )
        self.other_appointment = Appointment.objects.create(
            business=self.other_business,
            client=self.other_client,
            lead=self.other_lead,
            service=self.other_service,
            start_at=start_at,
            end_at=start_at + timedelta(hours=1),
        )

        self.bot = Bot.objects.create(business=self.business, name="Workspace bot")
        self.other_bot = Bot.objects.create(business=self.other_business, name="Other workspace bot")
        self.conversation = BotConversation.objects.create(
            business=self.business,
            bot=self.bot,
            channel=BotConversation.Channels.WEBSITE,
            client=self.client,
            lead=self.lead,
            deal=self.deal,
            external_user_id="workspace-visitor",
        )
        self.second_conversation = BotConversation.objects.create(
            business=self.business,
            bot=self.bot,
            channel=BotConversation.Channels.WEBSITE,
            client=self.second_client,
            lead=self.second_lead,
            deal=self.second_deal,
            external_user_id="second-workspace-visitor",
        )
        self.other_conversation = BotConversation.objects.create(
            business=self.other_business,
            bot=self.other_bot,
            channel=BotConversation.Channels.WEBSITE,
            client=self.other_client,
            lead=self.other_lead,
            deal=self.other_deal,
            external_user_id="other-workspace-visitor",
        )
        self.task = Task.objects.create(
            business=self.business,
            title="Primary workspace task",
            client=self.client,
            lead=self.lead,
            deal=self.deal,
            appointment=self.appointment,
            conversation=self.conversation,
        )
        self.conversation_only_task = Task.objects.create(
            business=self.business,
            title="Conversation-only workspace task",
            conversation=self.conversation,
        )
        self.second_task = Task.objects.create(
            business=self.business,
            title="Second workspace task",
            client=self.second_client,
            lead=self.second_lead,
            deal=self.second_deal,
            appointment=self.second_appointment,
            conversation=self.second_conversation,
        )
        self.other_task = Task.objects.create(
            business=self.other_business,
            title="Other workspace task",
            client=self.other_client,
            lead=self.other_lead,
            deal=self.other_deal,
            appointment=self.other_appointment,
            conversation=self.other_conversation,
        )

    def test_workspace_related_filters_reuse_existing_list_apis(self):
        self.api.force_authenticate(self.owner)

        deals_response = self.api.get("/api/deals/", {"lead_ids": str(self.lead.id)})
        appointments_response = self.api.get("/api/appointments/", {"lead_ids": [self.lead.id]})
        tasks_by_lead_response = self.api.get("/api/tasks/", {"lead_ids[]": [self.lead.id]})
        tasks_by_deal_response = self.api.get("/api/tasks/", {"deal_ids": str(self.deal.id)})
        tasks_by_appointment_response = self.api.get("/api/tasks/", {"appointment_ids": str(self.appointment.id)})
        tasks_by_conversation_response = self.api.get("/api/tasks/", {"conversation_ids": str(self.conversation.id)})

        self.assertEqual(deals_response.status_code, 200)
        self.assertEqual(_result_ids(deals_response), [self.deal.id])
        self.assertEqual(appointments_response.status_code, 200)
        self.assertEqual(_result_ids(appointments_response), [self.appointment.id])
        self.assertEqual(tasks_by_lead_response.status_code, 200)
        self.assertEqual(set(_result_ids(tasks_by_lead_response)), {self.task.id, self.conversation_only_task.id})
        self.assertEqual(tasks_by_deal_response.status_code, 200)
        self.assertEqual(set(_result_ids(tasks_by_deal_response)), {self.task.id, self.conversation_only_task.id})
        self.assertEqual(tasks_by_appointment_response.status_code, 200)
        self.assertEqual(_result_ids(tasks_by_appointment_response), [self.task.id])
        self.assertEqual(tasks_by_conversation_response.status_code, 200)
        self.assertEqual(set(_result_ids(tasks_by_conversation_response)), {self.task.id, self.conversation_only_task.id})

    def test_workspace_inbox_filters_are_relation_and_tenant_scoped(self):
        self.api.force_authenticate(self.owner)

        client_response = self.api.get("/api/inbox/conversations/", {"client_ids": f"{self.client.id},{self.other_client.id}"})
        lead_response = self.api.get("/api/inbox/conversations/", {"lead_ids[]": [self.lead.id]})
        deal_response = self.api.get("/api/inbox/conversations/", {"deal_ids": str(self.deal.id)})
        foreign_response = self.api.get("/api/inbox/conversations/", {"deal_ids": str(self.other_deal.id)})

        self.assertEqual(client_response.status_code, 200)
        self.assertEqual(_result_ids(client_response), [self.conversation.id])
        self.assertEqual(lead_response.status_code, 200)
        self.assertEqual(_result_ids(lead_response), [self.conversation.id])
        self.assertEqual(deal_response.status_code, 200)
        self.assertEqual(_result_ids(deal_response), [self.conversation.id])
        self.assertEqual(foreign_response.status_code, 200)
        self.assertEqual(_result_ids(foreign_response), [])
