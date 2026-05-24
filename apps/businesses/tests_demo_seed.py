from io import StringIO

from django.core.management import call_command
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.ai_core.models import AIToolCallLog
from apps.billing.models import Subscription
from apps.bots.models import BotConversation, BotMessage
from apps.businesses.models import Business, BusinessMember
from apps.conversations.models import QuickReplyTemplate
from apps.integrations.models import BusinessConnector, BusinessEvent
from apps.leads.models import Lead, LeadForm
from apps.notifications.models import Notification
from apps.services.models import Service
from apps.tasks.models import Task


class PilotDemoSeedCommandTests(TestCase):
    def setUp(self):
        self.api = APIClient()

    def test_seed_pilot_demo_creates_full_smoke_merchant(self):
        call_command(
            "seed_pilot_demo",
            "--reset",
            "--landing-id=demo-test-landing-001",
            "--business-name=Demo Test Beauty",
            "--owner-email=demo-owner@test.local",
            "--owner-password=DemoOwner123!",
            "--manager-email=demo-manager@test.local",
            "--manager-password=DemoManager123!",
            verbosity=0,
        )

        business = Business.objects.get(landing_id="demo-test-landing-001")
        owner = User.objects.get(email="demo-owner@test.local")
        manager = User.objects.get(email="demo-manager@test.local")

        self.assertEqual(business.owner, owner)
        self.assertEqual(business.status, Business.Statuses.TRIAL)
        self.assertTrue(owner.check_password("DemoOwner123!"))
        self.assertTrue(manager.check_password("DemoManager123!"))
        self.assertTrue(BusinessMember.objects.filter(business=business, user=owner, role=BusinessMember.Roles.OWNER).exists())
        self.assertTrue(BusinessMember.objects.filter(business=business, user=manager, role=BusinessMember.Roles.MANAGER).exists())
        self.assertTrue(Subscription.objects.filter(business=business, status=Subscription.Statuses.TRIAL).exists())
        self.assertTrue(LeadForm.objects.filter(business=business, landing_id="demo-test-landing-001", is_active=True).exists())
        self.assertGreaterEqual(Service.objects.filter(business=business).count(), 3)
        self.assertGreaterEqual(Lead.objects.filter(business=business).count(), 3)
        self.assertGreaterEqual(BusinessEvent.objects.filter(business=business, event_type="sale.recorded").count(), 3)
        self.assertTrue(
            BusinessConnector.objects.filter(
                business=business,
                provider=BusinessConnector.Providers.WEBSITE,
                status=BusinessConnector.Statuses.CONNECTED,
            ).exists()
        )
        self.assertTrue(
            BusinessConnector.objects.filter(
                business=business,
                provider=BusinessConnector.Providers.EXCEL_CSV,
                status=BusinessConnector.Statuses.CONNECTED,
            ).exists()
        )
        self.assertTrue(BotConversation.objects.filter(business=business, handoff_required=True, unread_count__gt=0).exists())
        self.assertGreaterEqual(BotMessage.objects.filter(conversation__business=business).count(), 3)
        self.assertTrue(Task.objects.filter(business=business, title__icontains="необработанными").exists())
        self.assertTrue(AIToolCallLog.objects.filter(business=business, tool_name="create_task", status=AIToolCallLog.Statuses.EXECUTED).exists())
        self.assertTrue(Notification.objects.filter(business=business, category="tasks").exists())
        self.assertGreaterEqual(QuickReplyTemplate.objects.filter(business=business, is_active=True).count(), 3)

        # The reset command must be safe to run repeatedly after leads, clients,
        # conversations, notifications and AI tasks already exist.
        call_command(
            "seed_pilot_demo",
            "--reset",
            "--landing-id=demo-test-landing-001",
            "--business-name=Demo Test Beauty",
            "--owner-email=demo-owner@test.local",
            "--owner-password=DemoOwner123!",
            "--manager-email=demo-manager@test.local",
            "--manager-password=DemoManager123!",
            verbosity=0,
        )
        self.assertEqual(Business.objects.filter(landing_id="demo-test-landing-001").count(), 1)
        business = Business.objects.get(landing_id="demo-test-landing-001")
        self.assertGreaterEqual(Lead.objects.filter(business=business).count(), 3)

    def test_seeded_demo_supports_owner_dashboard_and_inbox_summary(self):
        call_command(
            "seed_pilot_demo",
            "--reset",
            "--landing-id=demo-api-landing-001",
            "--owner-email=demo-api-owner@test.local",
            "--owner-password=DemoOwner123!",
            "--manager-email=demo-api-manager@test.local",
            "--manager-password=DemoManager123!",
            verbosity=0,
        )
        owner = User.objects.get(email="demo-api-owner@test.local")
        business = Business.objects.get(landing_id="demo-api-landing-001")
        self.api.force_authenticate(owner)

        dashboard_response = self.api.get(f"/api/analytics/owner-dashboard/?business={business.id}")
        self.assertEqual(dashboard_response.status_code, 200)
        self.assertTrue(dashboard_response.data["data_quality"]["has_sales_data"])
        self.assertGreaterEqual(dashboard_response.data["sales_events_count"], 3)
        self.assertIn("business_pulse", dashboard_response.data)
        self.assertIn("mobile_onboarding", dashboard_response.data)
        self.assertGreaterEqual(dashboard_response.data["setup"]["score"], 60)

        inbox_response = self.api.get(f"/api/inbox/conversations/summary/?business={business.id}")
        self.assertEqual(inbox_response.status_code, 200)
        self.assertGreaterEqual(inbox_response.data["total"], 1)
        self.assertGreaterEqual(inbox_response.data["handoff_required"], 1)
        self.assertTrue(any(channel["key"] == "website" and channel["total"] >= 1 for channel in inbox_response.data["channels"]))

    def test_seed_pilot_demo_can_create_multiple_managers_without_username_collision(self):
        for index in range(2):
            call_command(
                "seed_pilot_demo",
                "--reset",
                f"--landing-id=demo-username-{index}",
                f"--owner-email=demo-owner-{index}@test.local",
                "--owner-password=DemoOwner123!",
                f"--manager-email=demo-manager-{index}@test.local",
                "--manager-password=DemoManager123!",
                verbosity=0,
            )

        managers = User.objects.filter(email__startswith="demo-manager-").order_by("email")
        self.assertEqual(managers.count(), 2)
        self.assertEqual(len({manager.username for manager in managers}), 2)

