import json
from time import perf_counter

from django.db import connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.activities.models import ActivityEvent, Note
from apps.bots.models import Bot, BotConversation, BotMessage
from apps.businesses.access import ensure_default_roles
from apps.businesses.capabilities import ensure_business_capabilities
from apps.businesses.models import Business, BusinessMember, BusinessRole
from apps.clients.models import Client
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
