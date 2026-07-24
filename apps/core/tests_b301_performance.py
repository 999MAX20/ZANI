import json
from time import perf_counter

from django.db import connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.activities.models import ActivityEvent, Note, Tag, TaggedObject
from apps.bots.models import Bot, BotConversation, BotMessage
from apps.businesses.access import ensure_default_roles
from apps.businesses.capabilities import ensure_business_capabilities
from apps.businesses.models import Business, BusinessMember, BusinessRole
from apps.clients.models import Client
from apps.core.crm_cards import _related_entity_query
from apps.core.models import FileAttachment
from apps.crm.models import Deal, Pipeline, PipelineStage
from apps.leads.models import Lead
from apps.scheduling.models import Appointment, Resource
from apps.services.models import Service
from apps.tasks.models import Task


REPRESENTATIVE_ROWS = 60


class B301MeasuredPerformanceTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.owner = User.objects.create_user(
            username="b301-owner",
            email="b301-owner@example.com",
            password="pass12345",
            role=User.Roles.BUSINESS_OWNER,
        )
        cls.business = Business.objects.create(
            owner=cls.owner,
            name="B301 Performance Clinic",
            slug="b301-performance-clinic",
        )
        ensure_default_roles(cls.business)
        ensure_business_capabilities(cls.business, configured_by=cls.owner)
        BusinessMember.objects.create(
            business=cls.business,
            user=cls.owner,
            role=BusinessMember.Roles.OWNER,
            business_role=BusinessRole.objects.get(
                business=cls.business,
                preset_key=BusinessMember.Roles.OWNER,
            ),
        )
        cls.client_record = Client.objects.create(
            business=cls.business,
            full_name="B301 Client",
            phone="+77000000301",
        )
        cls.service = Service.objects.create(
            business=cls.business,
            name="B301 Service",
            duration_minutes=30,
            price_from=1000,
        )
        cls.resource = Resource.objects.create(
            business=cls.business,
            name="B301 Resource",
            linked_user=cls.owner,
        )
        cls.pipeline = Pipeline.objects.create(
            business=cls.business,
            name="B301 Pipeline",
            slug="b301-pipeline",
        )
        cls.stage = PipelineStage.objects.create(
            business=cls.business,
            pipeline=cls.pipeline,
            name="B301 Open",
            order=1,
            sla_minutes=15,
        )
        cls.bot = Bot.objects.create(
            business=cls.business,
            name="B301 Bot",
            status=Bot.Statuses.ACTIVE,
        )
        now = timezone.now()
        cls.leads = Lead.objects.bulk_create(
            [
                Lead(
                    business=cls.business,
                    client=cls.client_record,
                    responsible_user=cls.owner,
                    status=Lead.Statuses.NEW if index % 2 == 0 else Lead.Statuses.CONTACTED,
                    source=f"source-{index % 4}",
                )
                for index in range(REPRESENTATIVE_ROWS)
            ]
        )
        Lead.objects.filter(id__in=[lead.id for lead in cls.leads]).update(
            updated_at=now - timezone.timedelta(days=10)
        )
        cls.deals = Deal.objects.bulk_create(
            [
                Deal(
                    business=cls.business,
                    client=cls.client_record,
                    lead=cls.leads[index],
                    pipeline=cls.pipeline,
                    stage=cls.stage,
                    title=f"B301 Deal {index}",
                    owner=cls.owner,
                    stage_entered_at=now - timezone.timedelta(hours=2),
                )
                for index in range(REPRESENTATIVE_ROWS)
            ]
        )
        cls.appointments = Appointment.objects.bulk_create(
            [
                Appointment(
                    business=cls.business,
                    client=cls.client_record,
                    lead=cls.leads[index],
                    service=cls.service,
                    resource=cls.resource,
                    start_at=now + timezone.timedelta(minutes=index * 45),
                    end_at=now + timezone.timedelta(minutes=index * 45 + 30),
                    status=(
                        Appointment.Statuses.CONFIRMED
                        if index % 2 == 0
                        else Appointment.Statuses.CREATED
                    ),
                )
                for index in range(REPRESENTATIVE_ROWS)
            ]
        )
        cls.conversations = BotConversation.objects.bulk_create(
            [
                BotConversation(
                    business=cls.business,
                    bot=cls.bot,
                    channel=BotConversation.Channels.WEBSITE,
                    external_user_id=f"b301-visitor-{index}",
                    client=cls.client_record,
                    lead=cls.leads[index],
                    deal=cls.deals[index],
                    assigned_to=cls.owner,
                    unread_count=2,
                    handoff_required=index % 3 == 0,
                    last_message_at=now - timezone.timedelta(minutes=index),
                    last_inbound_at=now - timezone.timedelta(hours=1),
                )
                for index in range(REPRESENTATIVE_ROWS)
            ]
        )
        BotMessage.objects.bulk_create(
            [
                BotMessage(
                    conversation=conversation,
                    direction=BotMessage.Directions.INBOUND,
                    sender_type=BotMessage.SenderTypes.CLIENT,
                    text=f"B301 message {message_index}",
                )
                for conversation in cls.conversations
                for message_index in range(2)
            ]
        )
        Task.objects.bulk_create(
            [
                Task(
                    business=cls.business,
                    title=f"B301 Task {index}",
                    client=cls.client_record,
                    lead=cls.leads[index],
                    deal=cls.deals[index],
                    appointment=cls.appointments[index],
                    conversation=cls.conversations[index],
                    assignee=cls.owner,
                    created_by=cls.owner,
                    due_at=now - timezone.timedelta(hours=index + 1),
                    priority=Task.Priorities.HIGH if index % 2 == 0 else Task.Priorities.NORMAL,
                )
                for index in range(REPRESENTATIVE_ROWS)
            ]
        )
        ActivityEvent.objects.bulk_create(
            [
                ActivityEvent(
                    business=cls.business,
                    client=cls.client_record,
                    actor=cls.owner,
                    entity_type="Lead",
                    entity_id=str(cls.leads[index % REPRESENTATIVE_ROWS].id),
                    event_type="b301_measured_event",
                    text=f"B301 event {index}",
                )
                for index in range(REPRESENTATIVE_ROWS * 2)
            ]
        )
        Note.objects.bulk_create(
            [
                Note(
                    business=cls.business,
                    client=cls.client_record,
                    author=cls.owner,
                    entity_type="Client",
                    entity_id=str(cls.client_record.id),
                    text=f"B301 note {index}",
                )
                for index in range(REPRESENTATIVE_ROWS)
            ]
        )

        cls.other_owner = User.objects.create_user(
            username="b301-other-owner",
            email="b301-other-owner@example.com",
            password="pass12345",
            role=User.Roles.BUSINESS_OWNER,
        )
        cls.other_business = Business.objects.create(
            owner=cls.other_owner,
            name="B301 Other Business",
            slug="b301-other-business",
        )
        cls.other_client = Client.objects.create(
            business=cls.other_business,
            full_name="B301 Foreign Client",
        )

    def setUp(self):
        self.api = APIClient()
        self.api.force_authenticate(self.owner)

    def _get_metric(self, label, path, params=None):
        started = perf_counter()
        with CaptureQueriesContext(connection) as captured:
            response = self.api.get(path, params or {})
        elapsed_ms = round((perf_counter() - started) * 1000, 2)
        payload_bytes = len(json.dumps(response.data, default=str).encode("utf-8"))
        print(
            f"B301_METRIC surface={label} queries={len(captured)} "
            f"payload_bytes={payload_bytes} elapsed_ms={elapsed_ms}"
        )
        self.assertEqual(response.status_code, 200, response.data)
        return response, len(captured), payload_bytes

    def test_representative_read_surfaces_have_bounded_queries_and_payloads(self):
        now = timezone.now()
        surfaces = [
            (
                "owner_dashboard",
                "/api/analytics/owner-dashboard/",
                {"business": self.business.id},
                70,
                25_000,
            ),
            (
                "inbox_list",
                "/api/inbox/conversations/",
                {"business": self.business.id},
                12,
                75_000,
            ),
            (
                "inbox_summary",
                "/api/inbox/conversations/summary/",
                {"business": self.business.id},
                10,
                10_000,
            ),
            (
                "task_summary",
                "/api/tasks/summary/",
                {"business": self.business.id},
                8,
                10_000,
            ),
            (
                "task_workload",
                "/api/tasks/workload/",
                {"business": self.business.id},
                8,
                10_000,
            ),
            (
                "work_queues",
                "/api/work-queues/",
                {"business": self.business.id, "limit": 10},
                58,
                100_000,
            ),
            (
                "client_crm_card",
                f"/api/clients/{self.client_record.id}/crm-card/",
                {},
                40,
                150_000,
            ),
            (
                "calendar",
                "/api/appointments/",
                {
                    "business": self.business.id,
                    "start_from": now.isoformat(),
                    "start_to": (now + timezone.timedelta(days=60)).isoformat(),
                },
                10,
                50_000,
            ),
            (
                "analytics_report",
                "/api/analytics/reports/summary/",
                {"business": self.business.id},
                85,
                20_000,
            ),
        ]
        results = {}
        for label, path, params, query_budget, payload_budget in surfaces:
            response, query_count, payload_bytes = self._get_metric(label, path, params)
            self.assertLessEqual(query_count, query_budget)
            self.assertLessEqual(payload_bytes, payload_budget)
            results[label] = response.data

        self.assertEqual(len(results["inbox_list"]["results"]), 50)
        self.assertEqual(len(results["calendar"]["results"]), 50)
        self.assertEqual(results["task_summary"]["overdue"], REPRESENTATIVE_ROWS)
        self.assertEqual(results["task_summary"]["open"], REPRESENTATIVE_ROWS)
        self.assertEqual(results["task_summary"]["unassigned"], 0)
        self.assertEqual(
            results["work_queues"]["summary"]["overdue_tasks"],
            REPRESENTATIVE_ROWS,
        )
        self.assertEqual(
            results["work_queues"]["summary"]["stale_leads"],
            REPRESENTATIVE_ROWS,
        )
        self.assertEqual(
            results["work_queues"]["summary"]["own_deals"],
            REPRESENTATIVE_ROWS,
        )
        self.assertEqual(len(results["client_crm_card"]["leads"]), 25)
        self.assertEqual(len(results["client_crm_card"]["timeline"]), 50)
        self.assertEqual(
            results["client_crm_card"]["meta"]["related_counts"]["leads"],
            REPRESENTATIVE_ROWS,
        )
        self.assertEqual(
            results["client_crm_card"]["meta"]["related_counts"]["deals"],
            REPRESENTATIVE_ROWS,
        )
        self.assertEqual(
            results["client_crm_card"]["meta"]["related_counts"]["appointments"],
            REPRESENTATIVE_ROWS,
        )
        self.assertEqual(
            results["client_crm_card"]["meta"]["related_counts"]["tasks"],
            REPRESENTATIVE_ROWS,
        )
        self.assertEqual(
            results["client_crm_card"]["meta"]["related_counts"]["conversations"],
            REPRESENTATIVE_ROWS,
        )
        self.assertEqual(
            results["client_crm_card"]["client"]["leads_count"],
            REPRESENTATIVE_ROWS,
        )
        self.assertTrue(results["client_crm_card"]["meta"]["has_more"]["timeline"])

    def test_performance_surfaces_preserve_tenant_boundaries(self):
        card = self.api.get(f"/api/clients/{self.other_client.id}/crm-card/")
        work_queues = self.api.get(
            "/api/work-queues/",
            {"business": self.other_business.id, "limit": 10},
        )
        dashboard = self.api.get(
            "/api/analytics/owner-dashboard/",
            {"business": self.other_business.id},
        )

        self.assertEqual(card.status_code, 404)
        self.assertEqual(work_queues.status_code, 403)
        self.assertEqual(dashboard.status_code, 400)

    def test_crm_card_related_predicate_remains_database_bounded_as_rows_grow(self):
        card_path = f"/api/clients/{self.client_record.id}/crm-card/"
        with CaptureQueriesContext(connection) as predicate_queries:
            predicate = _related_entity_query(
                [("Client", self.client_record.id)],
                [
                    ("Lead", Lead.objects.filter(client=self.client_record)),
                    ("Deal", Deal.objects.filter(client=self.client_record)),
                    (
                        "Appointment",
                        Appointment.objects.filter(client=self.client_record),
                    ),
                    ("Task", Task.objects.filter(client=self.client_record)),
                ],
            )
        self.assertEqual(len(predicate_queries), 0)
        self.assertLessEqual(len(predicate.children), 7)

        with CaptureQueriesContext(connection) as baseline_queries:
            baseline = self.api.get(card_path)

        extra_rows = 240
        now = timezone.now()
        extra_leads = Lead.objects.bulk_create(
            [
                Lead(
                    business=self.business,
                    client=self.client_record,
                    responsible_user=self.owner,
                    status=Lead.Statuses.NEW,
                    source="b301-scale",
                )
                for _ in range(extra_rows)
            ]
        )
        extra_deals = Deal.objects.bulk_create(
            [
                Deal(
                    business=self.business,
                    client=self.client_record,
                    lead=extra_leads[index],
                    pipeline=self.pipeline,
                    stage=self.stage,
                    title=f"B301 scaled deal {index}",
                    owner=self.owner,
                    stage_entered_at=now,
                )
                for index in range(extra_rows)
            ]
        )
        extra_appointments = Appointment.objects.bulk_create(
            [
                Appointment(
                    business=self.business,
                    client=self.client_record,
                    lead=extra_leads[index],
                    service=self.service,
                    resource=self.resource,
                    start_at=now + timezone.timedelta(days=90, minutes=index * 45),
                    end_at=now + timezone.timedelta(days=90, minutes=index * 45 + 30),
                    status=Appointment.Statuses.CREATED,
                )
                for index in range(extra_rows)
            ]
        )
        extra_tasks = Task.objects.bulk_create(
            [
                Task(
                    business=self.business,
                    title=f"B301 scaled task {index}",
                    client=self.client_record,
                    lead=extra_leads[index],
                    deal=extra_deals[index],
                    appointment=extra_appointments[index],
                    assignee=self.owner,
                    created_by=self.owner,
                    due_at=now + timezone.timedelta(days=1),
                )
                for index in range(extra_rows)
            ]
        )
        scaled_event = ActivityEvent.objects.create(
            business=self.business,
            client=None,
            actor=self.owner,
            entity_type="Lead",
            entity_id=str(extra_leads[-1].id),
            event_type="b301_scaled_event",
            text="B301 scaled related event",
        )
        scaled_note = Note.objects.create(
            business=self.business,
            client=None,
            author=self.owner,
            entity_type="Deal",
            entity_id=str(extra_deals[-1].id),
            text="B301 scaled related note",
        )
        scaled_tag = Tag.objects.create(
            business=self.business,
            name="B301 scaled tag",
        )
        TaggedObject.objects.create(
            business=self.business,
            tag=scaled_tag,
            entity_type="Appointment",
            entity_id=str(extra_appointments[-1].id),
        )
        scaled_attachment = FileAttachment.objects.create(
            business=self.business,
            uploaded_by=self.owner,
            file="private/attachments/b301-scaled.txt",
            original_name="b301-scaled.txt",
            entity_type="Task",
            entity_id=str(extra_tasks[-1].id),
        )

        with CaptureQueriesContext(connection) as scaled_queries:
            scaled = self.api.get(card_path)

        self.assertEqual(baseline.status_code, 200)
        self.assertEqual(scaled.status_code, 200)
        self.assertLessEqual(len(scaled_queries), len(baseline_queries) + 2)
        baseline_max_sql = max(len(query["sql"]) for query in baseline_queries)
        scaled_max_sql = max(len(query["sql"]) for query in scaled_queries)
        print(
            "B301_SCALE "
            f"baseline_rows={REPRESENTATIVE_ROWS} "
            f"baseline_queries={len(baseline_queries)} "
            f"baseline_max_sql={baseline_max_sql} "
            f"scaled_rows={REPRESENTATIVE_ROWS + extra_rows} "
            f"scaled_queries={len(scaled_queries)} "
            f"scaled_max_sql={scaled_max_sql}"
        )
        self.assertLessEqual(scaled_max_sql, baseline_max_sql + 500)
        self.assertLessEqual(scaled_max_sql, 15_000)
        self.assertEqual(
            scaled.data["meta"]["related_counts"]["leads"],
            REPRESENTATIVE_ROWS + extra_rows,
        )
        self.assertEqual(
            scaled.data["meta"]["related_counts"]["deals"],
            REPRESENTATIVE_ROWS + extra_rows,
        )
        self.assertEqual(
            scaled.data["meta"]["related_counts"]["appointments"],
            REPRESENTATIVE_ROWS + extra_rows,
        )
        self.assertEqual(
            scaled.data["meta"]["related_counts"]["tasks"],
            REPRESENTATIVE_ROWS + extra_rows,
        )
        self.assertTrue(
            any(item["id"] == scaled_event.id for item in scaled.data["timeline"])
        )
        self.assertTrue(
            any(item["id"] == scaled_note.id for item in scaled.data["notes"])
        )
        self.assertTrue(
            any(item["tag"] == scaled_tag.id for item in scaled.data["tags"])
        )
        self.assertTrue(
            any(
                item["id"] == scaled_attachment.id
                for item in scaled.data["attachments"]
            )
        )
