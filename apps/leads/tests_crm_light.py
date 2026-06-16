from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.activities.models import ActivityEvent, Note
from apps.businesses.access import ensure_default_roles
from apps.businesses.models import Business, BusinessMember, BusinessRole
from apps.clients.models import Client
from apps.leads.models import Lead


class LeadCrmLightTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.owner = User.objects.create_user(
            username="crm-light-owner",
            email="crm-light-owner@example.com",
            password="pass12345",
            role=User.Roles.BUSINESS_OWNER,
        )
        self.manager = User.objects.create_user(
            username="crm-light-manager",
            email="crm-light-manager@example.com",
            password="pass12345",
            role=User.Roles.BUSINESS_MANAGER,
        )
        self.other_manager = User.objects.create_user(
            username="crm-light-other-manager",
            email="crm-light-other-manager@example.com",
            password="pass12345",
            role=User.Roles.BUSINESS_MANAGER,
        )
        self.business = Business.objects.create(owner=self.owner, name="CRM Light", slug="crm-light")
        ensure_default_roles(self.business)
        BusinessMember.objects.create(
            business=self.business,
            user=self.owner,
            role=BusinessMember.Roles.OWNER,
            business_role=BusinessRole.objects.get(business=self.business, preset_key=BusinessMember.Roles.OWNER),
        )
        BusinessMember.objects.create(
            business=self.business,
            user=self.manager,
            role=BusinessMember.Roles.MANAGER,
            business_role=BusinessRole.objects.get(business=self.business, preset_key=BusinessMember.Roles.MANAGER),
        )
        BusinessMember.objects.create(
            business=self.business,
            user=self.other_manager,
            role=BusinessMember.Roles.MANAGER,
            business_role=BusinessRole.objects.get(business=self.business, preset_key=BusinessMember.Roles.MANAGER),
        )
        self.client = Client.objects.create(business=self.business, full_name="Assigned Client", phone="+77010000001")
        self.other_client = Client.objects.create(business=self.business, full_name="Other Client", phone="+77010000002")
        self.assigned_lead = Lead.objects.create(
            business=self.business,
            client=self.client,
            message="Assigned lead",
            responsible_user=self.manager,
        )
        self.other_lead = Lead.objects.create(
            business=self.business,
            client=self.other_client,
            message="Other lead",
            responsible_user=self.other_manager,
        )

    def test_owner_sees_all_leads_and_manager_sees_assigned_leads(self):
        self.api.force_authenticate(self.owner)
        owner_response = self.api.get("/api/leads/")
        self.assertEqual(owner_response.status_code, 200)
        self.assertEqual(owner_response.data["count"], 2)

        self.api.force_authenticate(self.manager)
        manager_response = self.api.get("/api/leads/")
        self.assertEqual(manager_response.status_code, 200)
        self.assertEqual(manager_response.data["count"], 1)
        self.assertEqual(manager_response.data["results"][0]["id"], self.assigned_lead.id)

    def test_lead_assign_action_updates_responsible_and_writes_history(self):
        self.api.force_authenticate(self.owner)

        response = self.api.post(
            f"/api/leads/{self.assigned_lead.id}/assign/",
            {"user_id": self.other_manager.id},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assigned_lead.refresh_from_db()
        self.assertEqual(self.assigned_lead.responsible_user, self.other_manager)
        self.assertTrue(
            ActivityEvent.objects.filter(
                business=self.business,
                entity_type="Lead",
                entity_id=str(self.assigned_lead.id),
                event_type="lead_assigned",
            ).exists()
        )

    def test_lead_add_note_creates_comment_and_history(self):
        self.api.force_authenticate(self.manager)

        response = self.api.post(
            f"/api/leads/{self.assigned_lead.id}/add-note/",
            {"text": "Клиент просит перезвонить вечером."},
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(Note.objects.filter(business=self.business, entity_type="Lead", entity_id=str(self.assigned_lead.id)).count(), 1)
        self.assertTrue(
            ActivityEvent.objects.filter(
                business=self.business,
                entity_type="Lead",
                entity_id=str(self.assigned_lead.id),
                event_type="lead_note_added",
            ).exists()
        )

    def test_manager_cannot_update_unassigned_lead(self):
        self.api.force_authenticate(self.manager)

        response = self.api.patch(
            f"/api/leads/{self.other_lead.id}/",
            {"status": Lead.Statuses.CONTACTED},
            format="json",
        )

        self.assertEqual(response.status_code, 404)

    def test_lead_list_supports_filters_pagination_and_enriched_fields(self):
        self.api.force_authenticate(self.owner)
        self.assigned_lead.source = Lead.Sources.WHATSAPP
        self.assigned_lead.save(update_fields=["source", "updated_at"])
        self.other_lead.status = Lead.Statuses.IN_PROGRESS
        self.other_lead.save(update_fields=["status", "updated_at"])

        response = self.api.get(
            "/api/leads/",
            {"search": "Assigned", "source": Lead.Sources.WHATSAPP, "page_size": 1},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(len(response.data["results"]), 1)
        row = response.data["results"][0]
        self.assertEqual(row["id"], self.assigned_lead.id)
        self.assertEqual(row["client_name"], "Assigned Client")
        self.assertEqual(row["client_phone"], "+77010000001")
        self.assertIn("ai_score", row)
        self.assertIn("loss_risk", row)
        self.assertEqual(response.data["facets"]["source"][Lead.Sources.WHATSAPP], 1)
        self.assertEqual(response.data["facets"]["status"][Lead.Statuses.NEW], 1)

    def test_lead_summary_returns_counts_for_access_scope(self):
        self.api.force_authenticate(self.owner)
        self.other_lead.status = Lead.Statuses.IN_PROGRESS
        self.other_lead.responsible_user = None
        self.other_lead.save(update_fields=["status", "responsible_user", "updated_at"])

        response = self.api.get("/api/leads/summary/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["total"], 2)
        self.assertEqual(response.data["unanswered"], 1)
        self.assertEqual(response.data["in_progress"], 1)
        self.assertEqual(response.data["by_status"][Lead.Statuses.IN_PROGRESS], 1)

from apps.crm.models import Deal, Pipeline, PipelineStage
from apps.notifications.models import Notification


class LeadFlowQuickActionTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.owner = User.objects.create_user(
            username="lead-flow-owner",
            email="lead-flow-owner@example.com",
            password="pass12345",
            role=User.Roles.BUSINESS_OWNER,
        )
        self.manager = User.objects.create_user(
            username="lead-flow-manager",
            email="lead-flow-manager@example.com",
            password="pass12345",
            role=User.Roles.BUSINESS_MANAGER,
        )
        self.business = Business.objects.create(owner=self.owner, name="Lead Flow", slug="lead-flow")
        ensure_default_roles(self.business)
        BusinessMember.objects.create(
            business=self.business,
            user=self.owner,
            role=BusinessMember.Roles.OWNER,
            business_role=BusinessRole.objects.get(business=self.business, preset_key=BusinessMember.Roles.OWNER),
        )
        BusinessMember.objects.create(
            business=self.business,
            user=self.manager,
            role=BusinessMember.Roles.MANAGER,
            business_role=BusinessRole.objects.get(business=self.business, preset_key=BusinessMember.Roles.MANAGER),
        )
        self.client = Client.objects.create(business=self.business, full_name="Lead Flow Client", phone="+77010000003")
        self.lead = Lead.objects.create(
            business=self.business,
            client=self.client,
            message="Lead flow quick action",
            responsible_user=self.manager,
        )
        self.pipeline = Pipeline.objects.create(business=self.business, name="Sales", slug="sales", is_default=True)
        self.stage = PipelineStage.objects.create(business=self.business, pipeline=self.pipeline, name="New", order=1, probability=10)
        self.api.force_authenticate(self.owner)

    def test_take_in_work_marks_lead_and_notifies_responsible(self):
        response = self.api.post(f"/api/leads/{self.lead.id}/take-in-work/", {}, format="json")

        self.assertEqual(response.status_code, 200)
        self.lead.refresh_from_db()
        self.assertEqual(self.lead.status, Lead.Statuses.IN_PROGRESS)
        self.assertTrue(
            ActivityEvent.objects.filter(
                business=self.business,
                entity_type="Lead",
                entity_id=str(self.lead.id),
                event_type="lead_taken_in_work",
            ).exists()
        )
        self.assertTrue(Notification.objects.filter(business=self.business, client=self.client, category=Notification.Categories.SALES).exists())

    def test_mark_lost_requires_reason_and_reopen_clears_lost_state(self):
        invalid = self.api.post(f"/api/leads/{self.lead.id}/mark-lost/", {}, format="json")
        valid = self.api.post(f"/api/leads/{self.lead.id}/mark-lost/", {"lost_reason": "No answer"}, format="json")

        self.assertEqual(invalid.status_code, 400)
        self.assertEqual(valid.status_code, 200)
        self.lead.refresh_from_db()
        self.assertEqual(self.lead.status, Lead.Statuses.LOST)
        self.assertEqual(self.lead.lost_reason, "No answer")
        self.assertIsNotNone(self.lead.lost_at)

        reopened = self.api.post(f"/api/leads/{self.lead.id}/reopen/", {}, format="json")

        self.assertEqual(reopened.status_code, 200)
        self.lead.refresh_from_db()
        self.assertEqual(self.lead.status, Lead.Statuses.NEW)
        self.assertEqual(self.lead.lost_reason, "")
        self.assertIsNone(self.lead.lost_at)

    def test_create_deal_from_lead_creates_single_deal_and_moves_lead_to_work(self):
        created = self.api.post(f"/api/leads/{self.lead.id}/create-deal/", {"amount": "25000"}, format="json")
        repeated = self.api.post(f"/api/leads/{self.lead.id}/create-deal/", {"amount": "30000"}, format="json")

        self.assertEqual(created.status_code, 201)
        self.assertEqual(repeated.status_code, 200)
        self.assertEqual(Deal.objects.filter(business=self.business, lead=self.lead).count(), 1)
        deal = Deal.objects.get(business=self.business, lead=self.lead)
        self.assertEqual(deal.client, self.client)
        self.assertEqual(deal.stage, self.stage)
        self.assertEqual(str(deal.amount), "25000.00")
        self.lead.refresh_from_db()
        self.assertEqual(self.lead.status, Lead.Statuses.IN_PROGRESS)
        self.assertTrue(
            ActivityEvent.objects.filter(
                business=self.business,
                entity_type="Deal",
                entity_id=str(deal.id),
                event_type="deal_created_from_lead",
            ).exists()
        )

    def test_mark_closed_sets_success_status(self):
        response = self.api.post(f"/api/leads/{self.lead.id}/mark-closed/", {}, format="json")

        self.assertEqual(response.status_code, 200)
        self.lead.refresh_from_db()
        self.assertEqual(self.lead.status, Lead.Statuses.CLOSED)
