from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.billing.models import Subscription, SubscriptionPlan
from apps.businesses.models import Business, BusinessMember


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
