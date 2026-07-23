from datetime import time

from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.activities.models import Note
from apps.automations.engine import process_automation_run, run_automations_for_event, run_task_overdue_automations
from apps.automations.models import AutomationAction, AutomationRule, AutomationRun
from apps.bots.models import Bot, BotChannel, BotConversation, BotMessage
from apps.businesses.models import Business, BusinessMember
from apps.clients.models import Client
from apps.crm.models import Deal, Pipeline, PipelineStage
from apps.crm.services import move_deal_stage
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
        self.manager = User.objects.create_user(
            username="automation-manager",
            email="automation-manager@example.com",
            password="pass",
            role=User.Roles.BUSINESS_MANAGER,
        )
        BusinessMember.objects.create(business=self.business, user=self.manager, role=BusinessMember.Roles.MANAGER)
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

    def test_notification_action_without_client_routes_to_owner_without_failure(self):
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
        self.assertEqual(runs[0].status, AutomationRun.Statuses.SUCCESS)
        self.assertEqual(runs[0].error, "")
        self.assertTrue(Notification.objects.filter(text="Needs client", recipient=self.manager).exists())

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

    def test_action_api_rejects_actions_not_supported_by_runtime(self):
        rule = self._rule(AutomationRule.TriggerTypes.LEAD_CREATED, [])
        self.api.force_authenticate(self.owner)

        response = self.api.post(
            "/api/automation-actions/",
            {
                "rule": rule.id,
                "action_type": AutomationAction.ActionTypes.WEBHOOK,
                "config": {"url": "https://example.com/hook"},
                "order": 0,
                "delay_seconds": 0,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("action_type", response.data)
        self.assertFalse(AutomationAction.objects.filter(rule=rule).exists())

    def test_action_api_requires_positive_wait_delay(self):
        rule = self._rule(AutomationRule.TriggerTypes.LEAD_CREATED, [])
        self.api.force_authenticate(self.owner)

        response = self.api.post(
            "/api/automation-actions/",
            {
                "rule": rule.id,
                "action_type": AutomationAction.ActionTypes.WAIT,
                "config": {},
                "order": 0,
                "delay_seconds": 0,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("delay_seconds", response.data)
        self.assertFalse(AutomationAction.objects.filter(rule=rule).exists())

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
        self.assertEqual(run.status, AutomationRun.Statuses.WAITING)
        self.assertEqual(run.current_action_index, 1)
        self.assertIsNotNone(run.run_after)
        self.assertFalse(Task.objects.filter(business=self.business, title="Delayed follow up").exists())

    def test_failed_automation_can_be_retried_from_api(self):
        rule = self._rule(
            AutomationRule.TriggerTypes.BOT_MESSAGE_RECEIVED,
            [
                {
                    "action_type": AutomationAction.ActionTypes.ASSIGN_USER,
                    "config": {"user_id": 999999},
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
        self.assertEqual(run.status, AutomationRun.Statuses.RETRY_SCHEDULED)
        self.assertEqual(run.attempts, 1)
        self.assertIsNotNone(run.next_retry_at)

        action = rule.actions.first()
        action.config = {"user_id": self.manager.id}
        action.save(update_fields=["config"])
        self.api.force_authenticate(self.owner)
        response = self.api.post(f"/api/automation-runs/{run.id}/retry/")

        self.assertEqual(response.status_code, 200)
        run.refresh_from_db()
        conversation.refresh_from_db()
        self.assertEqual(run.status, AutomationRun.Statuses.SUCCESS)
        self.assertEqual(run.attempts, 2)
        self.assertEqual(conversation.assigned_to, self.manager)

    def test_phase10_triggers_and_actions_are_declared(self):
        self.assertEqual(AutomationRule.TriggerTypes.LEAD_STATUS_CHANGED, "lead_status_changed")
        self.assertEqual(AutomationRule.TriggerTypes.DEAL_STAGE_CHANGED, "deal_stage_changed")
        self.assertEqual(AutomationRule.TriggerTypes.APPOINTMENT_COMPLETED, "appointment_completed")
        self.assertEqual(AutomationRule.TriggerTypes.CONVERSATION_UNREAD, "conversation_unread")
        self.assertEqual(AutomationRule.TriggerTypes.TASK_OVERDUE, "task_overdue")
        self.assertEqual(AutomationAction.ActionTypes.ASSIGN_USER, "assign_user")
        self.assertEqual(AutomationAction.ActionTypes.ADD_NOTE, "add_note")
        self.assertEqual(AutomationAction.ActionTypes.CREATE_FOLLOW_UP, "create_follow_up")

    def test_lead_status_changed_rule_runs_from_lead_service(self):
        self._rule(
            AutomationRule.TriggerTypes.LEAD_STATUS_CHANGED,
            [{"action_type": AutomationAction.ActionTypes.CREATE_TASK, "config": {"title": "Lead status changed"}}],
        )
        lead = Lead.objects.create(business=self.business, client=self.client, service=self.service)
        self.api.force_authenticate(self.owner)

        response = self.api.post(f"/api/leads/{lead.id}/mark-contacted/")

        self.assertEqual(response.status_code, 200)
        self.assertTrue(Task.objects.filter(business=self.business, lead=lead, title="Lead status changed").exists())
        run = AutomationRun.objects.get(trigger_type=AutomationRule.TriggerTypes.LEAD_STATUS_CHANGED)
        self.assertEqual(run.status, AutomationRun.Statuses.SUCCESS)
        self.assertEqual(run.payload["from_status"], Lead.Statuses.NEW)
        self.assertEqual(run.payload["to_status"], Lead.Statuses.CONTACTED)

    def test_deal_stage_changed_rule_runs_from_deal_service(self):
        self._rule(
            AutomationRule.TriggerTypes.DEAL_STAGE_CHANGED,
            [{"action_type": AutomationAction.ActionTypes.ADD_NOTE, "config": {"text": "Deal moved by automation trigger"}}],
        )
        pipeline = Pipeline.objects.create(business=self.business, name="Sales", slug="automation-sales")
        first_stage = PipelineStage.objects.create(business=self.business, pipeline=pipeline, name="New", order=1, probability=10)
        next_stage = PipelineStage.objects.create(business=self.business, pipeline=pipeline, name="Offer", order=2, probability=50)
        deal = Deal.objects.create(
            business=self.business,
            client=self.client,
            pipeline=pipeline,
            stage=first_stage,
            title="Automation deal",
            owner=self.owner,
            probability=first_stage.probability,
        )

        move_deal_stage(deal=deal, stage=next_stage, actor=self.owner, source="test")

        run = AutomationRun.objects.get(trigger_type=AutomationRule.TriggerTypes.DEAL_STAGE_CHANGED)
        self.assertEqual(run.status, AutomationRun.Statuses.SUCCESS)
        self.assertEqual(run.payload["from_stage"], first_stage.id)
        self.assertEqual(run.payload["to_stage"], next_stage.id)
        self.assertTrue(Note.objects.filter(business=self.business, entity_type="Deal", entity_id=str(deal.id)).exists())

    def test_appointment_completed_rule_runs_from_lifecycle_service(self):
        self._rule(
            AutomationRule.TriggerTypes.APPOINTMENT_COMPLETED,
            [{"action_type": AutomationAction.ActionTypes.CREATE_FOLLOW_UP, "config": {"title": "Post-visit follow-up"}}],
        )
        appointment = Appointment.objects.create(
            business=self.business,
            client=self.client,
            service=self.service,
            start_at=timezone.now() + timezone.timedelta(days=1),
            end_at=timezone.now() + timezone.timedelta(days=1, hours=1),
        )
        self.api.force_authenticate(self.owner)

        response = self.api.post(f"/api/appointments/{appointment.id}/complete/")

        self.assertEqual(response.status_code, 200)
        self.assertTrue(Task.objects.filter(business=self.business, appointment=appointment, title="Post-visit follow-up").exists())
        run = AutomationRun.objects.get(trigger_type=AutomationRule.TriggerTypes.APPOINTMENT_COMPLETED)
        self.assertEqual(run.status, AutomationRun.Statuses.SUCCESS)

    def test_task_overdue_emitter_is_idempotent(self):
        rule = self._rule(
            AutomationRule.TriggerTypes.TASK_OVERDUE,
            [{"action_type": AutomationAction.ActionTypes.CREATE_FOLLOW_UP, "config": {"title": "Escalate overdue task"}}],
        )
        task = Task.objects.create(
            business=self.business,
            title="Overdue source task",
            client=self.client,
            due_at=timezone.now() - timezone.timedelta(hours=2),
        )

        first_runs = run_task_overdue_automations(business=self.business)
        second_runs = run_task_overdue_automations(business=self.business)

        self.assertEqual(first_runs[0].id, second_runs[0].id)
        self.assertEqual(AutomationRun.objects.filter(rule=rule, entity_type="Task", entity_id=str(task.id)).count(), 1)
        self.assertEqual(Task.objects.filter(business=self.business, title="Escalate overdue task").count(), 1)

    def test_conversation_unread_rule_runs_from_inbox_service(self):
        self._rule(
            AutomationRule.TriggerTypes.CONVERSATION_UNREAD,
            [{"action_type": AutomationAction.ActionTypes.ADD_NOTE, "config": {"text": "Conversation became unread"}}],
        )
        bot = Bot.objects.create(business=self.business, name="Unread bot")
        conversation = BotConversation.objects.create(
            business=self.business,
            bot=bot,
            channel=BotConversation.Channels.TELEGRAM,
            external_user_id="unread-chat",
        )
        message = BotMessage.objects.create(conversation=conversation, direction=BotMessage.Directions.INBOUND, text="Hello")

        from apps.bots.inbox_service import register_bot_message

        register_bot_message(message)

        conversation.refresh_from_db()
        self.assertEqual(conversation.unread_count, 1)
        run = AutomationRun.objects.get(trigger_type=AutomationRule.TriggerTypes.CONVERSATION_UNREAD)
        self.assertEqual(run.status, AutomationRun.Statuses.SUCCESS)
        self.assertTrue(Note.objects.filter(business=self.business, entity_type="BotConversation", entity_id=str(conversation.id)).exists())

    def test_pending_automation_run_can_be_cancelled_from_api(self):
        self._rule(
            AutomationRule.TriggerTypes.LEAD_CREATED,
            [
                {"action_type": AutomationAction.ActionTypes.WAIT, "delay_seconds": 300, "config": {}},
                {"action_type": AutomationAction.ActionTypes.CREATE_TASK, "config": {"title": "Should stay cancelled"}},
            ],
        )
        lead = Lead.objects.create(business=self.business, client=self.client, service=self.service)
        run = run_automations_for_event(
            business=self.business,
            trigger_type=AutomationRule.TriggerTypes.LEAD_CREATED,
            entity=lead,
            payload={"trigger_type": AutomationRule.TriggerTypes.LEAD_CREATED},
        )[0]
        self.api.force_authenticate(self.owner)

        response = self.api.post(f"/api/automation-runs/{run.id}/cancel/")

        self.assertEqual(response.status_code, 200)
        run.refresh_from_db()
        self.assertEqual(run.status, AutomationRun.Statuses.CANCELLED)
        self.assertFalse(Task.objects.filter(business=self.business, title="Should stay cancelled").exists())

    def test_run_cancel_requires_automation_manage_permission(self):
        self._rule(
            AutomationRule.TriggerTypes.LEAD_CREATED,
            [{"action_type": AutomationAction.ActionTypes.WAIT, "delay_seconds": 300, "config": {}}],
        )
        lead = Lead.objects.create(business=self.business, client=self.client, service=self.service)
        run = run_automations_for_event(
            business=self.business,
            trigger_type=AutomationRule.TriggerTypes.LEAD_CREATED,
            entity=lead,
            payload={"trigger_type": AutomationRule.TriggerTypes.LEAD_CREATED},
        )[0]
        self.api.force_authenticate(self.manager)

        response = self.api.post(f"/api/automation-runs/{run.id}/cancel/")

        self.assertIn(response.status_code, {403, 404})
        run.refresh_from_db()
        self.assertEqual(run.status, AutomationRun.Statuses.WAITING)

    @override_settings(AUTOMATION_RULE_RUN_LIMIT=1, AUTOMATION_RULE_RUN_WINDOW_MINUTES=10)
    def test_noisy_rule_is_throttled_per_business(self):
        rule = self._rule(
            AutomationRule.TriggerTypes.LEAD_CREATED,
            [{"action_type": AutomationAction.ActionTypes.CREATE_TASK, "config": {"title": "Noisy follow-up"}}],
        )
        first_lead = Lead.objects.create(business=self.business, client=self.client, service=self.service)
        second_lead = Lead.objects.create(business=self.business, client=self.client, service=self.service)

        first_run = run_automations_for_event(
            business=self.business,
            trigger_type=AutomationRule.TriggerTypes.LEAD_CREATED,
            entity=first_lead,
            payload={"trigger_type": AutomationRule.TriggerTypes.LEAD_CREATED, "lead_id": first_lead.id},
        )[0]
        second_run = run_automations_for_event(
            business=self.business,
            trigger_type=AutomationRule.TriggerTypes.LEAD_CREATED,
            entity=second_lead,
            payload={"trigger_type": AutomationRule.TriggerTypes.LEAD_CREATED, "lead_id": second_lead.id},
        )[0]

        first_run.refresh_from_db()
        second_run.refresh_from_db()
        self.assertEqual(first_run.status, AutomationRun.Statuses.SUCCESS)
        self.assertEqual(second_run.status, AutomationRun.Statuses.SKIPPED)
        self.assertIn("throttled", second_run.error)
        self.assertEqual(Task.objects.filter(business=self.business, title="Noisy follow-up").count(), 1)
