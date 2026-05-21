from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.ai_core.services import run_ai_request
from apps.billing.entitlements import EntitlementMetrics, assert_entitlement_allows, entitlement_summary
from apps.billing.models import Subscription, SubscriptionPlan, UsageCounter
from apps.billing.usage import check_limit, increment_usage
from apps.bots.models import Bot
from apps.businesses.models import Business, BusinessMember
from apps.clients.models import Client
from apps.core.models import FileAttachment


class BillingFoundationTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.owner = User.objects.create_user(
            username="billing-owner",
            email="billing-owner@example.com",
            password="pass",
            role=User.Roles.BUSINESS_OWNER,
        )
        self.business = Business.objects.create(owner=self.owner, name="Billing Clinic", slug="billing-clinic")
        BusinessMember.objects.create(business=self.business, user=self.owner, role=BusinessMember.Roles.OWNER)

    def test_public_plans_are_available_without_auth(self):
        response = self.api.get("/api/billing/plans/")

        self.assertEqual(response.status_code, 200)
        codes = [item["code"] for item in response.data["results"]]
        self.assertIn("start", codes)
        self.assertIn("growth", codes)

    def test_current_subscription_returns_null_when_missing(self):
        self.api.force_authenticate(self.owner)

        response = self.api.get("/api/billing/current-subscription/")

        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.data)

    def test_current_subscription_returns_merchant_subscription(self):
        plan = SubscriptionPlan.objects.get(code="start")
        subscription = Subscription.objects.create(business=self.business, plan=plan)
        self.api.force_authenticate(self.owner)

        response = self.api.get("/api/billing/current-subscription/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["id"], subscription.id)
        self.assertEqual(response.data["business"], self.business.id)
        self.assertEqual(response.data["plan"]["code"], "start")

    def test_current_subscription_requires_auth(self):
        response = self.api.get("/api/billing/current-subscription/")

        self.assertEqual(response.status_code, 401)

    def test_usage_counter_increments_and_reads_plan_limit(self):
        plan = SubscriptionPlan.objects.get(code="start")
        plan.limits_json = {"ai_requests": 10}
        plan.save(update_fields=["limits_json"])
        Subscription.objects.create(business=self.business, plan=plan)

        increment_usage(self.business, UsageCounter.Metrics.AI_REQUESTS, amount=3)
        result = check_limit(self.business, UsageCounter.Metrics.AI_REQUESTS)

        self.assertEqual(result["value"], 3)
        self.assertEqual(result["limit"], 10)
        self.assertFalse(result["is_over_limit"])

    def test_usage_summary_endpoint_returns_current_business_usage(self):
        increment_usage(self.business, UsageCounter.Metrics.BOT_MESSAGES, amount=2)
        client = Client.objects.create(business=self.business, full_name="Storage Client")
        FileAttachment.objects.create(
            business=self.business,
            uploaded_by=self.owner,
            original_name="contract.pdf",
            content_type="application/pdf",
            size=2048,
            entity_type="client",
            entity_id=str(client.id),
        )
        self.api.force_authenticate(self.owner)

        response = self.api.get("/api/billing/usage-summary/")

        self.assertEqual(response.status_code, 200)
        metrics = {item["metric"]: item for item in response.data}
        self.assertEqual(metrics["bot_messages"]["value"], 2)
        self.assertEqual(metrics["storage_mb"]["value_bytes"], 2048)

    def test_entitlement_summary_includes_plan_limits(self):
        plan = SubscriptionPlan.objects.get(code="start")
        plan.limits_json = {"bots": 1, "users": 2}
        plan.save(update_fields=["limits_json"])
        Subscription.objects.create(business=self.business, plan=plan)

        summary = {item["metric"]: item for item in entitlement_summary(self.business)}

        self.assertEqual(summary[EntitlementMetrics.BOTS]["limit"], 1)
        self.assertEqual(summary[EntitlementMetrics.USERS]["value"], 1)
        self.assertEqual(summary[EntitlementMetrics.USERS]["remaining"], 1)

    def test_entitlement_endpoint_requires_billing_access(self):
        plan = SubscriptionPlan.objects.get(code="growth")
        Subscription.objects.create(business=self.business, plan=plan)
        self.api.force_authenticate(self.owner)

        response = self.api.get("/api/billing/entitlements/")

        self.assertEqual(response.status_code, 200)
        metrics = {item["metric"]: item for item in response.data}
        self.assertIn(EntitlementMetrics.USERS, metrics)
        self.assertIn(EntitlementMetrics.STORAGE_MB, metrics)

    def test_ai_request_is_rejected_when_plan_limit_is_exceeded(self):
        plan = SubscriptionPlan.objects.get(code="start")
        plan.limits_json = {"ai_requests": 0}
        plan.save(update_fields=["limits_json"])
        Subscription.objects.create(business=self.business, plan=plan)

        with self.assertRaises(Exception) as context:
            run_ai_request(
                business=self.business,
                user=self.owner,
                prompt_type="test",
                user_input="hello",
                allow_mock=True,
            )

        self.assertIn("Plan limit exceeded", str(context.exception))

    def test_bot_creation_is_rejected_when_plan_limit_is_exceeded(self):
        plan = SubscriptionPlan.objects.get(code="start")
        plan.limits_json = {"bots": 1}
        plan.save(update_fields=["limits_json"])
        Subscription.objects.create(business=self.business, plan=plan)
        Bot.objects.create(business=self.business, name="Existing bot")
        self.api.force_authenticate(self.owner)

        response = self.api.post(
            "/api/bots/",
            {"business": self.business.id, "name": "Second bot"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("entitlement", response.data)

    def test_member_creation_is_rejected_when_user_limit_is_exceeded(self):
        plan = SubscriptionPlan.objects.get(code="start")
        plan.limits_json = {"users": 1}
        plan.save(update_fields=["limits_json"])
        Subscription.objects.create(business=self.business, plan=plan)
        user = User.objects.create_user(username="new-member", email="new-member@example.com", password="pass")
        self.api.force_authenticate(self.owner)

        response = self.api.post(
            "/api/business-members/",
            {
                "business": self.business.id,
                "user": user.id,
                "role": BusinessMember.Roles.STAFF,
                "is_active": True,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("entitlement", response.data)

    def test_assert_entitlement_allows_uses_current_plus_requested(self):
        plan = SubscriptionPlan.objects.get(code="start")
        plan.limits_json = {"conversations": 2}
        plan.save(update_fields=["limits_json"])
        Subscription.objects.create(business=self.business, plan=plan)
        increment_usage(self.business, UsageCounter.Metrics.CONVERSATIONS, amount=2)

        with self.assertRaises(Exception):
            assert_entitlement_allows(self.business, EntitlementMetrics.CONVERSATIONS)
