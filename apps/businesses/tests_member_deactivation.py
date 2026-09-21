from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken

from apps.accounts.models import User
from apps.activities.models import ActivityEvent
from apps.businesses.models import Business, BusinessMember
from apps.clients.models import Client
from apps.core.models import AuditLog
from apps.crm.models import Deal, Pipeline, PipelineStage
from apps.leads.models import Lead
from apps.tasks.models import Task


class MemberDeactivationFlowTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.owner = User.objects.create_user(username="departure-owner", email="departure-owner@example.test")
        cls.staff = User.objects.create_user(username="departure-staff", email="departure-staff@example.test")
        cls.replacement = User.objects.create_user(username="departure-new", email="departure-new@example.test")
        cls.foreign_owner = User.objects.create_user(username="departure-foreign", email="departure-foreign@example.test")
        cls.business = Business.objects.create(owner=cls.owner, name="Departure", slug="departure")
        cls.other = Business.objects.create(owner=cls.foreign_owner, name="Other", slug="departure-other")
        BusinessMember.objects.create(business=cls.business, user=cls.owner, role=BusinessMember.Roles.OWNER)
        cls.membership = BusinessMember.objects.create(business=cls.business, user=cls.staff, role=BusinessMember.Roles.MANAGER)
        BusinessMember.objects.create(business=cls.business, user=cls.replacement, role=BusinessMember.Roles.MANAGER)
        BusinessMember.objects.create(business=cls.other, user=cls.foreign_owner, role=BusinessMember.Roles.OWNER)
        BusinessMember.objects.create(business=cls.other, user=cls.staff, role=BusinessMember.Roles.MANAGER)
        cls.customer = Client.objects.create(business=cls.business, full_name="Retained customer")
        cls.other_customer = Client.objects.create(business=cls.other, full_name="Other customer")
        cls.lead = Lead.objects.create(business=cls.business, client=cls.customer, responsible_user=cls.staff)
        cls.task = Task.objects.create(business=cls.business, client=cls.customer, title="Unfinished", assignee=cls.staff)
        pipeline = Pipeline.objects.create(business=cls.business, name="Sales", slug="departure-sales")
        stage = PipelineStage.objects.create(business=cls.business, pipeline=pipeline, name="Open")
        cls.deal = Deal.objects.create(business=cls.business, client=cls.customer, owner=cls.staff,
                                      pipeline=pipeline, stage=stage, title="Unfinished sale")
        cls.event = ActivityEvent.objects.create(business=cls.business, client=cls.customer, actor=cls.staff,
                                                event_type="client_updated", text="Retained history")

    def setUp(self):
        self.api = APIClient()
        self.api.force_authenticate(self.owner)

    def deactivate(self, route="team/members"):
        response = self.api.patch(f"/api/{route}/{self.membership.pk}/", {"is_active": False}, format="json")
        self.assertEqual(response.status_code, 200, response.data)

    def test_existing_token_loses_only_deactivated_business_access(self):
        token = AccessToken.for_user(self.staff)
        token["auth_epoch"] = self.staff.auth_epoch
        staff_api = APIClient()
        staff_api.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        self.assertEqual(staff_api.get(f"/api/clients/{self.customer.pk}/").status_code, 200)
        self.assertEqual(staff_api.get(f"/api/clients/{self.other_customer.pk}/").status_code, 200)
        for route in ("team/members", "business-members"):
            with self.subTest(route=route):
                self.membership.is_active = True
                self.membership.save(update_fields=["is_active"])
                self.deactivate(route)
                self.assertEqual(staff_api.get(f"/api/clients/{self.customer.pk}/").status_code, 404)
                self.assertEqual(staff_api.patch(f"/api/clients/{self.customer.pk}/", {"full_name": "Forbidden"}, format="json").status_code, 404)
                self.assertEqual(staff_api.get(f"/api/clients/{self.other_customer.pk}/").status_code, 200)
                self.staff.refresh_from_db()
                self.assertTrue(self.staff.is_active)

    def test_deactivation_retains_history_and_work_until_explicit_reassignment(self):
        self.deactivate()
        self.event.refresh_from_db()
        self.assertEqual(self.event.actor_id, self.staff.pk)
        self.assertEqual(self.event.text, "Retained history")
        work = ((self.lead, "responsible_user_id", "leads", "assign"),
                (self.task, "assignee_id", "tasks", "assign"),
                (self.deal, "owner_id", "deals", "assign-owner"))
        for item, field, resource, action in work:
            with self.subTest(resource=resource):
                status = item.status
                item.refresh_from_db()
                self.assertEqual(getattr(item, field), self.staff.pk)
                self.assertEqual(item.status, status)
                self.assertFalse(item.is_archived)
                response = self.api.post(f"/api/{resource}/{item.pk}/{action}/", {"user_id": self.replacement.pk}, format="json")
                self.assertEqual(response.status_code, 200, response.data)
                item.refresh_from_db()
                self.assertEqual(getattr(item, field), self.replacement.pk)
                self.assertEqual(item.status, status)
        self.assertTrue(AuditLog.objects.filter(business=self.business, entity_type="BusinessMember", entity_id=str(self.membership.pk)).exists())
        self.event.refresh_from_db()
        self.assertEqual(self.event.actor_id, self.staff.pk)

    def test_inactive_member_cannot_receive_new_assignments(self):
        self.deactivate()
        for item, resource, action in ((self.lead, "leads", "assign"), (self.task, "tasks", "assign"), (self.deal, "deals", "assign-owner")):
            with self.subTest(resource=resource):
                response = self.api.post(f"/api/{resource}/{item.pk}/{action}/", {"user_id": self.staff.pk}, format="json")
                self.assertEqual(response.status_code, 400, response.data)

    def test_manager_cannot_deactivate_team_member(self):
        self.api.force_authenticate(self.replacement)
        for route in ("team/members", "business-members"):
            response = self.api.patch(f"/api/{route}/{self.membership.pk}/", {"is_active": False}, format="json")
            self.assertIn(response.status_code, (403, 404))
            self.membership.refresh_from_db()
            self.assertTrue(self.membership.is_active)

    def test_foreign_owner_cannot_deactivate_membership(self):
        self.api.force_authenticate(self.foreign_owner)
        for route in ("team/members", "business-members"):
            response = self.api.patch(f"/api/{route}/{self.membership.pk}/", {"is_active": False}, format="json")
            self.assertEqual(response.status_code, 404, response.data)
        self.membership.refresh_from_db()
        self.assertTrue(self.membership.is_active)
