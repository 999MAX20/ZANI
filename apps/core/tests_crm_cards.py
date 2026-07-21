from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import User
from django.core.files.base import ContentFile

from apps.activities.models import ActivityEvent, Note
from apps.activities.taxonomy import ActivityEvents
from apps.bots.models import Bot, BotConversation, BotMessage
from apps.businesses.models import Business, BusinessMember
from apps.clients.models import Client
from apps.crm.models import Deal, Pipeline, PipelineStage
from apps.core.models import FileAttachment
from apps.leads.models import Lead
from apps.outreach.models import OutreachConsent
from apps.scheduling.models import Appointment, Resource
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
        self.support_user = User.objects.create_user(
            username="crm-card-support",
            email="crm-card-support@example.com",
            password="pass",
            role=User.Roles.BUSINESS_OPERATOR,
        )
        self.business = Business.objects.create(owner=self.owner, name="CRM Card Clinic", slug="crm-card-clinic")
        self.other_business = Business.objects.create(owner=self.other_owner, name="Other CRM Card", slug="other-crm-card")
        BusinessMember.objects.create(business=self.business, user=self.owner, role=BusinessMember.Roles.OWNER)
        BusinessMember.objects.create(business=self.business, user=self.support_user, role=BusinessMember.Roles.SUPPORT)
        BusinessMember.objects.create(business=self.other_business, user=self.other_owner, role=BusinessMember.Roles.OWNER)

        self.client = Client.objects.create(
            business=self.business,
            full_name="CRM Card Client",
            phone="+77015550123",
            email="client@example.com",
            source_detail="Spring landing",
            source_context_json={"campaign": "spring", "page_domain": "example.com"},
        )
        self.service = Service.objects.create(business=self.business, name="Consultation", duration_minutes=60)
        self.resource = Resource.objects.create(business=self.business, name="Doctor A")
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
            resource=self.resource,
            start_at=start_at,
            end_at=start_at + timedelta(hours=1),
        )
        self.task = Task.objects.create(
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
        OutreachConsent.objects.create(
            business=self.business,
            client=self.client,
            channel=OutreachConsent.Channels.WHATSAPP,
            status=OutreachConsent.Statuses.OPTED_IN,
            source="lead_form",
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
        self.assertEqual(response.data["client"]["source_detail"], "Spring landing")
        self.assertEqual(response.data["client"]["source_context_json"]["page_domain"], "example.com")
        self.assertEqual(response.data["lead"]["id"], self.lead.id)
        self.assertEqual(response.data["deal"]["id"], self.deal.id)
        self.assertEqual(response.data["appointment"]["id"], self.appointment.id)
        self.assertEqual(len(response.data["tasks"]), 1)
        self.assertEqual(len(response.data["conversations"]), 1)
        self.assertEqual(len(response.data["timeline"]), 1)
        self.assertEqual(len(response.data["notes"]), 1)
        self.assertEqual(response.data["primary_entity"], {"type": "client", "id": self.client.id})
        self.assertIn("create_deal", response.data["available_actions"])
        action_details = {item["id"]: item for item in response.data["available_action_details"]}
        self.assertEqual(set(action_details), set(response.data["available_actions"]))
        self.assertTrue(action_details["create_deal"]["allowed"])
        self.assertEqual(action_details["create_deal"]["resource"], "deals")
        self.assertEqual(action_details["create_deal"]["action"], "create")
        self.assertEqual(action_details["create_deal"]["scope"], "business")
        self.assertEqual(action_details["merge"]["confirmation"], "confirm")
        self.assertTrue(action_details["merge"]["destructive"])
        self.assertEqual(response.data["meta"]["related_counts"]["leads"], 1)
        self.assertFalse(response.data["meta"]["has_more"]["timeline"])
        consents = {item["channel"]: item for item in response.data["consents"]}
        self.assertEqual(consents[OutreachConsent.Channels.WHATSAPP]["status"], OutreachConsent.Statuses.OPTED_IN)
        self.assertEqual(consents[OutreachConsent.Channels.WHATSAPP]["source"], "lead_form")
        self.assertEqual(consents[OutreachConsent.Channels.TELEGRAM]["status"], OutreachConsent.Statuses.UNKNOWN)

    def test_client_crm_card_action_details_are_user_scoped(self):
        self.api.force_authenticate(self.support_user)

        response = self.api.get(f"/api/clients/{self.client.id}/crm-card/")

        self.assertEqual(response.status_code, 200)
        action_details = {item["id"]: item for item in response.data["available_action_details"]}
        self.assertFalse(action_details["create_task"]["allowed"])
        self.assertEqual(action_details["create_task"]["resource"], "tasks")
        self.assertEqual(action_details["create_task"]["action"], "create")
        self.assertEqual(action_details["create_task"]["scope"], "none")
        self.assertEqual(action_details["create_task"]["reason"], "Permission denied.")
        self.assertFalse(action_details["merge"]["allowed"])
        self.assertTrue(action_details["merge"]["destructive"])

    def test_lead_crm_card_action_details_expose_reason_actions(self):
        self.api.force_authenticate(self.owner)

        response = self.api.get(f"/api/leads/{self.lead.id}/crm-card/")

        self.assertEqual(response.status_code, 200)
        action_details = {item["id"]: item for item in response.data["available_action_details"]}
        self.assertTrue(action_details["lost"]["allowed"])
        self.assertEqual(action_details["lost"]["resource"], "leads")
        self.assertEqual(action_details["lost"]["action"], "update")
        self.assertTrue(action_details["lost"]["requires_reason"])
        self.assertFalse(action_details["lost"]["destructive"])
        self.assertEqual(action_details["lost"]["confirmation"], "reason")

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

    def test_client_crm_card_includes_tasks_linked_only_through_conversation(self):
        conversation_task = Task.objects.create(
            business=self.business,
            title="Follow up conversation",
            conversation=self.conversation,
        )
        self.api.force_authenticate(self.owner)

        response = self.api.get(f"/api/clients/{self.client.id}/crm-card/")

        self.assertEqual(response.status_code, 200)
        task_ids = {item["id"] for item in response.data["tasks"]}
        self.assertIn(self.task.id, task_ids)
        self.assertIn(conversation_task.id, task_ids)
        conversation_row = next(item for item in response.data["tasks"] if item["id"] == conversation_task.id)
        self.assertEqual(conversation_row["conversation"], self.conversation.id)

    def test_deal_crm_card_returns_linked_context_and_scoped_activity(self):
        self.api.force_authenticate(self.owner)
        ActivityEvent.objects.create(
            business=self.business,
            client=None,
            category=ActivityEvent.Categories.CRM,
            event_type=ActivityEvents.DEAL_STAGE_CHANGED,
            entity_type="Deal",
            entity_id=str(self.deal.id),
            text="Stage moved",
        )
        ActivityEvent.objects.create(
            business=self.other_business,
            category=ActivityEvent.Categories.CRM,
            event_type=ActivityEvents.DEAL_STAGE_CHANGED,
            entity_type="Deal",
            entity_id=str(self.deal.id),
            text="Foreign stage moved",
        )

        response = self.api.get(f"/api/deals/{self.deal.id}/crm-card/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["primary_entity"], {"type": "deal", "id": self.deal.id})
        self.assertEqual(response.data["deal"]["id"], self.deal.id)
        self.assertEqual(response.data["client"]["id"], self.client.id)
        self.assertEqual(response.data["lead"]["id"], self.lead.id)
        self.assertEqual({item["id"] for item in response.data["tasks"]}, {self.task.id})
        self.assertEqual({item["id"] for item in response.data["appointments"]}, {self.appointment.id})
        self.assertEqual(response.data["meta"]["related_counts"]["tasks"], 1)
        self.assertEqual(response.data["meta"]["related_counts"]["appointments"], 1)
        self.assertIn("won", response.data["available_actions"])
        self.assertIn("lost", response.data["available_actions"])
        returned_events = {event["text"] for event in response.data["timeline"]}
        self.assertIn("Stage moved", returned_events)
        self.assertIn("Deal created", returned_events)
        self.assertNotIn("Foreign stage moved", returned_events)

    def test_appointment_crm_card_includes_display_fields(self):
        self.api.force_authenticate(self.owner)

        response = self.api.get(f"/api/appointments/{self.appointment.id}/crm-card/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["appointment"]["client_name"], self.client.full_name)
        self.assertEqual(response.data["appointment"]["client_phone"], self.client.phone)
        self.assertEqual(response.data["appointment"]["service_name"], self.service.name)
        self.assertEqual(response.data["appointment"]["service_duration_minutes"], self.service.duration_minutes)
        self.assertEqual(response.data["appointment"]["resource_name"], self.resource.name)
        self.assertEqual(response.data["appointment"]["resource_type"], self.resource.resource_type)

    def test_crm_card_is_tenant_filtered(self):
        self.api.force_authenticate(self.other_owner)

        response = self.api.get(f"/api/clients/{self.client.id}/crm-card/")

        self.assertEqual(response.status_code, 404)

    def test_client_crm_card_timeline_includes_all_linked_entity_events(self):
        self.api.force_authenticate(self.owner)
        expected_events = {
            ActivityEvents.CLIENT_UPDATED,
            ActivityEvents.LEAD_CONTACTED,
            ActivityEvents.DEAL_WON,
            ActivityEvents.APPOINTMENT_CANCELLED,
            ActivityEvents.TASK_COMPLETED,
        }
        ActivityEvent.objects.create(
            business=self.business,
            client=self.client,
            category=ActivityEvent.Categories.CRM,
            event_type=ActivityEvents.CLIENT_UPDATED,
            entity_type="client",
            entity_id=str(self.client.id),
            text="Client updated",
        )
        ActivityEvent.objects.create(
            business=self.business,
            client=self.client,
            category=ActivityEvent.Categories.CRM,
            event_type=ActivityEvents.LEAD_CONTACTED,
            entity_type="Lead",
            entity_id=str(self.lead.id),
            text="Lead contacted",
        )
        ActivityEvent.objects.create(
            business=self.business,
            client=self.client,
            category=ActivityEvent.Categories.CRM,
            event_type=ActivityEvents.DEAL_WON,
            entity_type="Deal",
            entity_id=str(self.deal.id),
            text="Deal won",
        )
        ActivityEvent.objects.create(
            business=self.business,
            client=self.client,
            category=ActivityEvent.Categories.APPOINTMENT,
            event_type=ActivityEvents.APPOINTMENT_CANCELLED,
            entity_type="appointment",
            entity_id=str(self.appointment.id),
            text="Appointment cancelled",
        )
        ActivityEvent.objects.create(
            business=self.business,
            client=self.client,
            category=ActivityEvent.Categories.TASK,
            event_type=ActivityEvents.TASK_COMPLETED,
            entity_type="Task",
            entity_id=str(self.task.id),
            text="Task completed",
        )
        Note.objects.create(
            business=self.business,
            client=self.client,
            entity_type="deal",
            entity_id=str(self.deal.id),
            text="Lowercase deal note",
        )
        FileAttachment.objects.create(
            business=self.business,
            uploaded_by=self.owner,
            file=ContentFile(b"crm-card", name="card.txt"),
            original_name="card.txt",
            content_type="text/plain",
            size=8,
            entity_type="deal",
            entity_id=str(self.deal.id),
        )

        response = self.api.get(f"/api/clients/{self.client.id}/crm-card/")

        self.assertEqual(response.status_code, 200)
        returned_events = {event["event_type"] for event in response.data["timeline"]}
        self.assertTrue(expected_events.issubset(returned_events))
        returned_event_dates = [event["created_at"] for event in response.data["timeline"]]
        self.assertEqual(returned_event_dates, sorted(returned_event_dates, reverse=True))
        self.assertTrue(any(note["text"] == "Lowercase deal note" for note in response.data["notes"]))
        self.assertTrue(
            any(attachment["original_name"] == "card.txt" for attachment in response.data["attachments"]),
            response.data["attachments"],
        )
