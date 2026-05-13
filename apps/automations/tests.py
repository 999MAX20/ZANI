from datetime import time

from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.automations.engine import run_automations_for_event
from apps.automations.models import AutomationAction, AutomationRule, AutomationRun
from apps.bots.models import Bot, BotChannel, BotConversation, BotMessage
from apps.businesses.models import Business, BusinessMember
from apps.clients.models import Client
from apps.leads.models import Lead
from apps.notifications.models import Notification
from apps.scheduling.models import Appointment, Resource, WorkingHours
from apps.services.models import Service
from apps.tasks.models import Task


class AutomationFoundationTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.owner = User.objects.create_user(
            username="automation-owner",
            email="automation-owner@example.com",
            password="pass",
            role=User.Roles.BUSINESS_OWNER,
        )
        self.business = Business.objects.create(
            owner=self.owner,
            name="Automation Clinic",
            slug="automation-clinic",
            timezone="Asia/Almaty",
        )
        BusinessMember.objects.create(business=self.business, user=self.owner, role=BusinessMember.Roles.OWNER)
        self.client = Client.objects.create(
            business=self.business,
            full_name="Automation Client",
            phone="+77015550000",
        )
        self.service = Service.objects.create(
            business=self.business,
            name="Consultation",
            duration_minutes=60,
        )

    def _rule(self, trigger_type, actions):
        rule = AutomationRule.objects.create(
            business=self.business,
            name=f"{trigger_type} rule",
            trigger_type=trigger_type,
            is_active=True,
        )
        for order, action in enumerate(actions):
            AutomationAction.objects.create(rule=rule, order=order, **action)
        return rule

    def test_lead_created_rule_creates_task_notification_and_run_log(self):
        self._rule(
            AutomationRule.TriggerTypes.LEAD_CREATED,
            [
                {
                    "action_type": AutomationAction.ActionTypes.CREATE_TASK,
                    "config": {"title": "Call new lead", "priority": Task.Priorities.HIGH},
                },
                {
                    "action_type": AutomationAction.ActionTypes.CREATE_NOTIFICATION,
                    "config": {"text": "New lead needs attention", "channel": Notification.Channels.SYSTEM},
                },
            ],
        )
        self.api.force_authenticate(self.owner)

        response = self.api.post(
            "/api/leads/",
            {
                "business": self.business.id,
                "client": self.client.id,
                "service": self.service.id,
                "source": Lead.Sources.WEBSITE,
                "message": "Need a consultation",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        lead = Lead.objects.get(id=response.data["id"])
        self.assertTrue(Task.objects.filter(business=self.business, lead=lead, title="Call new lead").exists())
        self.assertTrue(
            Notification.objects.filter(
                business=self.business,
                client=self.client,
                text="New lead needs attention",
            ).exists()
        )
        run = AutomationRun.objects.get(trigger_type=AutomationRule.TriggerTypes.LEAD_CREATED)
        self.assertEqual(run.status, AutomationRun.Statuses.SUCCESS)
        self.assertEqual(run.entity_type, "Lead")
        self.assertEqual(run.entity_id, str(lead.id))

    def test_appointment_created_rule_runs_without_celery_worker(self):
        self._rule(
            AutomationRule.TriggerTypes.APPOINTMENT_CREATED,
            [
                {
                    "action_type": AutomationAction.ActionTypes.CREATE_TASK,
                    "config": {"title": "Prepare appointment"},
                }
            ],
        )
        resource = Resource.objects.create(business=self.business, name="Room 1")
        WorkingHours.objects.create(
            business=self.business,
            resource=resource,
            weekday=0,
            start_time=time(9, 0),
            end_time=time(18, 0),
        )
        self.api.force_authenticate(self.owner)

        response = self.api.post(
            "/api/appointments/",
            {
                "business": self.business.id,
                "client": self.client.id,
                "service": self.service.id,
                "resource": resource.id,
                "start_at": "2026-05-11T10:00:00+05:00",
                "end_at": "2026-05-11T11:00:00+05:00",
                "source": Appointment.Sources.MANUAL,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        appointment = Appointment.objects.get(id=response.data["id"])
        self.assertTrue(Task.objects.filter(business=self.business, title="Prepare appointment").exists())
        run = AutomationRun.objects.get(trigger_type=AutomationRule.TriggerTypes.APPOINTMENT_CREATED)
        self.assertEqual(run.status, AutomationRun.Statuses.SUCCESS)
        self.assertEqual(run.entity_type, "Appointment")
        self.assertEqual(run.entity_id, str(appointment.id))

    def test_bot_message_received_rule_creates_task_from_public_chat(self):
        self._rule(
            AutomationRule.TriggerTypes.BOT_MESSAGE_RECEIVED,
            [
                {
                    "action_type": AutomationAction.ActionTypes.CREATE_TASK,
                    "config": {"title": "Reply to website chat"},
                }
            ],
        )
        bot = Bot.objects.create(business=self.business, name="Website bot", status=Bot.Statuses.ACTIVE)
        channel = BotChannel.objects.create(
            bot=bot,
            channel=BotChannel.Channels.WEBSITE,
            status=BotChannel.Statuses.ACTIVE,
        )

        response = self.api.post(
            f"/api/public/website-chat/{channel.public_token}/conversations/",
            {
                "full_name": "Website Visitor",
                "phone": "+77015550101",
                "message": "Can I book?",
                "external_user_id": "visitor-automation",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        conversation = BotConversation.objects.get()
        self.assertTrue(Task.objects.filter(business=self.business, lead=conversation.lead, title="Reply to website chat").exists())
        run = AutomationRun.objects.get(trigger_type=AutomationRule.TriggerTypes.BOT_MESSAGE_RECEIVED)
        self.assertEqual(run.status, AutomationRun.Statuses.SUCCESS)
        self.assertEqual(run.entity_type, "BotConversation")
        self.assertEqual(run.entity_id, str(conversation.id))

    def test_inactive_rule_is_not_executed(self):
        rule = AutomationRule.objects.create(
            business=self.business,
            name="Inactive",
            trigger_type=AutomationRule.TriggerTypes.LEAD_CREATED,
            is_active=False,
        )
        AutomationAction.objects.create(
            rule=rule,
            action_type=AutomationAction.ActionTypes.CREATE_TASK,
            config={"title": "Should not exist"},
        )
        lead = Lead.objects.create(business=self.business, client=self.client, service=self.service)

        runs = run_automations_for_event(
            business=self.business,
            trigger_type=AutomationRule.TriggerTypes.LEAD_CREATED,
            entity=lead,
            payload={"trigger_type": AutomationRule.TriggerTypes.LEAD_CREATED},
        )

        self.assertEqual(runs, [])
        self.assertFalse(Task.objects.filter(title="Should not exist").exists())

    def test_notification_action_without_client_is_logged_as_failed_not_raised(self):
        rule = self._rule(
            AutomationRule.TriggerTypes.BOT_MESSAGE_RECEIVED,
            [
                {
                    "action_type": AutomationAction.ActionTypes.CREATE_NOTIFICATION,
                    "config": {"text": "Needs client"},
                }
            ],
        )
        bot = Bot.objects.create(business=self.business, name="No client bot")
        conversation = BotConversation.objects.create(
            business=self.business,
            bot=bot,
            channel=BotConversation.Channels.TELEGRAM,
            external_user_id="chat-1",
        )
        BotMessage.objects.create(conversation=conversation, direction=BotMessage.Directions.INBOUND, text="Hello")

        runs = run_automations_for_event(
            business=self.business,
            trigger_type=AutomationRule.TriggerTypes.BOT_MESSAGE_RECEIVED,
            entity=conversation,
            payload={"trigger_type": AutomationRule.TriggerTypes.BOT_MESSAGE_RECEIVED},
        )

        self.assertEqual(len(runs), 1)
        runs[0].refresh_from_db()
        self.assertEqual(runs[0].rule, rule)
        self.assertEqual(runs[0].status, AutomationRun.Statuses.FAILED)
        self.assertIn("requires entity.client", runs[0].error)
        self.assertFalse(Notification.objects.filter(text="Needs client").exists())
