from datetime import datetime, time
from zoneinfo import ZoneInfo

from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.ai_core.models import AIRequestLog, AgentProfile, BusinessKnowledgeItem
from apps.bots.models import Bot, BotChannel
from apps.businesses.models import Business, BusinessMember
from apps.clients.models import Client
from apps.crm.models import Deal, Pipeline, PipelineStage
from apps.activities.models import Note
from apps.core.viewsets import TenantModelViewSet
from apps.leads.models import Lead
from apps.notifications.models import Notification
from apps.scheduling.models import Appointment, Resource, WorkingHours
from apps.services.models import Service
from apps.tasks.models import Task


class TenantObjectBoundaryTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.owner_a = User.objects.create_user(
            username="boundary-owner-a",
            email="boundary-owner-a@example.com",
            password="pass",
            role=User.Roles.BUSINESS_OWNER,
        )
        self.owner_b = User.objects.create_user(
            username="boundary-owner-b",
            email="boundary-owner-b@example.com",
            password="pass",
            role=User.Roles.BUSINESS_OWNER,
        )
        self.manager_a = User.objects.create_user(
            username="boundary-manager-a",
            email="boundary-manager-a@example.com",
            password="pass",
            role=User.Roles.BUSINESS_MANAGER,
        )
        self.operator_a = User.objects.create_user(
            username="boundary-operator-a",
            email="boundary-operator-a@example.com",
            password="pass",
            role=User.Roles.BUSINESS_OPERATOR,
        )
        self.business_a = Business.objects.create(owner=self.owner_a, name="Boundary A", slug="boundary-a")
        self.business_b = Business.objects.create(owner=self.owner_b, name="Boundary B", slug="boundary-b")
        BusinessMember.objects.create(business=self.business_a, user=self.owner_a, role=BusinessMember.Roles.OWNER)
        BusinessMember.objects.create(business=self.business_b, user=self.owner_b, role=BusinessMember.Roles.OWNER)
        BusinessMember.objects.create(business=self.business_a, user=self.manager_a, role=BusinessMember.Roles.MANAGER)
        BusinessMember.objects.create(business=self.business_a, user=self.operator_a, role=BusinessMember.Roles.OPERATOR)

        self.objects_a = self._create_crm_graph(self.business_a, "A", self.owner_a)
        self.objects_b = self._create_crm_graph(self.business_b, "B", self.owner_b)

    def _create_crm_graph(self, business, suffix, owner):
        client = Client.objects.create(business=business, full_name=f"Client {suffix}", phone=f"+70000000{suffix}")
        service = Service.objects.create(business=business, name=f"Service {suffix}", duration_minutes=30)
        resource = Resource.objects.create(business=business, name=f"Room {suffix}", resource_type=Resource.ResourceTypes.ROOM)
        working_hours = WorkingHours.objects.create(
            business=business,
            resource=resource,
            weekday=0,
            start_time=time(9, 0),
            end_time=time(18, 0),
        )
        lead = Lead.objects.create(business=business, client=client, service=service, responsible_user=owner)
        pipeline = Pipeline.objects.create(business=business, name=f"Pipeline {suffix}", slug=f"pipeline-{suffix.lower()}")
        stage = PipelineStage.objects.create(business=business, pipeline=pipeline, name=f"Stage {suffix}", order=1)
        deal = Deal.objects.create(
            business=business,
            client=client,
            lead=lead,
            pipeline=pipeline,
            stage=stage,
            title=f"Deal {suffix}",
            owner=owner,
        )
        appointment = Appointment.objects.create(
            business=business,
            client=client,
            lead=lead,
            service=service,
            resource=resource,
            start_at=datetime(2026, 5, 11, 10, 0, tzinfo=ZoneInfo("Asia/Almaty")),
            end_at=datetime(2026, 5, 11, 10, 30, tzinfo=ZoneInfo("Asia/Almaty")),
        )
        task = Task.objects.create(
            business=business,
            title=f"Task {suffix}",
            client=client,
            lead=lead,
            deal=deal,
            appointment=appointment,
            assignee=owner,
            created_by=owner,
        )
        return {
            "clients": client,
            "services": service,
            "resources": resource,
            "working-hours": working_hours,
            "leads": lead,
            "pipelines": pipeline,
            "pipeline-stages": stage,
            "deals": deal,
            "appointments": appointment,
            "tasks": task,
        }

    def _results(self, response):
        payload = response.data
        return payload.get("results", payload) if isinstance(payload, dict) else payload

    def test_owner_lists_only_current_tenant_records_across_core_entities(self):
        self.api.force_authenticate(self.owner_a)

        for endpoint, own_object in self.objects_a.items():
            response = self.api.get(f"/api/{endpoint}/")

            self.assertEqual(response.status_code, 200, endpoint)
            ids = {item["id"] for item in self._results(response)}
            self.assertIn(own_object.id, ids, endpoint)
            self.assertNotIn(self.objects_b[endpoint].id, ids, endpoint)

    def test_owner_cannot_retrieve_foreign_tenant_records_by_direct_url(self):
        self.api.force_authenticate(self.owner_a)

        for endpoint, foreign_object in self.objects_b.items():
            response = self.api.get(f"/api/{endpoint}/{foreign_object.id}/")

            self.assertIn(response.status_code, {403, 404}, endpoint)

    def test_manager_can_read_scheduling_catalog_but_cannot_mutate_settings_catalog(self):
        self.api.force_authenticate(self.manager_a)

        for endpoint, own_object in {
            "services": self.objects_a["services"],
            "resources": self.objects_a["resources"],
            "working-hours": self.objects_a["working-hours"],
        }.items():
            response = self.api.get(f"/api/{endpoint}/")

            self.assertEqual(response.status_code, 200, endpoint)
            ids = {item["id"] for item in self._results(response)}
            self.assertIn(own_object.id, ids, endpoint)

        create_service = self.api.post(
            "/api/services/",
            {"business": self.business_a.id, "name": "Manager-created service", "duration_minutes": 30},
            format="json",
        )
        update_resource = self.api.patch(
            f"/api/resources/{self.objects_a['resources'].id}/",
            {"name": "Manager rename"},
            format="json",
        )
        apply_preset = self.api.post(
            "/api/working-hours/apply-preset/",
            {"business": self.business_a.id, "preset": "weekdays_9_18"},
            format="json",
        )

        self.assertEqual(create_service.status_code, 403)
        self.assertEqual(update_resource.status_code, 403)
        self.assertEqual(apply_preset.status_code, 403)

    def test_operator_cannot_access_scheduling_catalog_without_appointment_or_settings_scope(self):
        self.api.force_authenticate(self.operator_a)

        for endpoint in ["services", "resources", "working-hours"]:
            response = self.api.get(f"/api/{endpoint}/")

            self.assertEqual(response.status_code, 200, endpoint)
            self.assertEqual(self._results(response), [], endpoint)

        response = self.api.post(
            "/api/services/",
            {"business": self.business_a.id, "name": "Operator-created service", "duration_minutes": 30},
            format="json",
        )

        self.assertEqual(response.status_code, 403)


class TenantPermissionMapCoverageTests(TestCase):
    def test_sensitive_tenant_models_have_explicit_permission_resource(self):
        expected_resources = {
            Bot: "integrations",
            BotChannel: "integrations",
            Note: "clients",
            Notification: "notifications",
            AIRequestLog: "analytics",
            BusinessKnowledgeItem: "settings",
            AgentProfile: "settings",
            Service: "settings",
            Resource: "settings",
            WorkingHours: "settings",
        }

        for model, resource in expected_resources.items():
            self.assertEqual(TenantModelViewSet.access_resource_map.get(model.__name__), resource, model.__name__)
