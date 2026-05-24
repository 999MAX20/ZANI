from datetime import datetime, time
from pathlib import Path
from tempfile import TemporaryDirectory
from zoneinfo import ZoneInfo

from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.checks import run_checks
from django.test import override_settings
from django.test import TestCase
from django.urls import reverse
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.ai_core.models import AIRequestLog
from apps.billing.models import Subscription, SubscriptionPlan, UsageCounter
from apps.businesses.models import Business, BusinessMember
from apps.bots.models import Bot, BotChannel, BotConversation
from apps.clients.models import Client
from apps.core.models import AuditLog
from apps.core.file_validation import normalize_extension, validate_file_upload
from apps.leads.models import Lead
from apps.scheduling.models import Resource, WorkingHours
from apps.services.models import Service


class TenantIsolationApiTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.owner_a = User.objects.create_user(username="owner-a", email="owner-a@example.com", password="pass")
        self.owner_b = User.objects.create_user(username="owner-b", email="owner-b@example.com", password="pass")
        self.business_a = Business.objects.create(owner=self.owner_a, name="Business A", slug="business-a")
        self.business_b = Business.objects.create(owner=self.owner_b, name="Business B", slug="business-b")
        BusinessMember.objects.create(business=self.business_a, user=self.owner_a, role=BusinessMember.Roles.OWNER)
        BusinessMember.objects.create(business=self.business_b, user=self.owner_b, role=BusinessMember.Roles.OWNER)
        self.client_a = Client.objects.create(business=self.business_a, full_name="Client A")
        self.client_b = Client.objects.create(business=self.business_b, full_name="Client B")

    def test_list_is_filtered_to_user_business(self):
        self.api.force_authenticate(self.owner_a)

        response = self.api.get("/api/clients/")

        self.assertEqual(response.status_code, 200)
        names = [item["full_name"] for item in response.data["results"]]
        self.assertIn("Client A", names)
        self.assertNotIn("Client B", names)

    def test_user_cannot_create_object_in_foreign_business(self):
        self.api.force_authenticate(self.owner_a)

        response = self.api.post(
            "/api/clients/",
            {"business": self.business_b.id, "full_name": "Intruder", "source": "manual"},
            format="json",
        )

        self.assertEqual(response.status_code, 403)

    def test_mutation_writes_audit_log(self):
        self.api.force_authenticate(self.owner_a)

        response = self.api.post(
            "/api/clients/",
            {"business": self.business_a.id, "full_name": "Audited Client", "source": "manual"},
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertTrue(
            AuditLog.objects.filter(
                business=self.business_a,
                actor=self.owner_a,
                action=AuditLog.Actions.CREATE,
                entity_type="Client",
            ).exists()
        )


class LeadAppointmentActionTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.owner = User.objects.create_user(username="owner", email="owner-action@example.com", password="pass")
        self.business = Business.objects.create(
            owner=self.owner,
            name="Action Clinic",
            slug="action-clinic",
            timezone="Asia/Almaty",
        )
        BusinessMember.objects.create(business=self.business, user=self.owner, role=BusinessMember.Roles.OWNER)
        self.client = Client.objects.create(business=self.business, full_name="Client")
        self.service = Service.objects.create(business=self.business, name="Consultation", duration_minutes=60)
        self.resource = Resource.objects.create(business=self.business, name="Room 1")
        self.lead = Lead.objects.create(business=self.business, client=self.client, service=self.service)
        WorkingHours.objects.create(
            business=self.business,
            resource=self.resource,
            weekday=0,
            start_time=time(9, 0),
            end_time=time(18, 0),
        )

    def test_create_appointment_from_lead_action_is_atomic(self):
        self.api.force_authenticate(self.owner)

        response = self.api.post(
            reverse("lead-create-appointment", kwargs={"pk": self.lead.id}),
            {
                "service": self.service.id,
                "resource": self.resource.id,
                "start_at": "2026-05-11T10:00:00+05:00",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.lead.refresh_from_db()
        self.assertEqual(self.lead.status, Lead.Statuses.APPOINTMENT_CREATED)
        self.assertEqual(response.data["lead"], self.lead.id)

    def test_create_appointment_from_lead_rejects_busy_slot(self):
        self.api.force_authenticate(self.owner)
        payload = {
            "service": self.service.id,
            "resource": self.resource.id,
            "start_at": "2026-05-11T10:00:00+05:00",
        }
        first_response = self.api.post(reverse("lead-create-appointment", kwargs={"pk": self.lead.id}), payload, format="json")

        second_lead = Lead.objects.create(business=self.business, client=self.client, service=self.service)
        second_response = self.api.post(reverse("lead-create-appointment", kwargs={"pk": second_lead.id}), payload, format="json")

        self.assertEqual(first_response.status_code, 201)
        self.assertEqual(second_response.status_code, 400)


class PlatformAccessFoundationTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.owner = User.objects.create_user(
            username="merchant-owner",
            email="merchant-owner@example.com",
            password="pass",
            role=User.Roles.BUSINESS_OWNER,
        )
        self.business = Business.objects.create(owner=self.owner, name="Merchant", slug="merchant")
        BusinessMember.objects.create(business=self.business, user=self.owner, role=BusinessMember.Roles.OWNER)

    def test_platform_users_can_ping_platform(self):
        for role in [User.Roles.PLATFORM_ADMIN, User.Roles.PLATFORM_MANAGER]:
            user = User.objects.create_user(
                username=f"{role}-user",
                email=f"{role}@example.com",
                password="pass",
                role=role,
            )
            self.api.force_authenticate(user)

            response = self.api.get("/api/platform/ping/")

            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.data["scope"], "platform")

    def test_merchant_users_cannot_ping_platform(self):
        for role in [
            User.Roles.BUSINESS_OWNER,
            User.Roles.BUSINESS_MANAGER,
            User.Roles.MANAGER,
            User.Roles.STAFF,
        ]:
            user = User.objects.create_user(
                username=f"{role}-user",
                email=f"{role}@example.com",
                password="pass",
                role=role,
            )
            self.api.force_authenticate(user)

            response = self.api.get("/api/platform/ping/")

            self.assertEqual(response.status_code, 403)

    def test_auth_me_returns_role_flags_and_businesses_for_merchant(self):
        self.api.force_authenticate(self.owner)

        response = self.api.get("/api/auth/me/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["email"], self.owner.email)
        self.assertFalse(response.data["is_platform_user"])
        self.assertTrue(response.data["is_merchant_user"])
        self.assertFalse(response.data["is_business_manager"])
        self.assertEqual(len(response.data["businesses"]), 1)
        self.assertEqual(response.data["businesses"][0]["id"], self.business.id)

    def test_auth_me_supports_platform_user_without_business_membership(self):
        platform_user = User.objects.create_user(
            username="platform-manager",
            email="platform-manager@example.com",
            password="pass",
            role=User.Roles.PLATFORM_MANAGER,
        )
        self.api.force_authenticate(platform_user)

        response = self.api.get("/api/auth/me/")

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["is_platform_user"])
        self.assertFalse(response.data["is_merchant_user"])
        self.assertEqual(response.data["businesses"], [])


class ProductionReadinessTests(TestCase):
    def setUp(self):
        self.api = APIClient()

    def test_readiness_endpoint_checks_database(self):
        response = self.api.get("/ready/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["checks"]["database"], "ok")

    @override_settings(
        ENVIRONMENT="production",
        DEBUG=True,
        SECRET_KEY="short",
        ALLOWED_HOSTS=["*"],
        CORS_ALLOWED_ORIGINS=[],
        CSRF_TRUSTED_ORIGINS=[],
        SENTRY_DSN="",
    )
    def test_production_settings_check_warns_about_unsafe_baseline(self):
        warning_ids = {warning.id for warning in run_checks()}

        self.assertIn("zani.W001", warning_ids)
        self.assertIn("zani.W002", warning_ids)
        self.assertIn("zani.W003", warning_ids)
        self.assertIn("zani.W004", warning_ids)
        self.assertIn("zani.W005", warning_ids)
        self.assertIn("zani.W006", warning_ids)


class PilotReadinessChecklistTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.owner = User.objects.create_user(
            username="pilot-owner",
            email="pilot-owner@example.com",
            password="pass",
            role=User.Roles.BUSINESS_OWNER,
        )
        self.business = Business.objects.create(owner=self.owner, name="Pilot Clinic", slug="pilot-clinic", city="")
        BusinessMember.objects.create(business=self.business, user=self.owner, role=BusinessMember.Roles.OWNER)

    def test_pilot_readiness_uses_actionable_statuses_and_links(self):
        self.api.force_authenticate(self.owner)

        response = self.api.get("/api/pilot/readiness/", {"business": self.business.id})

        self.assertEqual(response.status_code, 200)
        statuses = {item["status"] for item in response.data["items"]}
        keys = {item["key"]: item for item in response.data["items"]}
        self.assertNotIn("partial", statuses)
        self.assertIn("needs_attention", statuses)
        self.assertIn("crm_configured", keys)
        self.assertIn("working_hours", keys)
        self.assertEqual(keys["ai_assistant"]["href"], "/dashboard/ai-assistant")
        self.assertTrue(all("href" in item for item in response.data["items"]))


class PlatformDashboardTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.platform_admin = User.objects.create_user(
            username="platform-admin-dashboard",
            email="platform-admin-dashboard@example.com",
            password="pass",
            role=User.Roles.PLATFORM_ADMIN,
        )
        self.platform_manager = User.objects.create_user(
            username="platform-manager-dashboard",
            email="platform-manager-dashboard@example.com",
            password="pass",
            role=User.Roles.PLATFORM_MANAGER,
        )
        self.owner = User.objects.create_user(
            username="merchant-dashboard",
            email="merchant-dashboard@example.com",
            password="pass",
            role=User.Roles.BUSINESS_OWNER,
        )
        self.business = Business.objects.create(
            owner=self.owner,
            name="Dashboard Clinic",
            slug="dashboard-clinic",
            status=Business.Statuses.ACTIVE,
        )
        BusinessMember.objects.create(business=self.business, user=self.owner, role=BusinessMember.Roles.OWNER)
        self.trial_business = Business.objects.create(
            owner=self.owner,
            name="Trial Clinic",
            slug="trial-clinic",
            status=Business.Statuses.TRIAL,
        )
        self.plan = SubscriptionPlan.objects.create(name="Growth", code="growth-test", monthly_price=9900)
        Subscription.objects.create(business=self.business, plan=self.plan, status=Subscription.Statuses.ACTIVE)
        UsageCounter.objects.create(
            business=self.business,
            period_start="2026-05-01",
            period_end="2026-06-01",
            metric=UsageCounter.Metrics.AI_REQUESTS,
            value=7,
        )
        self.bot = Bot.objects.create(business=self.business, name="Clinic Bot", status=Bot.Statuses.ACTIVE)
        BotChannel.objects.create(bot=self.bot, channel=BotChannel.Channels.TELEGRAM, status=BotChannel.Statuses.ACTIVE)
        BotConversation.objects.create(business=self.business, bot=self.bot, channel=BotConversation.Channels.TELEGRAM)
        AIRequestLog.objects.create(
            business=self.business,
            user=self.owner,
            source=AIRequestLog.Sources.CRM,
            prompt_type="summary",
        )

    def test_platform_users_can_open_overview_and_merchants(self):
        for user in [self.platform_admin, self.platform_manager]:
            self.api.force_authenticate(user)

            overview = self.api.get("/api/platform/overview/")
            merchants = self.api.get("/api/platform/merchants/")

            self.assertEqual(overview.status_code, 200)
            self.assertEqual(merchants.status_code, 200)
            self.assertGreaterEqual(overview.data["total_businesses"], 2)
            self.assertEqual(overview.data["active_subscriptions"], 1)
            self.assertEqual(overview.data["mrr_estimate"], "9900")
            self.assertEqual(overview.data["bot_count"], 1)
            self.assertEqual(overview.data["active_bot_channels"], 1)
            self.assertEqual(overview.data["ai_requests_30d"], 1)
            self.assertEqual(overview.data["conversations_30d"], 1)
            merchant = next(item for item in merchants.data if item["id"] == self.business.id)
            self.assertEqual(merchant["owner"]["email"], self.owner.email)
            self.assertEqual(merchant["plan"]["name"], self.plan.name)
            self.assertEqual(merchant["subscription_status"], Subscription.Statuses.ACTIVE)
            self.assertTrue(merchant["usage_summary"])

    def test_merchant_user_cannot_open_platform_dashboard_api(self):
        self.api.force_authenticate(self.owner)

        overview = self.api.get("/api/platform/overview/")
        merchants = self.api.get("/api/platform/merchants/")

        self.assertEqual(overview.status_code, 403)
        self.assertEqual(merchants.status_code, 403)


class FileSafetyFoundationTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.user = User.objects.create_user(username="file-user", email="file-user@example.com", password="pass")
        self.other_user = User.objects.create_user(username="other-file-user", email="other-file-user@example.com", password="pass")
        self.business = Business.objects.create(owner=self.user, name="File Safety Business", slug="file-safety-business")
        self.other_business = Business.objects.create(owner=self.other_user, name="Other File Safety Business", slug="other-file-safety-business")
        BusinessMember.objects.create(business=self.business, user=self.user, role=BusinessMember.Roles.OWNER)
        BusinessMember.objects.create(business=self.other_business, user=self.other_user, role=BusinessMember.Roles.OWNER)

    def test_file_validation_accepts_allowed_file(self):
        uploaded = SimpleUploadedFile("document.pdf", b"content", content_type="application/pdf")

        self.assertEqual(normalize_extension(uploaded.name), "pdf")
        self.assertIs(validate_file_upload(uploaded, max_size_mb=1), uploaded)

    def test_file_validation_rejects_extension_content_type_and_size(self):
        bad_extension = SimpleUploadedFile("payload.exe", b"content", content_type="application/octet-stream")
        bad_type = SimpleUploadedFile("document.pdf", b"content", content_type="application/octet-stream")
        too_large = SimpleUploadedFile("document.pdf", b"x" * 11, content_type="application/pdf")

        with self.assertRaises(ValidationError):
            validate_file_upload(bad_extension)
        with self.assertRaises(ValidationError):
            validate_file_upload(bad_type)
        with self.assertRaises(ValidationError):
            validate_file_upload(too_large, max_size_mb=0.000001)

    def test_private_media_endpoint_requires_auth_and_serves_private_file(self):
        with TemporaryDirectory() as temp_dir, override_settings(PRIVATE_MEDIA_ROOT=temp_dir, USE_S3=False):
            private_file = Path(temp_dir) / f"business-{self.business.id}" / "note.txt"
            private_file.parent.mkdir(parents=True)
            private_file.write_text("secret note")

            private_url = f"/api/files/private/business-{self.business.id}/note.txt/"
            anonymous_response = self.api.get(private_url)
            self.assertEqual(anonymous_response.status_code, 401)

            self.api.force_authenticate(self.user)
            response = self.api.get(private_url)

            self.assertEqual(response.status_code, 200)
            self.assertEqual(b"".join(response.streaming_content), b"secret note")

    def test_private_media_endpoint_blocks_another_business_prefix(self):
        with TemporaryDirectory() as temp_dir, override_settings(PRIVATE_MEDIA_ROOT=temp_dir, USE_S3=False):
            private_file = Path(temp_dir) / f"business-{self.business.id}" / "note.txt"
            private_file.parent.mkdir(parents=True)
            private_file.write_text("secret note")

            self.api.force_authenticate(self.other_user)
            response = self.api.get(f"/api/files/private/business-{self.business.id}/note.txt/")

            self.assertEqual(response.status_code, 404)

    def test_private_media_endpoint_blocks_missing_files(self):
        with TemporaryDirectory() as temp_dir, override_settings(PRIVATE_MEDIA_ROOT=temp_dir, USE_S3=False):
            self.api.force_authenticate(self.user)

            response = self.api.get("/api/files/private/missing.txt/")

            self.assertEqual(response.status_code, 404)