class PilotDemoLaunchCommandTests(TestCase):
    def test_prepare_pilot_demo_creates_platform_admin_and_demo_launch_pack(self):
        call_command(
            "prepare_pilot_demo",
            "--reset",
            "--landing-id=launch-demo-001",
            "--business-name=Launch Demo Merchant",
            "--platform-email=platform-launch@test.local",
            "--platform-password=Platform123!",
            "--owner-email=launch-owner@test.local",
            "--owner-password=DemoOwner123!",
            "--manager-email=launch-manager@test.local",
            "--manager-password=DemoManager123!",
            verbosity=0,
        )

        platform = User.objects.get(email="platform-launch@test.local")
        business = Business.objects.get(landing_id="launch-demo-001")
        owner = User.objects.get(email="launch-owner@test.local")
        manager = User.objects.get(email="launch-manager@test.local")

        self.assertTrue(platform.is_platform_user)
        self.assertTrue(platform.is_superuser)
        self.assertTrue(platform.check_password("Platform123!"))
        self.assertEqual(business.name, "Launch Demo Merchant")
        self.assertEqual(business.owner, owner)
        self.assertTrue(owner.check_password("DemoOwner123!"))
        self.assertTrue(manager.check_password("DemoManager123!"))
        self.assertTrue(LeadForm.objects.filter(business=business, is_active=True).exists())
        self.assertGreaterEqual(Lead.objects.filter(business=business).count(), 3)
        self.assertGreaterEqual(BotConversation.objects.filter(business=business).count(), 1)
        self.assertGreaterEqual(Task.objects.filter(business=business).count(), 1)

    def test_prepare_pilot_demo_can_be_repeated_with_reset(self):
        for _ in range(2):
            call_command(
                "prepare_pilot_demo",
                "--reset",
                "--landing-id=launch-repeat-001",
                "--platform-email=platform-repeat@test.local",
                "--platform-password=Platform123!",
                "--owner-email=repeat-owner@test.local",
                "--owner-password=DemoOwner123!",
                "--manager-email=repeat-manager@test.local",
                "--manager-password=DemoManager123!",
                verbosity=0,
            )
        self.assertEqual(Business.objects.filter(landing_id="launch-repeat-001").count(), 1)
        self.assertEqual(User.objects.filter(email="platform-repeat@test.local", role=User.Roles.PLATFORM_ADMIN).count(), 1)

    def test_prepare_pilot_demo_prints_launch_gate_details(self):
        output = StringIO()
        call_command(
            "prepare_pilot_demo",
            "--reset",
            "--landing-id=launch-output-001",
            "--platform-email=platform-output@test.local",
            "--platform-password=Platform123!",
            "--owner-email=output-owner@test.local",
            "--owner-password=DemoOwner123!",
            "--manager-email=output-manager@test.local",
            "--manager-password=DemoManager123!",
            stdout=output,
            verbosity=0,
        )

        text = output.getvalue()
        self.assertIn("Lead form public_id:", text)
        self.assertIn("PUBLIC FORM CURL", text)
        self.assertIn("KEY API CHECKS", text)
        self.assertIn("PILOT SAFE PROMISES — CAN SHOW", text)
        self.assertIn("PILOT SAFE PROMISES — DO NOT PROMISE", text)
        self.assertIn("python manage.py pilot_launch_quality_gate", text)

    def test_pilot_launch_quality_gate_checks_prepared_demo(self):
        call_command(
            "prepare_pilot_demo",
            "--reset",
            "--landing-id=launch-gate-001",
            "--platform-email=platform-gate@test.local",
            "--platform-password=Platform123!",
            "--owner-email=gate-owner@test.local",
            "--owner-password=DemoOwner123!",
            "--manager-email=gate-manager@test.local",
            "--manager-password=DemoManager123!",
            verbosity=0,
        )
        output = StringIO()
        call_command(
            "pilot_launch_quality_gate",
            "--landing-id=launch-gate-001",
            "--platform-email=platform-gate@test.local",
            "--platform-password=Platform123!",
            "--owner-email=gate-owner@test.local",
            "--owner-password=DemoOwner123!",
            "--manager-email=gate-manager@test.local",
            "--manager-password=DemoManager123!",
            stdout=output,
            verbosity=0,
        )

        text = output.getvalue()
        self.assertIn("Pilot launch quality gate passed.", text)
        self.assertIn("Lead form public_id:", text)
