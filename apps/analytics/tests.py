from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.businesses.models import Business, BusinessMember
from apps.clients.models import Client
from apps.core.models import AuditLog
from apps.integrations.models import BusinessEvent
from apps.crm.models import Deal, Pipeline, PipelineStage
from apps.leads.models import Lead
from apps.scheduling.models import Appointment
from apps.services.models import Service
from apps.tasks.models import Task


class OwnerDashboardAnalyticsTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.owner = User.objects.create_user(
            username="analytics-owner",
            email="analytics-owner@example.com",
            password="pass",
            role=User.Roles.BUSINESS_OWNER,
        )
        self.other_owner = User.objects.create_user(
            username="analytics-other",
            email="analytics-other@example.com",
            password="pass",
            role=User.Roles.BUSINESS_OWNER,
        )
        self.business = Business.objects.create(owner=self.owner, name="Analytics Clinic", slug="analytics-clinic", timezone="Asia/Almaty")
        self.other_business = Business.objects.create(owner=self.other_owner, name="Other Analytics", slug="other-analytics")
        BusinessMember.objects.create(business=self.business, user=self.owner, role=BusinessMember.Roles.OWNER)
        BusinessMember.objects.create(business=self.other_business, user=self.other_owner, role=BusinessMember.Roles.OWNER)
        self.client = Client.objects.create(business=self.business, full_name="Analytics Client")
        self.service = Service.objects.create(business=self.business, name="Consultation", duration_minutes=60, price_from=15000)
        self.pipeline = Pipeline.objects.create(business=self.business, name="Sales", slug="sales", is_default=True)
        self.stage = PipelineStage.objects.create(business=self.business, pipeline=self.pipeline, name="New", order=1, probability=20)
        self.api.force_authenticate(self.owner)

    def test_owner_dashboard_returns_real_metrics(self):
        Lead.objects.create(business=self.business, client=self.client, source=Lead.Sources.WEBSITE, status=Lead.Statuses.NEW)
        Lead.objects.create(business=self.business, client=self.client, source=Lead.Sources.WEBSITE, status=Lead.Statuses.APPOINTMENT_CREATED)
        Lead.objects.create(business=self.business, client=self.client, source=Lead.Sources.TELEGRAM, status=Lead.Statuses.CLOSED)
        today = timezone.localdate()
        start_at = datetime(today.year, today.month, today.day, 10, 0, tzinfo=ZoneInfo("Asia/Almaty"))
        Appointment.objects.create(
            business=self.business,
            client=self.client,
            service=self.service,
            start_at=start_at,
            end_at=start_at + timedelta(hours=1),
            status=Appointment.Statuses.COMPLETED,
        )
        Appointment.objects.create(
            business=self.business,
            client=self.client,
            service=self.service,
            start_at=start_at + timedelta(hours=2),
            end_at=start_at + timedelta(hours=3),
            status=Appointment.Statuses.NO_SHOW,
        )
        Task.objects.create(business=self.business, client=self.client, title="Overdue", due_at=timezone.now() - timedelta(hours=1))

        response = self.api.get("/api/analytics/owner-dashboard/", {"business": self.business.id})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["new_leads"], 1)
        self.assertEqual(response.data["appointments_today"], 2)
        self.assertEqual(response.data["appointments_completed"], 1)
        self.assertEqual(response.data["no_show_count"], 1)
        self.assertEqual(response.data["conversion_lead_to_appointment"], 33)
        self.assertEqual(response.data["open_tasks"], 1)
        self.assertEqual(response.data["overdue_tasks"], 1)
        self.assertEqual(response.data["revenue_estimate"], "15000")
        self.assertEqual(response.data["leads_by_source"][0]["source"], Lead.Sources.WEBSITE)
        self.assertIn("business_pulse", response.data)
        self.assertIn("recommendations", response.data)
        self.assertIn("quick_connect", response.data)
        self.assertIn("setup", response.data)
        self.assertIn("mobile_onboarding", response.data)
        self.assertEqual(response.data["mobile_onboarding"]["score"], response.data["setup"]["score"])
        self.assertEqual(response.data["mobile_onboarding"]["steps"][0]["key"], "landing")
        self.assertTrue(any(item["key"] == "sales_data" for item in response.data["mobile_onboarding"]["steps"]))
        self.assertEqual(response.data["business_pulse"]["tone"], "setup")
        self.assertTrue(any(item["key"] == "upload_sales" for item in response.data["recommendations"]))
        self.assertEqual(response.data["quick_connect"][0]["key"], "whatsapp")


    def test_owner_dashboard_uses_sales_events_for_business_pulse(self):
        BusinessEvent.objects.create(
            business=self.business,
            source="csv",
            event_type="sale.recorded",
            deduplication_key="sale-1",
            payload_json={"amount": "25000"},
        )

        response = self.api.get("/api/analytics/owner-dashboard/", {"business": self.business.id})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["sales_events_count"], 1)
        self.assertEqual(response.data["data_quality"]["has_sales_data"], True)
        self.assertEqual(response.data["business_pulse"]["tone"], "growth")
        self.assertEqual(response.data["revenue"]["total_estimate"], "25000")
        self.assertTrue(response.data["setup"]["sources"]["sales_data"])
        sales_step = next(item for item in response.data["mobile_onboarding"]["steps"] if item["key"] == "sales_data")
        self.assertEqual(sales_step["status"], "done")

    def test_owner_dashboard_is_tenant_safe(self):
        self.api.force_authenticate(self.other_owner)

        response = self.api.get("/api/analytics/owner-dashboard/", {"business": self.business.id})

        self.assertEqual(response.status_code, 400)

    def test_report_summary_returns_operational_reports(self):
        lead = Lead.objects.create(business=self.business, client=self.client, source=Lead.Sources.WEBSITE, status=Lead.Statuses.APPOINTMENT_CREATED, responsible_user=self.owner)
        Deal.objects.create(business=self.business, client=self.client, lead=lead, pipeline=self.pipeline, stage=self.stage, title="Analytics deal", amount=15000, owner=self.owner)
        start_at = timezone.now()
        Appointment.objects.create(
            business=self.business,
            client=self.client,
            lead=lead,
            service=self.service,
            start_at=start_at,
            end_at=start_at + timedelta(hours=1),
            status=Appointment.Statuses.COMPLETED,
        )

        response = self.api.get("/api/analytics/reports/summary/", {"business": self.business.id})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["source_roi"][0]["source"], Lead.Sources.WEBSITE)
        self.assertEqual(response.data["source_roi"][0]["conversion_rate"], 100)
        self.assertEqual(response.data["retention_ltv"]["total_clients"], 1)
        self.assertTrue(response.data["widgets"])

    def test_report_summary_respects_tenant_access(self):
        self.api.force_authenticate(self.other_owner)

        response = self.api.get("/api/analytics/reports/summary/", {"business": self.business.id})

        self.assertEqual(response.status_code, 400)

    def test_report_export_returns_csv_and_writes_audit(self):
        Lead.objects.create(business=self.business, client=self.client, source=Lead.Sources.WEBSITE, status=Lead.Statuses.NEW)

        response = self.api.get("/api/analytics/reports/export/", {"business": self.business.id, "report": "source_roi"})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "text/csv; charset=utf-8")
        self.assertIn("source,leads", response.content.decode())
        self.assertTrue(AuditLog.objects.filter(business=self.business, metadata__entity_type="analytics_report").exists())

    def test_scheduled_report_create_sets_actor(self):
        response = self.api.post(
            "/api/scheduled-reports/",
            {
                "business": self.business.id,
                "name": "Weekly owner report",
                "frequency": "weekly",
                "recipients_json": ["owner@example.com"],
                "report_config_json": {"reports": ["source_roi"]},
                "is_active": True,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["created_by_email"], self.owner.email)
