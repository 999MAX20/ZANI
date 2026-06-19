from datetime import time

from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.automations.engine import process_automation_run, run_automations_for_event
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

    def test_automation_run_api_masks_secret_payload_results_and_error(self):
        rule = self._rule(AutomationRule.TriggerTypes.LEAD_CREATED, [])
        run = AutomationRun.objects.create(
            business=self.business,
            rule=rule,
            trigger_type=AutomationRule.TriggerTypes.LEAD_CREATED,
            status=AutomationRun.Statuses.FAILED,
            payload={"api_key": "raw-payload-key"},
            action_results=[{"reason": "Failed with token=raw-action-token"}],
            error="Failed with access_token=raw-error-token",
        )
        self.api.force_authenticate(self.owner)

        response = self.api.get("/api/automation-runs/")

        self.assertEqual(response.status_code, 200)
        self.assertNotIn("raw-payload-key", str(response.data))
        self.assertNotIn("raw-action-token", str(response.data))
        self.assertNotIn("raw-error-token", str(response.data))

        patch_response = self.api.patch(
            f"/api/automation-runs/{run.id}/",
            {"status": AutomationRun.Statuses.SUCCESS, "error": ""},
            format="json",
        )
        run.refresh_from_db()

        self.assertEqual(patch_response.status_code, 400)
        self.assertEqual(patch_response.data["fields"], ["error", "status"])
        self.assertEqual(run.status, AutomationRun.Statuses.FAILED)
        self.assertIn("access_token", run.error)

    def test_templates_can_be_listed_and_applied(self):
        self.api.force_authenticate(self.owner)

        templates_response = self.api.get("/api/automation-rules/templates/")
        apply_response = self.api.post(
            "/api/automation-rules/apply-template/",
            {
                "business": self.business.id,
                "template_key": "new_lead_create_task",
                "is_active": True,
            },
            format="json",
        )

        self.assertEqual(templates_response.status_code, 200)
        self.assertGreaterEqual(len(templates_response.data), 1)
        self.assertEqual(apply_response.status_code, 201)
        rule = AutomationRule.objects.get(id=apply_response.data["id"])
        self.assertTrue(rule.is_active)
        self.assertEqual(rule.trigger_type, AutomationRule.TriggerTypes.LEAD_CREATED)
        self.assertEqual(rule.actions.count(), 1)

    def test_manual_rule_preview_and_create(self):
        self.api.force_authenticate(self.owner)
        payload = {
            "business": self.business.id,
            "name": "Manual lead follow-up",
            "trigger_type": AutomationRule.TriggerTypes.LEAD_CREATED,
            "description": "Created from advanced builder",
            "is_active": False,
            "conditions": [{"field": "source", "operator": "eq", "value": {"value": Lead.Sources.WEBSITE}}],
            "actions": [
                {"action_type": AutomationAction.ActionTypes.WAIT, "delay_seconds": 60, "config": {}},
                {"action_type": AutomationAction.ActionTypes.CREATE_TASK, "config": {"title": "Manual follow up"}},
            ],
        }

        preview_response = self.api.post("/api/automation-rules/preview/", payload, format="json")
        create_response = self.api.post("/api/automation-rules/create-manual/", payload, format="json")

        self.assertEqual(preview_response.status_code, 200)
        self.assertTrue(preview_response.data["valid"])
        self.assertEqual(preview_response.data["actions_count"], 2)
        self.assertEqual(create_response.status_code, 201)
        rule = AutomationRule.objects.get(id=create_response.data["id"])
        self.assertEqual(rule.conditions.count(), 1)
        self.assertEqual(rule.actions.count(), 2)

    def test_manual_rule_rejects_invalid_actions(self):
        self.api.force_authenticate(self.owner)

        response = self.api.post(
            "/api/automation-rules/preview/",
            {
                "business": self.business.id,
                "name": "Invalid manual rule",
                "trigger_type": AutomationRule.TriggerTypes.LEAD_CREATED,
                "actions": [],
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)

    def test_duplicate_event_does_not_duplicate_automation_actions(self):
        rule = self._rule(
            AutomationRule.TriggerTypes.LEAD_CREATED,
            [
                {
                    "action_type": AutomationAction.ActionTypes.CREATE_TASK,
                    "config": {"title": "Idempotent follow up"},
                }
            ],
        )
        lead = Lead.objects.create(business=self.business, client=self.client, service=self.service)
        payload = {"trigger_type": AutomationRule.TriggerTypes.LEAD_CREATED, "source_event_id": "lead-1"}

        first_runs = run_automations_for_event(
            business=self.business,
            trigger_type=AutomationRule.TriggerTypes.LEAD_CREATED,
            entity=lead,
            payload=payload,
        )
        second_runs = run_automations_for_event(
            business=self.business,
            trigger_type=AutomationRule.TriggerTypes.LEAD_CREATED,
            entity=lead,
            payload=payload,
        )

        self.assertEqual(first_runs[0].id, second_runs[0].id)
        self.assertEqual(AutomationRun.objects.filter(rule=rule).count(), 1)
        self.assertEqual(Task.objects.filter(business=self.business, title="Idempotent follow up").count(), 1)

    def test_delayed_automation_run_is_not_executed_inline(self):
        rule = self._rule(
            AutomationRule.TriggerTypes.LEAD_CREATED,
            [
                {
                    "action_type": AutomationAction.ActionTypes.WAIT,
                    "delay_seconds": 300,
                    "config": {},
                },
                {
                    "action_type": AutomationAction.ActionTypes.CREATE_TASK,
                    "config": {"title": "Delayed follow up"},
                },
            ],
        )
        lead = Lead.objects.create(business=self.business, client=self.client, service=self.service)

        runs = run_automations_for_event(
            business=self.business,
            trigger_type=AutomationRule.TriggerTypes.LEAD_CREATED,
            entity=lead,
            payload={"trigger_type": AutomationRule.TriggerTypes.LEAD_CREATED},
        )

        run = runs[0]
        run.refresh_from_db()
        self.assertEqual(run.rule, rule)
        self.assertEqual(run.status, AutomationRun.Statuses.PENDING)
        self.assertIsNotNone(run.run_after)
        self.assertFalse(Task.objects.filter(business=self.business, title="Delayed follow up").exists())

    def test_failed_automation_can_be_retried_from_api(self):
        self._rule(
            AutomationRule.TriggerTypes.BOT_MESSAGE_RECEIVED,
            [
                {
                    "action_type": AutomationAction.ActionTypes.CREATE_NOTIFICATION,
                    "config": {"text": "Retry needs client"},
                }
            ],
        )
        bot = Bot.objects.create(business=self.business, name="Retry bot")
        conversation = BotConversation.objects.create(
            business=self.business,
            bot=bot,
            channel=BotConversation.Channels.TELEGRAM,
            external_user_id="retry-chat",
        )
        runs = run_automations_for_event(
            business=self.business,
            trigger_type=AutomationRule.TriggerTypes.BOT_MESSAGE_RECEIVED,
            entity=conversation,
            payload={"trigger_type": AutomationRule.TriggerTypes.BOT_MESSAGE_RECEIVED},
        )
        run = runs[0]
        run.refresh_from_db()
        self.assertEqual(run.status, AutomationRun.Statuses.FAILED)
        self.assertEqual(run.attempts, 1)
        self.assertIsNotNone(run.next_retry_at)

        conversation.client = self.client
        conversation.save(update_fields=["client", "updated_at"])
        self.api.force_authenticate(self.owner)
        response = self.api.post(f"/api/automation-runs/{run.id}/retry/")

        self.assertEqual(response.status_code, 200)
        run.refresh_from_db()
        self.assertEqual(run.status, AutomationRun.Statuses.SUCCESS)
        self.assertEqual(run.attempts, 2)
        self.assertTrue(Notification.objects.filter(business=self.business, text="Retry needs client").exists())
