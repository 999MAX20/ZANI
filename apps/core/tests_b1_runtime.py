from types import SimpleNamespace
from unittest.mock import patch

from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.ai_core.models import AIJob, AIRequestLog, AIToolCallLog, ApprovalRequest
from apps.ai_core.services import process_ai_job
from apps.automations.engine import process_due_automation_runs, recover_stale_automation_runs, run_automations_for_event
from apps.automations.models import AutomationAction, AutomationRule, AutomationRun
from apps.businesses.models import Business, BusinessMember
from apps.clients.models import Client
from apps.leads.models import Lead
from apps.notifications.delivery import claim_notification, deliver_notification, process_due_notifications
from apps.notifications.models import Notification
from apps.tasks.models import Task


class B1RuntimeReliabilityTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.owner = User.objects.create_user(
            username="b1-owner@example.com",
            email="b1-owner@example.com",
            password="pass12345",
            role=User.Roles.BUSINESS_OWNER,
        )
        self.other_owner = User.objects.create_user(
            username="b1-other@example.com",
            email="b1-other@example.com",
            password="pass12345",
            role=User.Roles.BUSINESS_OWNER,
        )
        self.business = Business.objects.create(owner=self.owner, name="B1 Clinic", slug="b1-clinic")
        self.other_business = Business.objects.create(owner=self.other_owner, name="B1 Other", slug="b1-other")
        BusinessMember.objects.create(business=self.business, user=self.owner, role=BusinessMember.Roles.OWNER)
        BusinessMember.objects.create(business=self.other_business, user=self.other_owner, role=BusinessMember.Roles.OWNER)
        self.client = Client.objects.create(
            business=self.business,
            full_name="B1 Client",
            email="client@example.com",
        )
        self.api.force_authenticate(self.owner)

    def _notification(self, **overrides):
        values = {
            "business": self.business,
            "client": self.client,
            "channel": Notification.Channels.SYSTEM,
            "category": Notification.Categories.SYSTEM,
            "text": "B1 delivery",
            "send_at": timezone.now() - timezone.timedelta(minutes=1),
        }
        values.update(overrides)
        return Notification.objects.create(**values)

    def _automation(self, actions):
        rule = AutomationRule.objects.create(
            business=self.business,
            name="B1 runtime rule",
            trigger_type=AutomationRule.TriggerTypes.LEAD_CREATED,
            is_active=True,
        )
        for index, values in enumerate(actions):
            AutomationAction.objects.create(rule=rule, order=index, **values)
        lead = Lead.objects.create(business=self.business, client=self.client)
        run = run_automations_for_event(
            business=self.business,
            trigger_type=AutomationRule.TriggerTypes.LEAD_CREATED,
            entity=lead,
            payload={"trigger_type": AutomationRule.TriggerTypes.LEAD_CREATED},
        )[0]
        run.refresh_from_db()
        return rule, run

    def test_notification_claim_prevents_duplicate_delivery(self):
        notification = self._notification()

        first_claim = claim_notification(notification.id)
        second_claim = claim_notification(notification.id)
        result = deliver_notification(first_claim, claimed=True)

        self.assertIsNotNone(first_claim)
        self.assertIsNone(second_claim)
        self.assertEqual(result["status"], "sent")
        notification.refresh_from_db()
        self.assertEqual(notification.status, Notification.Statuses.SENT)
        self.assertEqual(notification.attempts, 1)
        self.assertIsNotNone(notification.delivered_at)
        self.assertEqual(process_due_notifications(), [])

    def test_transient_notification_failure_retries_then_delivers(self):
        notification = self._notification(channel=Notification.Channels.EMAIL)

        with patch("apps.notifications.delivery.send_mail", side_effect=RuntimeError("temporary provider timeout")):
            first = process_due_notifications()

        notification.refresh_from_db()
        self.assertEqual(first[0]["status"], Notification.Statuses.RETRY_SCHEDULED)
        self.assertEqual(notification.status, Notification.Statuses.RETRY_SCHEDULED)
        notification.next_retry_at = timezone.now() - timezone.timedelta(seconds=1)
        notification.save(update_fields=["next_retry_at", "updated_at"])

        with patch("apps.notifications.delivery.send_mail", return_value=1):
            second = process_due_notifications()

        notification.refresh_from_db()
        self.assertEqual(second[0]["status"], Notification.Statuses.SENT)
        self.assertEqual(notification.status, Notification.Statuses.SENT)
        self.assertEqual(notification.attempts, 2)

    def test_wait_resumes_at_next_action_without_replay(self):
        _, run = self._automation(
            [
                {"action_type": AutomationAction.ActionTypes.WAIT, "delay_seconds": 60},
                {"action_type": AutomationAction.ActionTypes.CREATE_TASK, "config": {"title": "B1 resumed task"}},
            ]
        )
        self.assertEqual(run.status, AutomationRun.Statuses.WAITING)
        self.assertEqual(run.current_action_index, 1)
        run.run_after = timezone.now() - timezone.timedelta(seconds=1)
        run.save(update_fields=["run_after"])

        process_due_automation_runs()
        process_due_automation_runs()

        run.refresh_from_db()
        self.assertEqual(run.status, AutomationRun.Statuses.SUCCESS)
        self.assertEqual(run.current_action_index, 2)
        self.assertEqual(Task.objects.filter(business=self.business, title="B1 resumed task").count(), 1)

    def test_retry_resumes_failed_action_and_stale_claim_is_recovered(self):
        rule, run = self._automation(
            [{"action_type": AutomationAction.ActionTypes.ASSIGN_USER, "config": {"user_id": 999999}}]
        )
        self.assertEqual(run.status, AutomationRun.Statuses.RETRY_SCHEDULED)
        action = rule.actions.get()
        action.config = {"user_id": self.owner.id}
        action.save(update_fields=["config"])
        run.next_retry_at = timezone.now() - timezone.timedelta(seconds=1)
        run.save(update_fields=["next_retry_at"])

        process_due_automation_runs()
        run.refresh_from_db()
        self.assertEqual(run.status, AutomationRun.Statuses.SUCCESS)

        run.status = AutomationRun.Statuses.RUNNING
        run.locked_at = timezone.now() - timezone.timedelta(hours=1)
        run.save(update_fields=["status", "locked_at"])
        recovered = recover_stale_automation_runs()
        run.refresh_from_db()
        self.assertEqual(recovered, 1)
        self.assertEqual(run.status, AutomationRun.Statuses.RETRY_SCHEDULED)

    def test_approved_ai_tool_executes_exactly_once(self):
        log = AIToolCallLog.objects.create(
            business=self.business,
            user=self.owner,
            tool_name="create_task",
            input_json={"title": "B1 exactly once"},
        )
        created = self.api.post(
            "/api/ai/approval-requests/",
            {
                "business": self.business.id,
                "action_type": ApprovalRequest.ActionTypes.AI_PIPELINE,
                "ai_tool_call_log": log.id,
            },
            format="json",
        )
        approval = ApprovalRequest.objects.get(id=created.data["id"])
        self.api.post(f"/api/ai/approval-requests/{approval.id}/approve/", format="json")

        first = self.api.post(f"/api/ai/tools/{log.id}/execute/", {"approval_id": approval.id}, format="json")
        second = self.api.post(f"/api/ai/tools/{log.id}/execute/", {"approval_id": approval.id}, format="json")

        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(Task.objects.filter(business=self.business, title="B1 exactly once").count(), 1)
        log.refresh_from_db()
        self.assertEqual(log.attempts, 1)

    def test_approval_rejects_changed_tool_arguments(self):
        log = AIToolCallLog.objects.create(
            business=self.business,
            user=self.owner,
            tool_name="create_task",
            input_json={"title": "Approved title"},
        )
        created = self.api.post(
            "/api/ai/approval-requests/",
            {
                "business": self.business.id,
                "action_type": ApprovalRequest.ActionTypes.AI_PIPELINE,
                "ai_tool_call_log": log.id,
            },
            format="json",
        )
        approval = ApprovalRequest.objects.get(id=created.data["id"])
        self.api.post(f"/api/ai/approval-requests/{approval.id}/approve/", format="json")
        log.input_json = {"title": "Changed after approval"}
        log.save(update_fields=["input_json"])

        response = self.api.post(f"/api/ai/tools/{log.id}/execute/", {"approval_id": approval.id}, format="json")

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.data["approval_status"], "approval_payload_mismatch")
        self.assertFalse(Task.objects.filter(title="Changed after approval").exists())

    @override_settings(AI_ENABLED=True, AI_PROVIDER="openai", AI_QUEUE_LIVE_REQUESTS=True)
    def test_live_assistant_request_is_queued_and_idempotent(self):
        payload = {
            "business": self.business.id,
            "message": "Summarize today",
            "idempotency_key": "b1-live-request",
        }
        with patch("apps.ai_core.tasks.process_ai_job_task.apply_async") as dispatch:
            first = self.api.post("/api/ai/assistant/chat/", payload, format="json")
            second = self.api.post("/api/ai/assistant/chat/", payload, format="json")

        self.assertEqual(first.status_code, 202)
        self.assertEqual(second.status_code, 202)
        self.assertTrue(first.data["created"])
        self.assertFalse(second.data["created"])
        self.assertEqual(first.data["job"]["id"], second.data["job"]["id"])
        dispatch.assert_called_once()

    def test_ai_job_claim_accounts_result_once_and_is_tenant_scoped(self):
        job = AIJob.objects.create(
            business=self.business,
            user=self.owner,
            prompt_type="crm_assistant",
            input_json={"user_input": "B1", "runtime_context": {}},
            idempotency_key="b1-job",
        )
        log = AIRequestLog.objects.create(
            business=self.business,
            user=self.owner,
            source=AIRequestLog.Sources.CRM,
            prompt_type="crm_assistant",
        )
        result = SimpleNamespace(output_text="Done", provider="openai", model="test", tokens_used=3)
        with patch("apps.ai_core.services.run_ai_request", return_value=(result, log)) as runner:
            process_ai_job(job.id)
            process_ai_job(job.id)

        runner.assert_called_once()
        job.refresh_from_db()
        self.assertEqual(job.status, AIJob.Statuses.SUCCEEDED)
        self.assertEqual(job.attempts, 1)
        own = self.api.get(f"/api/ai/jobs/{job.id}/")
        self.api.force_authenticate(self.other_owner)
        foreign = self.api.get(f"/api/ai/jobs/{job.id}/")
        self.assertEqual(own.status_code, 200)
        self.assertEqual(foreign.status_code, 404)
