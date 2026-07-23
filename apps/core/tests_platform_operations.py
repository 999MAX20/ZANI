import json
from io import StringIO
from unittest.mock import patch

from django.core.management import call_command, CommandError
from django.db import OperationalError
from django.utils import timezone
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.automations.models import AutomationRun
from apps.billing.models import Subscription, SubscriptionPlan
from apps.bots.models import Bot, BotConversation
from apps.businesses.models import Business, BusinessMember
from apps.clients.models import Client
from apps.core.models import AuditLog
from apps.integrations.models import BusinessConnector, BusinessEvent, IntegrationEventLog, WebhookDeliveryLog, WebhookEndpoint
from apps.leads.models import Lead, LeadForm, LeadFormSubmissionError
from apps.tasks.models import Task


class PlatformOperationsDashboardTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.platform = User.objects.create_user(
            username="platform-ops",
            email="platform-ops@example.com",
            password="pass",
            role=User.Roles.PLATFORM_MANAGER,
        )
        self.owner = User.objects.create_user(
            username="owner-ops",
            email="owner-ops@example.com",
            password="pass",
            role=User.Roles.BUSINESS_OWNER,
        )
        self.manager = User.objects.create_user(
            username="manager-ops",
            email="manager-ops@example.com",
            password="pass",
            role=User.Roles.MANAGER,
        )
        self.business = Business.objects.create(
            owner=self.owner,
            name="Pilot Merchant",
            slug="pilot-merchant",
            status=Business.Statuses.TRIAL,
            landing_id="pilot-landing-ops",
            landing_domain="pilot.zani.local",
        )
        BusinessMember.objects.create(business=self.business, user=self.owner, role=BusinessMember.Roles.OWNER)
        BusinessMember.objects.create(business=self.business, user=self.manager, role=BusinessMember.Roles.MANAGER)
        plan, _ = SubscriptionPlan.objects.get_or_create(code="growth", defaults={"name": "Growth", "monthly_price": 99000})
        Subscription.objects.create(business=self.business, plan=plan, status=Subscription.Statuses.TRIAL, next_payment_at=timezone.now())
        self.client = Client.objects.create(business=self.business, full_name="Aigerim", phone="+77001112233", source=Client.Sources.WEBSITE)
        Lead.objects.create(business=self.business, client=self.client, source=Lead.Sources.LANDING, status=Lead.Statuses.NEW)
        LeadForm.objects.create(
            business=self.business,
            name="Landing form",
            landing_id="pilot-landing-ops",
            landing_domain="pilot.zani.local",
            title="Lead form",
            source=Lead.Sources.LANDING,
        )
        LeadFormSubmissionError.objects.create(
            business=self.business,
            public_id="bad-public-id",
            landing_id="pilot-landing-ops",
            error_message="Invalid phone",
            payload_json={"phone": "bad"},
        )
        Task.objects.create(
            business=self.business,
            title="Call lead",
            assignee=self.manager,
            created_by=self.owner,
            status=Task.Statuses.OPEN,
            priority=Task.Priorities.HIGH,
        )
        connected = BusinessConnector.objects.create(
            business=self.business,
            provider=BusinessConnector.Providers.WEBSITE,
            capability=BusinessConnector.Capabilities.SALES,
            name="Landing forms",
            status=BusinessConnector.Statuses.CONNECTED,
            auth_type=BusinessConnector.AuthTypes.NONE,
            connected_at=timezone.now(),
        )
        BusinessConnector.objects.create(
            business=self.business,
            provider=BusinessConnector.Providers.WHATSAPP,
            capability=BusinessConnector.Capabilities.COMMUNICATIONS,
            name="WhatsApp beta",
            status=BusinessConnector.Statuses.FAILED,
            auth_type=BusinessConnector.AuthTypes.QR,
            last_error="access_token=raw-connector-token expired",
        )
        BusinessEvent.objects.create(
            business=self.business,
            connector=connected,
            event_type="sale.recorded",
            source=BusinessConnector.Providers.EXCEL_CSV,
            deduplication_key="sale-ops-1",
            payload_json={"amount": 18000},
            status=BusinessEvent.Statuses.PROCESSED,
        )
        AutomationRun.objects.create(
            business=self.business,
            trigger_type="lead_created",
            entity_type="lead",
            entity_id="1",
            status=AutomationRun.Statuses.FAILED,
            error="Task template is missing token=raw-auto-token",
            attempts=3,
        )
        IntegrationEventLog.objects.create(
            business=self.business,
            provider=BusinessConnector.Providers.WHATSAPP,
            channel="whatsapp",
            direction=IntegrationEventLog.Directions.OUTBOUND,
            status=IntegrationEventLog.Statuses.FAILED,
            error="Provider unavailable api_key=raw-log-key",
        )
        webhook_endpoint = WebhookEndpoint.objects.create(
            business=self.business,
            name="CRM webhook",
            url="https://example.com/webhook",
            secret="raw-webhook-secret",
        )
        WebhookDeliveryLog.objects.create(
            business=self.business,
            endpoint=webhook_endpoint,
            event_type="lead.created",
            idempotency_key="lead-created-ops-1",
            status=WebhookDeliveryLog.Statuses.FAILED,
            attempts=2,
            error="Authorization: Bearer raw-webhook-token",
        )
        bot = Bot.objects.create(business=self.business, name="Pilot bot", status=Bot.Statuses.ACTIVE)
        BotConversation.objects.create(
            business=self.business,
            bot=bot,
            client=self.client,
            channel=BotConversation.Channels.WEBSITE,
            unread_count=2,
            handoff_required=True,
            priority=BotConversation.Priorities.HIGH,
            last_message_at=timezone.now(),
        )

    def test_platform_overview_returns_operations_summary(self):
        self.api.force_authenticate(self.platform)

        response = self.api.get("/api/platform/overview/")

        self.assertEqual(response.status_code, 200)
        summary = response.data["operations_summary"]
        self.assertEqual(summary["total_monitored"], 1)
        self.assertEqual(summary["attention_merchants"], 1)
        self.assertEqual(summary["form_error_merchants"], 1)
        self.assertEqual(summary["handoff_conversations"], 1)
        self.assertEqual(summary["failed_connectors"], 1)
        self.assertIn("new_leads_30d", summary)

    def test_platform_merchants_include_health_and_operations(self):
        self.api.force_authenticate(self.platform)

        response = self.api.get("/api/platform/merchants/")

        self.assertEqual(response.status_code, 200)
        merchant = response.data[0]
        self.assertEqual(merchant["name"], "Pilot Merchant")
        self.assertEqual(merchant["operations"]["lead_count"], 1)
        self.assertEqual(merchant["operations"]["unread_conversations"], 1)
        self.assertEqual(merchant["operations"]["handoff_conversations"], 1)
        self.assertEqual(merchant["operations"]["form_errors"], 1)
        self.assertEqual(merchant["operations"]["failed_connectors"], 1)
        self.assertEqual(merchant["health"]["status"], "attention")
        self.assertGreaterEqual(merchant["health"]["score"], 50)
        self.assertIn("Ошибки формы заявок", " ".join(merchant["health"]["blockers"]))
        self.assertTrue(merchant["latest_activity_at"])

    def test_merchant_user_cannot_access_platform_operations(self):
        self.api.force_authenticate(self.owner)

        overview = self.api.get("/api/platform/overview/")
        merchants = self.api.get("/api/platform/merchants/")

        self.assertEqual(overview.status_code, 403)
        self.assertEqual(merchants.status_code, 403)

    def test_platform_merchant_detail_returns_support_workflow(self):
        self.api.force_authenticate(self.platform)

        response = self.api.get(f"/api/platform/merchants/{self.business.id}/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["id"], self.business.id)
        self.assertEqual(response.data["support_workflow"]["priority"], "high")
        self.assertTrue(response.data["support_workflow"]["next_steps"])
        keys = [item["key"] for item in response.data["support_workflow"]["next_steps"]]
        self.assertIn("fix_forms", keys)
        self.assertIn("answer_inbox", keys)

    def test_platform_user_can_log_support_action(self):
        self.api.force_authenticate(self.platform)

        response = self.api.post(
            f"/api/platform/merchants/{self.business.id}/support-actions/",
            {"action_type": "whatsapp_followup", "note": "Asked owner to reconnect WhatsApp QR", "status": "done"},
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["action_type"], "whatsapp_followup")
        detail = self.api.get(f"/api/platform/merchants/{self.business.id}/")
        actions = detail.data["support_workflow"]["recent_actions"]
        self.assertEqual(actions[0]["note"], "Asked owner to reconnect WhatsApp QR")
        self.assertEqual(actions[0]["actor_email"], self.platform.email)

    def test_platform_support_action_masks_secret_note(self):
        self.api.force_authenticate(self.platform)

        response = self.api.post(
            f"/api/platform/merchants/{self.business.id}/support-actions/",
            {"action_type": "support_note", "note": "Owner sent api_key=raw-support-action-key", "status": "logged"},
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertNotIn("raw-support-action-key", str(response.data))
        detail = self.api.get(f"/api/platform/merchants/{self.business.id}/")
        self.assertNotIn("raw-support-action-key", str(detail.data["support_workflow"]["recent_actions"]))
        self.assertNotIn(
            "raw-support-action-key",
            AuditLog.objects.filter(business=self.business, entity_type="platform_support_action").first().metadata["note"],
        )

    def test_support_action_requires_note_and_platform_user(self):
        self.api.force_authenticate(self.platform)
        bad = self.api.post(f"/api/platform/merchants/{self.business.id}/support-actions/", {"action_type": "note"}, format="json")
        self.assertEqual(bad.status_code, 400)

        self.api.force_authenticate(self.owner)
        forbidden = self.api.post(
            f"/api/platform/merchants/{self.business.id}/support-actions/",
            {"action_type": "note", "note": "Merchant should not access platform support."},
            format="json",
        )
        self.assertEqual(forbidden.status_code, 403)

    def test_platform_operations_health_returns_support_runtime_and_failure_queues(self):
        self.api.force_authenticate(self.platform)

        response = self.api.get("/api/platform/operations-health/")

        self.assertEqual(response.status_code, 200)
        self.assertIn(response.data["status"], ["critical", "warning", "healthy"])
        self.assertIn("queue", response.data["runtime"])
        self.assertIn("production_readiness", response.data["runtime"])
        self.assertIn("backup_readiness", response.data["runtime"])
        self.assertIn("provider_rollout", response.data["runtime"])
        self.assertEqual(response.data["runtime"]["queue"]["automation_runs"]["failed"], 1)
        self.assertEqual(len(response.data["work_queue"]["failed_automation_runs"]), 1)
        self.assertEqual(len(response.data["work_queue"]["failed_integration_events"]), 1)
        self.assertEqual(response.data["work_queue"]["connector_requests"][0]["business_id"], self.business.id)
        self.assertTrue(response.data["runtime"]["database"]["available"])
        self.assertIn("oldest_pending_age_seconds", response.data["runtime"]["queue"]["outbound_messages"])
        self.assertIn("oldest_active_sla_age_seconds", response.data["runtime"]["queue"]["routing"])

    def test_platform_operations_health_redacts_secret_values(self):
        self.api.force_authenticate(self.platform)

        response = self.api.get("/api/platform/operations-health/")

        self.assertEqual(response.status_code, 200)
        serialized = json.dumps(response.data, default=str)
        self.assertNotIn("raw-auto-token", serialized)
        self.assertNotIn("raw-log-key", serialized)
        self.assertNotIn("raw-connector-token", serialized)
        self.assertNotIn("raw-webhook-token", serialized)
        self.assertNotIn(self.business.name, serialized)
        self.assertNotIn(self.client.full_name, serialized)
        self.assertNotIn(self.client.phone, serialized)
        self.assertNotIn("Landing forms", serialized)
        self.assertNotIn(self.owner.email, serialized)

    def test_merchant_user_cannot_access_platform_operations_health(self):
        self.api.force_authenticate(self.owner)

        response = self.api.get("/api/platform/operations-health/")

        self.assertEqual(response.status_code, 403)

    def test_platform_operations_health_command_outputs_json(self):
        output = StringIO()

        call_command("platform_operations_health_check", "--format=json", stdout=output)

        payload = json.loads(output.getvalue())
        self.assertIn("summary", payload)
        self.assertIn("runtime", payload)
        self.assertIn("work_queue", payload)
        serialized = json.dumps(payload, default=str)
        self.assertNotIn("raw-auto-token", serialized)
        self.assertNotIn("raw-log-key", serialized)
        self.assertNotIn("raw-connector-token", serialized)
        self.assertNotIn("raw-webhook-token", serialized)

    def test_operations_health_returns_safe_database_blocker_instead_of_crashing(self):
        with patch(
            "apps.core.operations_health._queue_summary",
            side_effect=OperationalError("password=raw-db-password merchant=Pilot Merchant"),
        ):
            output = StringIO()
            call_command("platform_operations_health_check", "--format=json", stdout=output)

        payload = json.loads(output.getvalue())
        self.assertEqual(payload["status"], "critical")
        self.assertFalse(payload["summary"]["database_available"])
        self.assertEqual(payload["runtime"]["database"]["code"], "database_unavailable")
        self.assertFalse(payload["runtime"]["queue"]["outbound_messages"]["available"])
        self.assertEqual(payload["work_queue"]["connector_requests"], [])
        serialized = json.dumps(payload)
        self.assertNotIn("raw-db-password", serialized)
        self.assertNotIn("Pilot Merchant", serialized)

    def test_platform_operations_health_command_can_fail_on_critical(self):
        with self.assertRaises(CommandError):
            call_command("platform_operations_health_check", "--fail-on-critical", stdout=StringIO())
