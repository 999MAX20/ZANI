import tempfile
import json
import logging

from django.db import connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.bots.models import Bot, BotConversation, BotMessage
from apps.businesses.access import ensure_default_roles
from apps.businesses.capabilities import ensure_business_capabilities
from apps.businesses.models import Business, BusinessMember, BusinessRole
from apps.clients.models import Client
from apps.crm.models import Deal, Pipeline, PipelineStage
from apps.core.export_jobs import process_export_job
from apps.core.logging import JsonLogFormatter, RequestContextFilter, request_id_context
from apps.core.models import ExportJob
from apps.leads.models import Lead
from apps.tasks.models import Task


class BackendPerformanceRegressionTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.owner = User.objects.create_user(
            username="perf-owner",
            email="perf-owner@example.com",
            password="pass12345",
            role=User.Roles.BUSINESS_OWNER,
        )
        self.business = Business.objects.create(owner=self.owner, name="Performance Clinic", slug="performance-clinic")
        ensure_default_roles(self.business)
        ensure_business_capabilities(self.business, configured_by=self.owner)
        BusinessMember.objects.create(
            business=self.business,
            user=self.owner,
            role=BusinessMember.Roles.OWNER,
            business_role=BusinessRole.objects.get(business=self.business, preset_key=BusinessMember.Roles.OWNER),
        )
        self.api.force_authenticate(self.owner)

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls._media_dir = tempfile.TemporaryDirectory()
        cls._media_override = override_settings(MEDIA_ROOT=cls._media_dir.name)
        cls._media_override.enable()

    @classmethod
    def tearDownClass(cls):
        cls._media_override.disable()
        cls._media_dir.cleanup()
        super().tearDownClass()

    def test_inbox_list_query_count_does_not_scale_with_conversations_or_messages(self):
        bot = Bot.objects.create(business=self.business, name="Performance bot", status=Bot.Statuses.ACTIVE)
        for conversation_index in range(12):
            conversation = BotConversation.objects.create(
                business=self.business,
                bot=bot,
                channel=BotConversation.Channels.WEBSITE,
                external_user_id=f"visitor-{conversation_index}",
            )
            for message_index in range(8):
                BotMessage.objects.create(
                    conversation=conversation,
                    direction=BotMessage.Directions.INBOUND,
                    sender_type=BotMessage.SenderTypes.CLIENT,
                    text=f"message-{conversation_index}-{message_index}",
                )

        with CaptureQueriesContext(connection) as queries:
            response = self.api.get("/api/inbox/conversations/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 12)
        self.assertEqual(response.data["results"][0]["last_message"]["text"], "message-11-7")
        self.assertLessEqual(len(queries), 18, [query["sql"] for query in queries])

    def test_team_performance_query_count_does_not_scale_with_team_size(self):
        client = Client.objects.create(business=self.business, full_name="Performance Client")
        pipeline = Pipeline.objects.create(business=self.business, name="Performance pipeline", slug="performance-pipeline")
        stage = PipelineStage.objects.create(
            business=self.business,
            pipeline=pipeline,
            name="Open",
            order=1,
            sla_minutes=15,
        )
        bot = Bot.objects.create(business=self.business, name="Team performance bot", status=Bot.Statuses.ACTIVE)
        manager_role = BusinessRole.objects.get(business=self.business, preset_key=BusinessMember.Roles.MANAGER)
        now = timezone.now()
        for index in range(12):
            manager = User.objects.create_user(
                username=f"perf-manager-{index}",
                email=f"perf-manager-{index}@example.com",
                password=None,
                role=User.Roles.BUSINESS_MANAGER,
            )
            BusinessMember.objects.create(
                business=self.business,
                user=manager,
                role=BusinessMember.Roles.MANAGER,
                business_role=manager_role,
            )
            lead = Lead.objects.create(
                business=self.business,
                client=client,
                responsible_user=manager,
                status=Lead.Statuses.CONTACTED,
            )
            Deal.objects.create(
                business=self.business,
                client=client,
                lead=lead,
                pipeline=pipeline,
                stage=stage,
                title=f"Deal {index}",
                owner=manager,
                stage_entered_at=now - timezone.timedelta(hours=1),
            )
            Task.objects.create(
                business=self.business,
                title=f"Task {index}",
                assignee=manager,
                due_at=now - timezone.timedelta(hours=1),
            )
            BotConversation.objects.create(
                business=self.business,
                bot=bot,
                channel=BotConversation.Channels.WEBSITE,
                assigned_to=manager,
                handoff_required=True,
                last_inbound_at=now - timezone.timedelta(hours=1),
            )

        with CaptureQueriesContext(connection) as queries:
            response = self.api.get("/api/team/performance/", {"business": self.business.id})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["members"]), 13)
        self.assertEqual(response.data["totals"]["assigned_leads"], 12)
        self.assertLessEqual(len(queries), 28, [query["sql"] for query in queries])

    @override_settings(EXPORT_SYNC_MAX_ROWS=1, EXPORT_MAX_ROWS=100, CELERY_TASK_ALWAYS_EAGER=False)
    def test_large_entity_export_uses_background_job_and_private_download(self):
        Client.objects.bulk_create(
            [
                Client(business=self.business, full_name="Export One"),
                Client(business=self.business, full_name="Export Two"),
            ]
        )

        response = self.api.get("/api/export/clients/", {"business": self.business.id})

        self.assertEqual(response.status_code, 202)
        job = ExportJob.objects.get(id=response.data["id"])
        self.assertEqual(job.status, ExportJob.Statuses.PENDING)
        process_export_job(job.id)
        job.refresh_from_db()
        self.assertEqual(job.status, ExportJob.Statuses.SUCCEEDED)
        self.assertEqual(job.row_count, 2)

        download = self.api.get(f"/api/export-jobs/{job.id}/download/")
        content = b"".join(download.streaming_content).decode()
        self.assertEqual(download.status_code, 200)
        self.assertIn("Export One", content)
        self.assertIn("Export Two", content)

    @override_settings(EXPORT_SYNC_MAX_ROWS=1, EXPORT_MAX_ROWS=1)
    def test_entity_export_rejects_absolute_row_limit(self):
        Client.objects.bulk_create(
            [
                Client(business=self.business, full_name="Export One"),
                Client(business=self.business, full_name="Export Two"),
            ]
        )

        response = self.api.get("/api/export/clients/", {"business": self.business.id})

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["code"], "validation_error")

    def test_analytics_date_range_is_bounded(self):
        response = self.api.get(
            "/api/analytics/reports/summary/",
            {"business": self.business.id, "start": "2024-01-01", "end": "2026-01-01"},
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["code"], "validation_error")

    def test_owner_dashboard_query_count_does_not_scale_per_manager(self):
        client = Client.objects.create(business=self.business, full_name="Dashboard Client")
        pipeline = Pipeline.objects.create(business=self.business, name="Dashboard pipeline", slug="dashboard-pipeline")
        stage = PipelineStage.objects.create(business=self.business, pipeline=pipeline, name="Open", order=1)
        manager_role = BusinessRole.objects.get(business=self.business, preset_key=BusinessMember.Roles.MANAGER)
        for index in range(10):
            manager = User.objects.create_user(
                username=f"dashboard-manager-{index}",
                email=f"dashboard-manager-{index}@example.com",
                password=None,
                role=User.Roles.BUSINESS_MANAGER,
            )
            BusinessMember.objects.create(
                business=self.business,
                user=manager,
                role=BusinessMember.Roles.MANAGER,
                business_role=manager_role,
            )
            lead = Lead.objects.create(business=self.business, client=client, responsible_user=manager)
            Deal.objects.create(
                business=self.business,
                client=client,
                lead=lead,
                pipeline=pipeline,
                stage=stage,
                title=f"Dashboard deal {index}",
                owner=manager,
            )
            Task.objects.create(business=self.business, title=f"Dashboard task {index}", assignee=manager)

        with CaptureQueriesContext(connection) as queries:
            response = self.api.get("/api/analytics/owner-dashboard/", {"business": self.business.id})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["manager_performance"]["totals"]["assigned_leads"], 10)
        self.assertLessEqual(len(queries), 75, [query["sql"] for query in queries])

    def test_json_logging_carries_release_and_request_id_without_payload(self):
        token = request_id_context.set("b5-request-42")
        try:
            record = logging.LogRecord("zani.test", logging.INFO, __file__, 1, "request.completed", (), None)
            RequestContextFilter().filter(record)
            payload = json.loads(JsonLogFormatter().format(record))
        finally:
            request_id_context.reset(token)

        self.assertEqual(payload["request_id"], "b5-request-42")
        self.assertEqual(payload["message"], "request.completed")
        self.assertIn("release", payload)
        self.assertNotIn("request_body", payload)

    @override_settings(REPORT_EXPORT_SYNC_MAX_DAYS=30, CELERY_TASK_ALWAYS_EAGER=False)
    def test_large_report_export_uses_background_job(self):
        response = self.api.get(
            "/api/analytics/reports/export/",
            {
                "business": self.business.id,
                "report": "source_roi",
                "start": "2026-01-01",
                "end": "2026-04-01",
            },
        )

        self.assertEqual(response.status_code, 202)
        self.assertEqual(response.data["kind"], ExportJob.Kinds.ANALYTICS_REPORT)
        self.assertEqual(response.data["status"], ExportJob.Statuses.PENDING)
