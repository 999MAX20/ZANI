from datetime import timedelta

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.activities.models import ActivityEvent
from apps.businesses.access import ensure_default_roles
from apps.businesses.models import Business, BusinessMember, BusinessRole
from apps.clients.models import Client
from apps.core.models import AuditLog
from apps.leads.models import Lead
from apps.leads.serializers import CreateAppointmentFromLeadSerializer, LeadSerializer
from apps.scheduling.serializers import AppointmentSerializer
from apps.services.models import Service


class ServiceListWorkspaceTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.owner = User.objects.create_user(
            username="services-owner",
            email="services-owner@example.com",
            password="pass12345",
            role=User.Roles.BUSINESS_OWNER,
        )
        self.business = Business.objects.create(
            owner=self.owner,
            name="Services Workspace",
            slug="services-workspace",
        )
        ensure_default_roles(self.business)
        BusinessMember.objects.create(
            business=self.business,
            user=self.owner,
            role=BusinessMember.Roles.OWNER,
            business_role=BusinessRole.objects.get(
                business=self.business,
                preset_key=BusinessMember.Roles.OWNER,
            ),
        )
        self.manager = User.objects.create_user(
            username="services-manager",
            email="services-manager@example.com",
            password="pass12345",
            role=User.Roles.BUSINESS_MANAGER,
        )
        BusinessMember.objects.create(
            business=self.business,
            user=self.manager,
            role=BusinessMember.Roles.MANAGER,
            business_role=BusinessRole.objects.get(
                business=self.business,
                preset_key=BusinessMember.Roles.MANAGER,
            ),
        )
        other_owner = User.objects.create_user(
            username="other-services-owner",
            email="other-services-owner@example.com",
            password="pass12345",
            role=User.Roles.BUSINESS_OWNER,
        )
        self.other_business = Business.objects.create(
            owner=other_owner,
            name="Other Services Workspace",
            slug="other-services-workspace",
        )
        ensure_default_roles(self.other_business)
        BusinessMember.objects.create(
            business=self.other_business,
            user=other_owner,
            role=BusinessMember.Roles.OWNER,
            business_role=BusinessRole.objects.get(
                business=self.other_business,
                preset_key=BusinessMember.Roles.OWNER,
            ),
        )
        self.active_service = Service.objects.create(
            business=self.business,
            name="Active consultation",
            description="Primary visit",
            is_active=True,
        )
        self.inactive_service = Service.objects.create(
            business=self.business,
            name="Archived-style consultation",
            description="Still visible but inactive",
            is_active=False,
        )
        Service.objects.create(
            business=self.other_business,
            name="Foreign consultation",
            is_active=True,
        )
        self.api.force_authenticate(self.owner)

    def test_list_filters_by_business_search_and_status(self):
        response = self.api.get(
            "/api/services/",
            {
                "business": self.business.id,
                "search": "consultation",
                "status": "active",
                "page_size": 10,
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(
            [service["name"] for service in response.data["results"]],
            ["Active consultation"],
        )

    def test_list_never_returns_another_tenant(self):
        response = self.api.get(
            "/api/services/",
            {"business": self.other_business.id, "page_size": 10},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["results"], [])

    def test_manager_can_read_services_but_cannot_update_them(self):
        service = Service.objects.get(
            business=self.business,
            name="Active consultation",
        )
        self.api.force_authenticate(self.manager)

        list_response = self.api.get(
            "/api/services/",
            {"business": self.business.id, "page_size": 10},
        )
        update_response = self.api.patch(
            f"/api/services/{service.id}/",
            {"name": "Unauthorized rename"},
            format="json",
        )

        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(update_response.status_code, 403)
        service.refresh_from_db()
        self.assertEqual(service.name, "Active consultation")

    def test_status_changes_use_protected_actions_and_write_history(self):
        direct_response = self.api.patch(
            f"/api/services/{self.active_service.id}/",
            {"is_active": False},
            format="json",
        )
        deactivate_response = self.api.post(
            f"/api/services/{self.active_service.id}/deactivate/",
            {},
            format="json",
        )

        self.assertEqual(direct_response.status_code, 400)
        self.assertEqual(deactivate_response.status_code, 200)
        self.assertFalse(deactivate_response.data["is_active"])
        self.assertTrue(
            AuditLog.objects.filter(
                business=self.business,
                entity_type="Service",
                entity_id=str(self.active_service.id),
                metadata__kind="lifecycle",
                metadata__to_active=False,
            ).exists()
        )
        self.assertTrue(
            ActivityEvent.objects.filter(
                business=self.business,
                entity_type="Service",
                entity_id=str(self.active_service.id),
                event_type="service_deactivated",
            ).exists()
        )

        activate_response = self.api.post(
            f"/api/services/{self.active_service.id}/activate/",
            {},
            format="json",
        )
        self.assertEqual(activate_response.status_code, 200)
        self.assertTrue(activate_response.data["is_active"])

    def test_archive_is_hidden_by_default_visible_to_owner_and_restores_inactive(self):
        archive_response = self.api.post(
            f"/api/services/{self.active_service.id}/archive/",
            {"reason": "No longer offered"},
            format="json",
        )
        default_response = self.api.get(
            "/api/services/",
            {"business": self.business.id, "page_size": 10},
        )
        archived_response = self.api.get(
            "/api/services/",
            {
                "business": self.business.id,
                "status": "archived",
                "include_archived": "true",
                "page_size": 10,
            },
        )

        self.assertEqual(archive_response.status_code, 200)
        self.assertTrue(archive_response.data["is_archived"])
        self.assertFalse(archive_response.data["is_active"])
        self.assertNotIn(
            self.active_service.id,
            [service["id"] for service in default_response.data["results"]],
        )
        self.assertEqual(
            [service["id"] for service in archived_response.data["results"]],
            [self.active_service.id],
        )

        restore_response = self.api.post(
            f"/api/services/{self.active_service.id}/restore/",
            {},
            format="json",
        )
        self.assertEqual(restore_response.status_code, 200)
        self.assertFalse(restore_response.data["is_archived"])
        self.assertFalse(restore_response.data["is_active"])

    def test_non_leadership_role_cannot_see_archive_or_run_lifecycle_actions(self):
        self.active_service.is_active = False
        self.active_service.is_archived = True
        self.active_service.save(update_fields=["is_active", "is_archived", "updated_at"])
        self.api.force_authenticate(self.manager)

        archived_response = self.api.get(
            "/api/services/",
            {
                "business": self.business.id,
                "status": "archived",
                "include_archived": "true",
                "page_size": 10,
            },
        )
        restore_response = self.api.post(
            f"/api/services/{self.active_service.id}/restore/",
            {},
            format="json",
        )
        deactivate_response = self.api.post(
            f"/api/services/{self.inactive_service.id}/deactivate/",
            {},
            format="json",
        )

        self.assertEqual(archived_response.status_code, 200)
        self.assertEqual(archived_response.data["results"], [])
        self.assertEqual(restore_response.status_code, 403)
        self.assertEqual(deactivate_response.status_code, 403)

    def test_lifecycle_action_never_crosses_tenants(self):
        foreign_service = Service.objects.get(
            business=self.other_business,
            name="Foreign consultation",
        )

        response = self.api.post(
            f"/api/services/{foreign_service.id}/deactivate/",
            {},
            format="json",
        )

        self.assertEqual(response.status_code, 404)
        foreign_service.refresh_from_db()
        self.assertTrue(foreign_service.is_active)

    def test_inactive_service_is_rejected_for_new_leads_and_bookings(self):
        client = Client.objects.create(
            business=self.business,
            full_name="Service lifecycle client",
        )
        lead = Lead.objects.create(
            business=self.business,
            client=client,
            service=self.inactive_service,
        )
        start_at = timezone.now() + timedelta(days=7)
        end_at = start_at + timedelta(minutes=30)

        lead_serializer = LeadSerializer(
            data={
                "business": self.business.id,
                "client": client.id,
                "service": self.inactive_service.id,
                "source": Lead.Sources.MANUAL,
            }
        )
        appointment_serializer = AppointmentSerializer(
            data={
                "business": self.business.id,
                "client": client.id,
                "service": self.inactive_service.id,
                "start_at": start_at.isoformat(),
                "end_at": end_at.isoformat(),
                "source": "manual",
            }
        )
        lead_appointment_serializer = CreateAppointmentFromLeadSerializer(
            data={
                "service": self.inactive_service.id,
                "start_at": start_at.isoformat(),
            },
            context={"lead": lead},
        )

        self.assertFalse(lead_serializer.is_valid())
        self.assertIn("service", lead_serializer.errors)
        self.assertFalse(appointment_serializer.is_valid())
        self.assertIn("service", appointment_serializer.errors)
        self.assertFalse(lead_appointment_serializer.is_valid())
        self.assertIn("service", lead_appointment_serializer.errors)
