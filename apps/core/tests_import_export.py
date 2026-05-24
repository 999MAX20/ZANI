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
from apps.integrations.models import BusinessEvent
from apps.leads.models import Lead
from apps.services.models import Service


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
        self.assertEqual(confirm_response.data["summary_json"]["created"], 1)
        self.assertEqual(confirm_response.data["summary_json"]["updated"], 1)
        self.assertEqual(Client.objects.filter(business=self.business).count(), 2)
        self.assertEqual(Client.objects.get(business=self.business, phone="+77010000001").email, "copy@example.com")

    def test_repeated_clients_import_is_idempotent_by_contact_identity(self):
        upload = SimpleUploadedFile(
            "clients.csv",
            "full_name,phone,email,source\nNew Client,+77010000002,new@example.com,website\n".encode(),
            content_type="text/csv",
        )
        self.api.force_authenticate(self.owner)

        first_response = self.api.post(
            "/api/import-jobs/",
            {"business": self.business.id, "entity_type": ImportJob.EntityTypes.CLIENTS, "source_file": upload},
            format="multipart",
        )
        self.api.post(f"/api/import-jobs/{first_response.data['id']}/confirm/")
        repeated_upload = SimpleUploadedFile(
            "clients.csv",
            "full_name,phone,email,source\nNew Client,+77010000002,new@example.com,website\n".encode(),
            content_type="text/csv",
        )
        second_response = self.api.post(
            "/api/import-jobs/",
            {"business": self.business.id, "entity_type": ImportJob.EntityTypes.CLIENTS, "source_file": repeated_upload},
            format="multipart",
        )
        second_confirm = self.api.post(f"/api/import-jobs/{second_response.data['id']}/confirm/")

        self.assertEqual(second_confirm.status_code, 200)
        self.assertEqual(second_confirm.data["imported_count"], 0)
        self.assertEqual(second_confirm.data["summary_json"]["skipped"], 1)
        self.assertEqual(Client.objects.filter(business=self.business, phone="+77010000002").count(), 1)

    def test_csv_sales_import_creates_business_events_and_dashboard_revenue(self):
        upload = SimpleUploadedFile(
            "sales.csv",
            "external_id,occurred_at,client_name,phone,item_name,quantity,amount,source\nsale-1,2026-05-22T10:00:00+05:00,Buyer,+77010000004,Consultation,1,15000,manual\n".encode(),
            content_type="text/csv",
        )
        self.api.force_authenticate(self.owner)

        response = self.api.post(
            "/api/import-jobs/",
            {"business": self.business.id, "entity_type": ImportJob.EntityTypes.SALES, "source_file": upload},
            format="multipart",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["status"], ImportJob.Statuses.PREVIEWED)
        self.assertEqual(response.data["errors_json"]["rows"], [])

        confirm_response = self.api.post(f"/api/import-jobs/{response.data['id']}/confirm/")

        self.assertEqual(confirm_response.status_code, 200)
        self.assertEqual(confirm_response.data["imported_count"], 1)
        self.assertTrue(BusinessEvent.objects.filter(business=self.business, event_type="sale.recorded", payload_json__amount="15000").exists())

        dashboard = self.api.get("/api/analytics/owner-dashboard/", {"business": self.business.id})

        self.assertEqual(dashboard.status_code, 200)
        self.assertEqual(dashboard.data["revenue_estimate"], "15000")
        self.assertTrue(dashboard.data["data_quality"]["has_sales_data"])

    def test_repeated_sales_import_is_idempotent_by_external_id(self):
        self.api.force_authenticate(self.owner)
        csv_body = "external_id,occurred_at,client_name,phone,item_name,quantity,amount,source\nsale-1,2026-05-22T10:00:00+05:00,Buyer,+77010000004,Consultation,1,15000,manual\n"

        first_response = self.api.post(
            "/api/import-jobs/",
            {
                "business": self.business.id,
                "entity_type": ImportJob.EntityTypes.SALES,
                "source_file": SimpleUploadedFile("sales.csv", csv_body.encode(), content_type="text/csv"),
            },
            format="multipart",
        )
        self.api.post(f"/api/import-jobs/{first_response.data['id']}/confirm/")
        second_response = self.api.post(
            "/api/import-jobs/",
            {
                "business": self.business.id,
                "entity_type": ImportJob.EntityTypes.SALES,
                "source_file": SimpleUploadedFile("sales.csv", csv_body.encode(), content_type="text/csv"),
            },
            format="multipart",
        )
        second_confirm = self.api.post(f"/api/import-jobs/{second_response.data['id']}/confirm/")

        self.assertEqual(second_confirm.status_code, 200)
        self.assertEqual(second_confirm.data["imported_count"], 0)
        self.assertEqual(second_confirm.data["summary_json"]["skipped"], 1)
        self.assertEqual(BusinessEvent.objects.filter(business=self.business, event_type="sale.recorded", external_id="sale-1").count(), 1)

    def test_csv_leads_import_creates_clients_and_leads(self):
        Service.objects.create(business=self.business, name="Consultation", duration_minutes=45)
        upload = SimpleUploadedFile(
            "leads.csv",
            "full_name,phone,email,service_name,source,message,status\nLead Client,+77010000005,lead@example.com,Consultation,landing,Need appointment,new\n".encode(),
            content_type="text/csv",
        )
        self.api.force_authenticate(self.owner)

        response = self.api.post(
            "/api/import-jobs/",
            {"business": self.business.id, "entity_type": ImportJob.EntityTypes.LEADS, "source_file": upload},
            format="multipart",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["status"], ImportJob.Statuses.PREVIEWED)
        self.assertEqual(response.data["errors_json"]["rows"], [])

        confirm_response = self.api.post(f"/api/import-jobs/{response.data['id']}/confirm/")

        self.assertEqual(confirm_response.status_code, 200)
        self.assertEqual(confirm_response.data["imported_count"], 1)
        self.assertTrue(Client.objects.filter(business=self.business, phone="+77010000005").exists())
        self.assertTrue(Lead.objects.filter(business=self.business, message="Need appointment", source=Lead.Sources.LANDING).exists())

    def test_repeated_leads_import_is_idempotent_by_client_and_message(self):
        self.api.force_authenticate(self.owner)
        csv_body = "full_name,phone,email,service_name,source,message,status\nLead Client,+77010000005,lead@example.com,,landing,Need appointment,new\n"

        first_response = self.api.post(
            "/api/import-jobs/",
            {
                "business": self.business.id,
                "entity_type": ImportJob.EntityTypes.LEADS,
                "source_file": SimpleUploadedFile("leads.csv", csv_body.encode(), content_type="text/csv"),
            },
            format="multipart",
        )
        self.api.post(f"/api/import-jobs/{first_response.data['id']}/confirm/")
        second_response = self.api.post(
            "/api/import-jobs/",
            {
                "business": self.business.id,
                "entity_type": ImportJob.EntityTypes.LEADS,
                "source_file": SimpleUploadedFile("leads.csv", csv_body.encode(), content_type="text/csv"),
            },
            format="multipart",
        )
        second_confirm = self.api.post(f"/api/import-jobs/{second_response.data['id']}/confirm/")

        self.assertEqual(second_confirm.status_code, 200)
        self.assertEqual(second_confirm.data["imported_count"], 0)
        self.assertEqual(second_confirm.data["summary_json"]["skipped"], 1)
        self.assertEqual(Lead.objects.filter(business=self.business, message="Need appointment").count(), 1)

    def test_csv_catalog_import_creates_service_and_business_event(self):
        upload = SimpleUploadedFile(
            "catalog.csv",
            "item_type,sku,name,description,duration_minutes,price_from,stock_quantity,source\nservice,SVC-1,Consultation,Intro call,45,12000,,manual\nproduct,SKU-1,Serum,Stock item,,9000,5,manual\n".encode(),
            content_type="text/csv",
        )
        self.api.force_authenticate(self.owner)

        response = self.api.post(
            "/api/import-jobs/",
            {"business": self.business.id, "entity_type": ImportJob.EntityTypes.CATALOG, "source_file": upload},
            format="multipart",
        )
        self.assertEqual(response.status_code, 201)
        confirm_response = self.api.post(f"/api/import-jobs/{response.data['id']}/confirm/")

        self.assertEqual(confirm_response.status_code, 200)
        self.assertEqual(confirm_response.data["imported_count"], 2)
        self.assertTrue(Service.objects.filter(business=self.business, name="Consultation", duration_minutes=45).exists())
        self.assertEqual(BusinessEvent.objects.filter(business=self.business, event_type="catalog.item_imported").count(), 2)

    def test_bad_sales_file_returns_clear_validation_errors_and_blocks_confirm(self):
        upload = SimpleUploadedFile(
            "sales.csv",
            "external_id,amount\nsale-1,not-a-number\n".encode(),
            content_type="text/csv",
        )
        self.api.force_authenticate(self.owner)

        response = self.api.post(
            "/api/import-jobs/",
            {"business": self.business.id, "entity_type": ImportJob.EntityTypes.SALES, "source_file": upload},
            format="multipart",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["status"], ImportJob.Statuses.PREVIEWED)
        self.assertEqual(response.data["errors_json"]["rows"][0]["field"], "amount")
        self.assertIn("Amount must be a number", response.data["error"])

        confirm_response = self.api.post(f"/api/import-jobs/{response.data['id']}/confirm/")

        self.assertEqual(confirm_response.status_code, 400)

    def test_manual_sale_and_catalog_endpoints_create_business_events(self):
        self.api.force_authenticate(self.owner)

        sale_response = self.api.post(
            "/api/data/sales/",
            {
                "business": self.business.id,
                "external_id": "manual-sale-1",
                "amount": "22000",
                "item_name": "Manual service",
                "source": "manual",
            },
            format="json",
        )
        catalog_response = self.api.post(
            "/api/data/catalog-items/",
            {
                "business": self.business.id,
                "item_type": "service",
                "name": "Manual service",
                "duration_minutes": "30",
                "price_from": "22000",
                "source": "manual",
            },
            format="json",
        )

        self.assertEqual(sale_response.status_code, 201)
        self.assertEqual(catalog_response.status_code, 201)
        self.assertTrue(Service.objects.filter(business=self.business, name="Manual service").exists())
        self.assertTrue(BusinessEvent.objects.filter(business=self.business, event_type="sale.recorded", external_id="manual-sale-1").exists())

    def test_import_template_downloads_sample_csv(self):
        self.api.force_authenticate(self.owner)

        response = self.api.get("/api/import-templates/sales/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "text/csv; charset=utf-8")
        self.assertIn("external_id", response.content.decode())

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
