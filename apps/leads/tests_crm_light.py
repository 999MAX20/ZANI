from datetime import datetime, time
from zoneinfo import ZoneInfo

from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.activities.models import ActivityEvent, Note
from apps.activities.taxonomy import ActivityEvents
from apps.businesses.access import ensure_default_roles
from apps.businesses.models import Business, BusinessMember, BusinessRole
from apps.clients.models import Client
from apps.core.models import AuditLog
from apps.leads.models import Lead
from apps.scheduling.models import Appointment, WorkingHours
from apps.services.models import Service
from apps.tasks.models import Task


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

    def test_manager_cannot_assign_unowned_lead(self):
        self.api.force_authenticate(self.manager)

        response = self.api.post(
            f"/api/leads/{self.other_lead.id}/assign/",
            {"user_id": self.manager.id},
            format="json",
        )

        self.assertEqual(response.status_code, 404)
        self.other_lead.refresh_from_db()
        self.assertEqual(self.other_lead.responsible_user, self.other_manager)

    def test_generic_patch_cannot_bypass_lead_lifecycle_actions(self):
        self.api.force_authenticate(self.owner)

        response = self.api.patch(
            f"/api/leads/{self.assigned_lead.id}/",
            {"status": Lead.Statuses.LOST, "lost_reason": "Bypass attempt"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["fields"], ["lost_reason", "status"])
        self.assigned_lead.refresh_from_db()
        self.assertEqual(self.assigned_lead.status, Lead.Statuses.NEW)
        self.assertEqual(self.assigned_lead.lost_reason, "")

    def test_generic_patch_cannot_bypass_lead_archive_action(self):
        self.api.force_authenticate(self.owner)

        response = self.api.patch(
            f"/api/leads/{self.assigned_lead.id}/",
            {"is_archived": True, "archive_reason": "Bypass attempt"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["fields"], ["archive_reason", "is_archived"])
        self.assigned_lead.refresh_from_db()
        self.assertFalse(self.assigned_lead.is_archived)
        self.assertEqual(self.assigned_lead.archive_reason, "")

    def test_create_lead_cannot_seed_archive_state(self):
        self.api.force_authenticate(self.owner)

        response = self.api.post(
            "/api/leads/",
            {
                "business": self.business.id,
                "client": self.client.id,
                "message": "Archived at birth",
                "is_archived": True,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["fields"], ["is_archived"])

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
        self.assertEqual(response.data["attention"], 1)
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
        self.business = Business.objects.create(owner=self.owner, name="Lead Flow", slug="lead-flow", timezone="Asia/Almaty")
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
                event_type=ActivityEvents.LEAD_TAKEN_IN_WORK,
            ).exists()
        )
        self.assertTrue(
            AuditLog.objects.filter(
                business=self.business,
                entity_type="Lead",
                entity_id=str(self.lead.id),
                metadata__kind="lifecycle",
                metadata__event_type=ActivityEvents.LEAD_TAKEN_IN_WORK,
                metadata__lifecycle_action=ActivityEvents.LEAD_TAKEN_IN_WORK,
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
        self.assertTrue(
            AuditLog.objects.filter(
                business=self.business,
                entity_type="Lead",
                entity_id=str(self.lead.id),
                metadata__kind="lifecycle",
                metadata__event_type=ActivityEvents.LEAD_LOST,
                metadata__lifecycle_action=ActivityEvents.LEAD_LOST,
                metadata__lost_reason="No answer",
            ).exists()
        )
        self.assertTrue(
            AuditLog.objects.filter(
                business=self.business,
                entity_type="Lead",
                entity_id=str(self.lead.id),
                metadata__kind="lifecycle",
                metadata__event_type=ActivityEvents.LEAD_REOPENED,
                metadata__lifecycle_action=ActivityEvents.LEAD_REOPENED,
                metadata__cleared_lost_reason="No answer",
            ).exists()
        )
        self.assertTrue(
            ActivityEvent.objects.filter(
                business=self.business,
                entity_type="Lead",
                entity_id=str(self.lead.id),
                event_type=ActivityEvents.LEAD_LOST,
                metadata__lost_reason="No answer",
            ).exists()
        )
        self.assertTrue(
            ActivityEvent.objects.filter(
                business=self.business,
                entity_type="Lead",
                entity_id=str(self.lead.id),
                event_type=ActivityEvents.LEAD_REOPENED,
                metadata__cleared_lost_reason="No answer",
            ).exists()
        )

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

    def test_obsolete_convert_client_route_is_not_available(self):
        response = self.api.post(f"/api/leads/{self.lead.id}/convert-client/", {}, format="json")

        self.assertEqual(response.status_code, 404)
        self.assertFalse(
            ActivityEvent.objects.filter(
                business=self.business,
                entity_type="Lead",
                entity_id=str(self.lead.id),
                event_type=ActivityEvents.LEAD_CONVERTED_TO_CLIENT,
            ).exists()
        )
        self.assertFalse(
            AuditLog.objects.filter(
                business=self.business,
                entity_type="Lead",
                entity_id=str(self.lead.id),
                metadata__kind="conversion",
            ).exists()
        )

    def test_mark_closed_sets_success_status(self):
        response = self.api.post(f"/api/leads/{self.lead.id}/mark-closed/", {}, format="json")

        self.assertEqual(response.status_code, 200)
        self.lead.refresh_from_db()
        self.assertEqual(self.lead.status, Lead.Statuses.CLOSED)
        self.assertTrue(
            ActivityEvent.objects.filter(
                business=self.business,
                entity_type="Lead",
                entity_id=str(self.lead.id),
                event_type=ActivityEvents.LEAD_CLOSED,
            ).exists()
        )
        self.assertTrue(
            AuditLog.objects.filter(
                business=self.business,
                entity_type="Lead",
                entity_id=str(self.lead.id),
                metadata__kind="lifecycle",
                metadata__event_type=ActivityEvents.LEAD_CLOSED,
                metadata__lifecycle_action=ActivityEvents.LEAD_CLOSED,
            ).exists()
        )

    def test_create_appointment_from_lead_uses_contract_and_writes_activity_audit(self):
        service = Service.objects.create(business=self.business, name="Consultation", duration_minutes=60)
        WorkingHours.objects.create(
            business=self.business,
            weekday=0,
            start_time=time(9, 0),
            end_time=time(18, 0),
        )

        response = self.api.post(
            f"/api/leads/{self.lead.id}/create-appointment/",
            {"service": service.id, "start_at": "2026-05-11T10:00:00+05:00"},
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        appointment = Appointment.objects.get(business=self.business, lead=self.lead)
        self.lead.refresh_from_db()
        self.assertEqual(appointment.client, self.client)
        self.assertEqual(self.lead.status, Lead.Statuses.APPOINTMENT_CREATED)
        self.assertEqual(self.lead.service, service)
        self.assertTrue(ActivityEvent.objects.filter(business=self.business, event_type="appointment_created", entity_id=str(appointment.id)).exists())
        self.assertTrue(
            ActivityEvent.objects.filter(
                business=self.business,
                entity_type="Lead",
                entity_id=str(self.lead.id),
                event_type=ActivityEvents.APPOINTMENT_CREATED,
                metadata__lifecycle_action="lead_appointment_created",
                metadata__appointment_id=appointment.id,
                metadata__service_id=service.id,
            ).exists()
        )
        self.assertTrue(
            AuditLog.objects.filter(
                business=self.business,
                entity_type="Lead",
                entity_id=str(self.lead.id),
                metadata__kind="lifecycle",
                metadata__event_type=ActivityEvents.APPOINTMENT_CREATED,
                metadata__lifecycle_action="lead_appointment_created",
                metadata__appointment_id=appointment.id,
            ).exists()
        )

    def test_create_appointment_from_lead_replays_idempotency_key_without_side_effects(self):
        service = Service.objects.create(business=self.business, name="Idempotent consultation", duration_minutes=60)
        WorkingHours.objects.create(
            business=self.business,
            weekday=0,
            start_time=time(9, 0),
            end_time=time(18, 0),
        )
        payload = {"service": service.id, "start_at": "2026-05-11T10:00:00+05:00"}
        headers = {"HTTP_IDEMPOTENCY_KEY": "lead-appointment-once"}

        first = self.api.post(
            f"/api/leads/{self.lead.id}/create-appointment/",
            payload,
            format="json",
            **headers,
        )
        first_activity_count = ActivityEvent.objects.filter(
            business=self.business,
            event_type="appointment_created",
            entity_id=str(first.data["id"]),
        ).count()
        replay = self.api.post(
            f"/api/leads/{self.lead.id}/create-appointment/",
            payload,
            format="json",
            **headers,
        )

        self.assertEqual(first.status_code, 201)
        self.assertEqual(replay.status_code, 201)
        self.assertEqual(replay.data["id"], first.data["id"])
        self.assertEqual(Appointment.objects.filter(business=self.business, lead=self.lead).count(), 1)
        self.assertGreater(first_activity_count, 0)
        self.assertEqual(
            ActivityEvent.objects.filter(
                business=self.business,
                event_type="appointment_created",
                entity_id=str(first.data["id"]),
            ).count(),
            first_activity_count,
        )

    def test_create_appointment_rejects_idempotency_key_payload_mismatch(self):
        service = Service.objects.create(business=self.business, name="Mismatch consultation", duration_minutes=60)
        WorkingHours.objects.create(
            business=self.business,
            weekday=0,
            start_time=time(9, 0),
            end_time=time(18, 0),
        )
        headers = {"HTTP_IDEMPOTENCY_KEY": "lead-appointment-mismatch"}

        first = self.api.post(
            f"/api/leads/{self.lead.id}/create-appointment/",
            {"service": service.id, "start_at": "2026-05-11T10:00:00+05:00"},
            format="json",
            **headers,
        )
        mismatch = self.api.post(
            f"/api/leads/{self.lead.id}/create-appointment/",
            {"service": service.id, "start_at": "2026-05-11T12:00:00+05:00"},
            format="json",
            **headers,
        )

        self.assertEqual(first.status_code, 201)
        self.assertEqual(mismatch.status_code, 409)
        self.assertEqual(mismatch.data["code"], "idempotency_conflict")
        self.assertEqual(Appointment.objects.filter(business=self.business, lead=self.lead).count(), 1)

    def test_manager_cannot_create_appointment_for_unassigned_lead(self):
        other_client = Client.objects.create(business=self.business, full_name="Other Lead Client")
        other_lead = Lead.objects.create(business=self.business, client=other_client, responsible_user=self.owner)
        service = Service.objects.create(business=self.business, name="Consultation", duration_minutes=60)
        WorkingHours.objects.create(
            business=self.business,
            weekday=0,
            start_time=time(9, 0),
            end_time=time(18, 0),
        )
        self.api.force_authenticate(self.manager)

        response = self.api.post(
            f"/api/leads/{other_lead.id}/create-appointment/",
            {"service": service.id, "start_at": "2026-05-11T10:00:00+05:00"},
            format="json",
        )

        self.assertEqual(response.status_code, 404)
        self.assertFalse(Appointment.objects.filter(business=self.business, lead=other_lead).exists())

    def test_create_appointment_rejects_foreign_service_without_side_effects(self):
        foreign_owner = User.objects.create_user(username="appointment-foreign-owner", email="appointment-foreign-owner@example.com", password="pass12345")
        foreign_business = Business.objects.create(owner=foreign_owner, name="Appointment Foreign", slug="appointment-foreign")
        foreign_service = Service.objects.create(business=foreign_business, name="Foreign consultation", duration_minutes=60)
        WorkingHours.objects.create(
            business=self.business,
            weekday=0,
            start_time=time(9, 0),
            end_time=time(18, 0),
        )

        response = self.api.post(
            f"/api/leads/{self.lead.id}/create-appointment/",
            {"service": foreign_service.id, "start_at": "2026-05-11T10:00:00+05:00"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(Appointment.objects.filter(business=self.business, lead=self.lead).exists())
        self.lead.refresh_from_db()
        self.assertEqual(self.lead.status, Lead.Statuses.NEW)

    def test_create_appointment_from_closed_lead_is_rejected_without_side_effects(self):
        service = Service.objects.create(business=self.business, name="Consultation", duration_minutes=60)
        WorkingHours.objects.create(
            business=self.business,
            weekday=0,
            start_time=time(9, 0),
            end_time=time(18, 0),
        )
        self.lead.status = Lead.Statuses.CLOSED
        self.lead.save(update_fields=["status", "updated_at"])

        response = self.api.post(
            f"/api/leads/{self.lead.id}/create-appointment/",
            {"service": service.id, "start_at": "2026-05-11T10:00:00+05:00"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(Appointment.objects.filter(business=self.business, lead=self.lead).exists())
        self.lead.refresh_from_db()
        self.assertEqual(self.lead.status, Lead.Statuses.CLOSED)

    def test_create_follow_up_task_from_lead_links_context_and_writes_activity(self):
        due_at = datetime(2026, 5, 12, 10, 0, tzinfo=ZoneInfo("Asia/Almaty"))

        response = self.api.post(
            f"/api/leads/{self.lead.id}/create-task/",
            {"title": "Call lead", "priority": Task.Priorities.HIGH, "due_at": due_at.isoformat(), "assignee": self.manager.id},
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        task = Task.objects.get(business=self.business, lead=self.lead)
        self.assertEqual(task.client, self.client)
        self.assertEqual(task.assignee, self.manager)
        self.assertEqual(task.created_by, self.owner)
        self.assertEqual(task.priority, Task.Priorities.HIGH)
        self.assertTrue(ActivityEvent.objects.filter(business=self.business, event_type="task_created", entity_id=str(task.id)).exists())
        self.assertTrue(
            AuditLog.objects.filter(
                business=self.business,
                entity_type="Task",
                entity_id=str(task.id),
                metadata__kind="lead_follow_up",
            ).exists()
        )

    def test_create_follow_up_task_replays_idempotency_key_without_duplicate(self):
        payload = {
            "title": "Call idempotent lead",
            "priority": Task.Priorities.HIGH,
            "assignee": self.manager.id,
        }
        headers = {"HTTP_IDEMPOTENCY_KEY": "lead-task-once"}

        first = self.api.post(
            f"/api/leads/{self.lead.id}/create-task/",
            payload,
            format="json",
            **headers,
        )
        replay = self.api.post(
            f"/api/leads/{self.lead.id}/create-task/",
            payload,
            format="json",
            **headers,
        )

        self.assertEqual(first.status_code, 201)
        self.assertEqual(replay.status_code, 201)
        self.assertEqual(replay.data["id"], first.data["id"])
        self.assertEqual(Task.objects.filter(business=self.business, lead=self.lead).count(), 1)
        self.assertEqual(
            ActivityEvent.objects.filter(
                business=self.business,
                event_type="task_created",
                entity_id=str(first.data["id"]),
            ).count(),
            1,
        )

    def test_create_follow_up_task_rejects_foreign_assignee(self):
        foreign_owner = User.objects.create_user(username="foreign-owner", email="foreign-owner@example.com", password="pass12345")
        foreign_business = Business.objects.create(owner=foreign_owner, name="Foreign", slug="foreign")
        BusinessMember.objects.create(business=foreign_business, user=foreign_owner, role=BusinessMember.Roles.OWNER)

        response = self.api.post(
            f"/api/leads/{self.lead.id}/create-task/",
            {"title": "Call lead", "assignee": foreign_owner.id},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(Task.objects.filter(business=self.business, lead=self.lead).exists())

    def test_manager_cannot_create_task_for_unassigned_lead(self):
        other_client = Client.objects.create(business=self.business, full_name="Other Lead Client")
        other_lead = Lead.objects.create(business=self.business, client=other_client, responsible_user=self.owner)
        self.api.force_authenticate(self.manager)

        response = self.api.post(
            f"/api/leads/{other_lead.id}/create-task/",
            {"title": "Call other lead"},
            format="json",
        )

        self.assertEqual(response.status_code, 404)
