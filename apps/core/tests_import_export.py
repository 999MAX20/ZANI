import shutil
import tempfile

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.businesses.access import ensure_default_roles
from apps.businesses.models import Business, BusinessMember, BusinessRole
from apps.clients.models import Client
from apps.core.models import AuditLog, ImportJob


TEST_MEDIA_ROOT = tempfile.mkdtemp()


@override_settings(MEDIA_ROOT=TEST_MEDIA_ROOT)
class ImportExportTests(TestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(TEST_MEDIA_ROOT, ignore_errors=True)

    def setUp(self):
        self.api = APIClient()
        self.owner = User.objects.create_user(
            username="owner-import",
            email="owner-import@example.com",
            password="pass12345",
            role=User.Roles.BUSINESS_OWNER,
        )
        self.staff = User.objects.create_user(
            username="staff-import",
            email="staff-import@example.com",
            password="pass12345",
            role=User.Roles.STAFF,
        )
        self.business = Business.objects.create(owner=self.owner, name="Import Clinic", slug="import-clinic")
        ensure_default_roles(self.business)
        BusinessMember.objects.create(
            business=self.business,
            user=self.owner,
            role=BusinessMember.Roles.OWNER,
            business_role=BusinessRole.objects.get(business=self.business, preset_key=BusinessMember.Roles.OWNER),
        )
        BusinessMember.objects.create(
            business=self.business,
            user=self.staff,
            role=BusinessMember.Roles.STAFF,
            business_role=BusinessRole.objects.get(business=self.business, preset_key=BusinessMember.Roles.STAFF),
        )

    def test_csv_clients_import_preview_and_confirm(self):
        Client.objects.create(business=self.business, full_name="Existing", phone="+77010000001")
        upload = SimpleUploadedFile(
            "clients.csv",
            "full_name,phone,email,source\nExisting copy,+77010000001,copy@example.com,manual\nNew Client,+77010000002,new@example.com,website\n".encode(),
            content_type="text/csv",
        )
        self.api.force_authenticate(self.owner)

        response = self.api.post(
            "/api/import-jobs/",
            {"business": self.business.id, "entity_type": ImportJob.EntityTypes.CLIENTS, "source_file": upload},
            format="multipart",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["status"], ImportJob.Statuses.PREVIEWED)
        self.assertEqual(response.data["total_rows"], 2)
        self.assertEqual(len(response.data["duplicates_json"]["rows"]), 1)

        confirm_response = self.api.post(f"/api/import-jobs/{response.data['id']}/confirm/")

        self.assertEqual(confirm_response.status_code, 200)
        self.assertEqual(confirm_response.data["status"], ImportJob.Statuses.IMPORTED)
        self.assertEqual(confirm_response.data["imported_count"], 2)
        self.assertEqual(Client.objects.filter(business=self.business).count(), 3)

    def test_export_clients_requires_permission_and_writes_audit(self):
        Client.objects.create(business=self.business, full_name="Export Client", phone="+77010000003")
        self.api.force_authenticate(self.owner)

        response = self.api.get("/api/export/clients/", {"business": self.business.id})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "text/csv; charset=utf-8")
        self.assertIn("Export Client", response.content.decode())
        self.assertTrue(AuditLog.objects.filter(business=self.business, metadata__kind="export", metadata__entity_type="clients").exists())

    def test_staff_cannot_export_deals_without_deal_permission(self):
        self.api.force_authenticate(self.staff)

        response = self.api.get("/api/export/deals/", {"business": self.business.id})

        self.assertEqual(response.status_code, 403)
