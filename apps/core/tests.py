from datetime import datetime, time
from zoneinfo import ZoneInfo

from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.businesses.models import Business, BusinessMember
from apps.clients.models import Client
from apps.core.models import AuditLog
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
