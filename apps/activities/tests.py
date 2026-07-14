from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.activities.models import ActivityEvent
from apps.activities.services import create_activity_event
from apps.activities.taxonomy import (
    EVENT_DEFINITIONS,
    TIMELINE_EVENT_TYPES,
    ActivityEvents,
    event_category,
    event_definition,
    event_domain,
    is_timeline_event,
    requires_audit_event,
)
from apps.bots.inbox_service import register_bot_message, send_outbound_message
from apps.bots.models import Bot, BotConversation, BotMessage
from apps.businesses.models import Business, BusinessMember
from apps.clients.models import Client
from apps.leads.models import Lead
from apps.scheduling.models import Appointment, WorkingHours
from apps.services.models import Service
from apps.tasks.models import Task


class ActivityTimelineUnificationTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.owner = User.objects.create_user(
            username="activity-owner",
            email="activity-owner@example.com",
            password="pass",
            role=User.Roles.BUSINESS_OWNER,
        )
        self.other_owner = User.objects.create_user(
            username="activity-other",
            email="activity-other@example.com",
            password="pass",
            role=User.Roles.BUSINESS_OWNER,
        )
        self.business = Business.objects.create(owner=self.owner, name="Activity Clinic", slug="activity-clinic", timezone="Asia/Almaty")
        self.other_business = Business.objects.create(owner=self.other_owner, name="Other Activity", slug="other-activity")
        BusinessMember.objects.create(business=self.business, user=self.owner, role=BusinessMember.Roles.OWNER)
        BusinessMember.objects.create(business=self.other_business, user=self.other_owner, role=BusinessMember.Roles.OWNER)
        self.client = Client.objects.create(business=self.business, full_name="Timeline Client", phone="+77015550111")
        self.service = Service.objects.create(business=self.business, name="Consultation", duration_minutes=60)
        self.api.force_authenticate(self.owner)

    def test_lead_create_and_status_change_write_timeline_events(self):
        create_response = self.api.post(
            "/api/leads/",
            {
                "business": self.business.id,
                "client": self.client.id,
                "service": self.service.id,
                "source": Lead.Sources.WEBSITE,
                "message": "Need help",
            },
            format="json",
        )
        self.assertEqual(create_response.status_code, 201)
        lead_id = create_response.data["id"]

        update_response = self.api.post(f"/api/leads/{lead_id}/mark-contacted/", {}, format="json")

        self.assertEqual(update_response.status_code, 200)
        self.assertTrue(ActivityEvent.objects.filter(business=self.business, client=self.client, event_type="lead_created").exists())
        self.assertTrue(ActivityEvent.objects.filter(business=self.business, client=self.client, event_type="lead_contacted").exists())

    def test_appointment_create_cancel_and_task_complete_write_timeline_events(self):
        start_at = datetime(2026, 5, 13, 10, 0, tzinfo=ZoneInfo("Asia/Almaty"))
        WorkingHours.objects.create(
            business=self.business,
            weekday=start_at.weekday(),
            start_time=start_at.time().replace(hour=9, minute=0),
            end_time=start_at.time().replace(hour=18, minute=0),
        )
        appointment_response = self.api.post(
            "/api/appointments/",
            {
                "business": self.business.id,
                "client": self.client.id,
                "service": self.service.id,
                "start_at": start_at.isoformat(),
                "end_at": (start_at + timedelta(hours=1)).isoformat(),
                "source": Appointment.Sources.MANUAL,
            },
            format="json",
        )
        self.assertEqual(appointment_response.status_code, 201)
        appointment_id = appointment_response.data["id"]

        cancel_response = self.api.post(
            f"/api/appointments/{appointment_id}/cancel/",
            {"reason": "Client asked to cancel"},
            format="json",
        )
        task_response = self.api.post(
            "/api/tasks/",
            {"business": self.business.id, "client": self.client.id, "title": "Follow up"},
            format="json",
        )
        complete_response = self.api.post(f"/api/tasks/{task_response.data['id']}/complete/")

        self.assertEqual(cancel_response.status_code, 200)
        self.assertEqual(task_response.status_code, 201)
        self.assertEqual(complete_response.status_code, 200)
        self.assertTrue(ActivityEvent.objects.filter(event_type="appointment_created", client=self.client).exists())
        self.assertTrue(ActivityEvent.objects.filter(event_type="appointment_cancelled", client=self.client).exists())
        self.assertTrue(ActivityEvent.objects.filter(event_type="task_created", client=self.client).exists())
        self.assertTrue(ActivityEvent.objects.filter(event_type="task_completed", client=self.client).exists())

    def test_message_received_and_sent_write_timeline_events(self):
        bot = Bot.objects.create(business=self.business, name="Timeline bot")
        conversation = BotConversation.objects.create(
            business=self.business,
            bot=bot,
            channel=BotConversation.Channels.WEBSITE,
            client=self.client,
            external_user_id="visitor-timeline",
        )
        inbound = BotMessage.objects.create(
            conversation=conversation,
            direction=BotMessage.Directions.INBOUND,
            text="Hello",
        )
        register_bot_message(inbound)
        send_outbound_message(conversation, "Добрый день", self.owner)

        self.assertTrue(
            ActivityEvent.objects.filter(
                event_type=ActivityEvents.MESSAGE_RECEIVED,
                client=self.client,
                metadata__event_type=ActivityEvents.MESSAGE_RECEIVED,
                metadata__conversation_id=conversation.id,
            ).exists()
        )
        self.assertTrue(
            ActivityEvent.objects.filter(
                event_type=ActivityEvents.MESSAGE_SENT,
                client=self.client,
                metadata__event_type=ActivityEvents.MESSAGE_SENT,
                metadata__conversation_id=conversation.id,
            ).exists()
        )

    def test_activity_event_aliases_are_stored_as_canonical_taxonomy(self):
        event = create_activity_event(
            business=self.business,
            client=self.client,
            actor=self.owner,
            event_type="deal_marked_won",
            text="",
        )

        self.assertEqual(event.event_type, ActivityEvents.DEAL_WON)
        self.assertEqual(event.text, "Сделка выиграна")

    def test_activity_event_taxonomy_defines_core_crm_timeline_contract(self):
        event_values = {
            value
            for name, value in vars(ActivityEvents).items()
            if name.isupper() and isinstance(value, str)
        }

        self.assertTrue(event_values.issubset(EVENT_DEFINITIONS.keys()))
        for event_type in event_values:
            definition = event_definition(event_type)
            self.assertEqual(definition.event_type, event_type)
            self.assertIn(definition.category, ActivityEvent.Categories.values)
            self.assertTrue(definition.domain)
            self.assertTrue(definition.label)
            self.assertTrue(is_timeline_event(event_type))
            self.assertEqual(event_category(event_type), definition.category)
            self.assertIn(event_type, TIMELINE_EVENT_TYPES)

        self.assertEqual(event_domain(ActivityEvents.DEAL_WON), "deals")
        self.assertTrue(requires_audit_event(ActivityEvents.DEAL_WON))
        self.assertTrue(requires_audit_event(ActivityEvents.APPOINTMENT_CANCELLED))
        self.assertFalse(requires_audit_event(ActivityEvents.MESSAGE_RECEIVED))

    def test_activity_event_without_instance_uses_taxonomy_category(self):
        event = create_activity_event(
            business=self.business,
            actor=self.owner,
            event_type=ActivityEvents.DEAL_VALUE_CHANGED,
        )

        self.assertEqual(event.category, ActivityEvent.Categories.CRM)
        self.assertEqual(event.text, "Изменена сумма сделки")

    def test_activity_event_filters_are_tenant_safe(self):
        own_event = ActivityEvent.objects.create(
            business=self.business,
            client=self.client,
            category=ActivityEvent.Categories.CRM,
            event_type="client_created",
            entity_type="Client",
            entity_id=str(self.client.id),
            text="Visible",
        )
        ActivityEvent.objects.create(
            business=self.other_business,
            category=ActivityEvent.Categories.CRM,
            event_type="client_created",
            entity_type="Client",
            entity_id="999",
            text="Hidden",
        )

        response = self.api.get(
            "/api/activity-events/",
            {"client": self.client.id, "entity_type": "Client", "entity_id": self.client.id, "event_type": "client_created"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["id"], own_event.id)

    def test_activity_event_metadata_masks_secret_error_text(self):
        ActivityEvent.objects.create(
            business=self.business,
            client=self.client,
            category=ActivityEvent.Categories.SYSTEM,
            event_type="delivery_failed",
            text="Delivery failed",
            metadata={"result": {"reason": "Provider failed with token=raw-activity-token"}},
        )
        self.api.force_authenticate(self.owner)

        response = self.api.get("/api/activity-events/", {"event_type": "delivery_failed"})

        self.assertEqual(response.status_code, 200)
        self.assertNotIn("raw-activity-token", str(response.data))
