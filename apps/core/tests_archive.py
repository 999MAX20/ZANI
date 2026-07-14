from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.businesses.access import ensure_default_roles
from apps.businesses.models import Business, BusinessMember, BusinessRole
from apps.clients.models import Client
from apps.core.models import AuditLog
from apps.leads.models import Lead


class ArchiveGuardrailTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.owner = User.objects.create_user(username="archive-owner", email="archive-owner@example.com", password="pass")
        self.manager = User.objects.create_user(username="archive-manager", email="archive-manager@example.com", password="pass")
        self.business = Business.objects.create(owner=self.owner, name="Archive Clinic", slug="archive-clinic")
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
        self.client = Client.objects.create(business=self.business, full_name="Client", phone="+77015550101")

    def test_manager_delete_archives_client_instead_of_hard_delete(self):
        self.api.force_authenticate(self.manager)

        response = self.api.delete(f"/api/clients/{self.client.id}/", {"reason": "Duplicate"}, format="json")

        self.assertEqual(response.status_code, 204)
        self.client.refresh_from_db()
        self.assertTrue(self.client.is_archived)
        self.assertEqual(self.client.archived_by, self.manager)
        self.assertTrue(Client.objects.filter(id=self.client.id).exists())

    def test_archived_records_are_hidden_by_default_and_restorable_by_owner(self):
        self.client.is_archived = True
        self.client.archive_reason = "Mistake"
        self.client.archived_by = self.manager
        self.client.save(update_fields=["is_archived", "archive_reason", "archived_by"])
        self.api.force_authenticate(self.owner)

        list_response = self.api.get("/api/clients/")
        rows = list_response.data.get("results", list_response.data)
        self.assertEqual(rows, [])

        restore_response = self.api.post(f"/api/clients/{self.client.id}/restore/")

        self.assertEqual(restore_response.status_code, 200)
        self.client.refresh_from_db()
        self.assertFalse(self.client.is_archived)

    def test_lost_lead_requires_reason_and_tracks_actor(self):
        lead = Lead.objects.create(
            business=self.business,
            client=self.client,
            status=Lead.Statuses.NEW,
            responsible_user=self.manager,
        )
        self.api.force_authenticate(self.manager)

        missing_reason = self.api.patch(f"/api/leads/{lead.id}/", {"status": Lead.Statuses.LOST}, format="json")
        self.assertEqual(missing_reason.status_code, 400)

        response = self.api.post(f"/api/leads/{lead.id}/mark-lost/", {"lost_reason": "No response"}, format="json")

        self.assertEqual(response.status_code, 200)
        lead.refresh_from_db()
        self.assertEqual(lead.lost_by, self.manager)
        self.assertEqual(lead.previous_status, Lead.Statuses.NEW)
        self.assertTrue(AuditLog.objects.filter(business=self.business, entity_type="Lead", action=AuditLog.Actions.UPDATE).exists())
