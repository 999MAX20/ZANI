import shutil
import tempfile

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.billing.models import Subscription, SubscriptionPlan
from apps.businesses.models import Business, BusinessMember
from apps.clients.models import Client
from apps.core.models import AuditLog, FileAttachment


TEST_MEDIA_ROOT = tempfile.mkdtemp()


@override_settings(MEDIA_ROOT=TEST_MEDIA_ROOT)
class FileAttachmentTests(TestCase):
    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(TEST_MEDIA_ROOT, ignore_errors=True)
        super().tearDownClass()

    def setUp(self):
        self.api = APIClient()
        self.owner = User.objects.create_user(username="files-owner", email="files-owner@example.com", password="pass")
        self.other_owner = User.objects.create_user(username="files-other", email="files-other@example.com", password="pass")
        self.business = Business.objects.create(owner=self.owner, name="Files Clinic", slug="files-clinic")
        self.other_business = Business.objects.create(owner=self.other_owner, name="Other Files Clinic", slug="other-files-clinic")
        BusinessMember.objects.create(business=self.business, user=self.owner, role=BusinessMember.Roles.OWNER)
        BusinessMember.objects.create(business=self.other_business, user=self.other_owner, role=BusinessMember.Roles.OWNER)
        self.client = Client.objects.create(business=self.business, full_name="File Client", phone="+77010000001")

    def test_allowed_file_upload_and_private_download(self):
        self.api.force_authenticate(self.owner)
        upload = SimpleUploadedFile("contract.pdf", b"%PDF-1.4\ncontract", content_type="application/pdf")

        response = self.api.post(
            "/api/file-attachments/",
            {
                "business": self.business.id,
                "entity_type": "client",
                "entity_id": str(self.client.id),
                "file": upload,
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, 201)
        attachment = FileAttachment.objects.get()
        self.assertEqual(attachment.original_name, "contract.pdf")
        self.assertEqual(attachment.business, self.business)
        self.assertEqual(attachment.uploaded_by, self.owner)
        self.assertTrue(attachment.file.name.startswith(f"private/attachments/business-{self.business.id}/"))
        self.assertNotIn("contract.pdf", attachment.file.name)

        download_response = self.api.get(f"/api/file-attachments/{attachment.id}/download/")
        self.assertEqual(download_response.status_code, 200)
        self.assertTrue(
            AuditLog.objects.filter(
                business=self.business,
                actor=self.owner,
                action=AuditLog.Actions.DOWNLOAD,
                entity_type="FileAttachment",
                entity_id=str(attachment.id),
                metadata__kind="file_download",
            ).exists()
        )

    def test_attachment_upload_sanitizes_path_like_filename(self):
        self.api.force_authenticate(self.owner)
        upload = SimpleUploadedFile("../nested\\evil contract.pdf", b"%PDF-1.4\ncontract", content_type="application/pdf")

        response = self.api.post(
            "/api/file-attachments/",
            {
                "business": self.business.id,
                "entity_type": "client",
                "entity_id": str(self.client.id),
                "file": upload,
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, 201)
        attachment = FileAttachment.objects.get()
        self.assertEqual(attachment.original_name, "evil_contract.pdf")
        self.assertTrue(attachment.file.name.startswith(f"private/attachments/business-{self.business.id}/"))
        self.assertNotIn("..", attachment.file.name)
        self.assertNotIn("\\", attachment.file.name)
        self.assertNotIn("evil", attachment.file.name)

    def test_attachment_rename_sanitizes_name_and_writes_audit(self):
        self.api.force_authenticate(self.owner)
        attachment = FileAttachment.objects.create(
            business=self.business,
            uploaded_by=self.owner,
            file=SimpleUploadedFile("existing.txt", b"note", content_type="text/plain"),
            original_name="existing.txt",
            content_type="text/plain",
            size=4,
            entity_type="client",
            entity_id=str(self.client.id),
        )

        response = self.api.post(
            f"/api/file-attachments/{attachment.id}/rename/",
            {"original_name": "../Renamed contract.pdf"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        attachment.refresh_from_db()
        self.assertEqual(attachment.original_name, "Renamed_contract.pdf")
        self.assertEqual(response.data["original_name"], "Renamed_contract.pdf")
        self.assertTrue(
            AuditLog.objects.filter(
                business=self.business,
                actor=self.owner,
                action=AuditLog.Actions.UPDATE,
                entity_type="FileAttachment",
                entity_id=str(attachment.id),
                metadata__kind="file_rename",
            ).exists()
        )

    def test_merchant_cannot_rename_another_merchant_file(self):
        attachment = FileAttachment.objects.create(
            business=self.business,
            uploaded_by=self.owner,
            file=SimpleUploadedFile("existing.txt", b"note", content_type="text/plain"),
            original_name="existing.txt",
            content_type="text/plain",
            size=4,
            entity_type="client",
            entity_id=str(self.client.id),
        )
        self.api.force_authenticate(self.other_owner)

        response = self.api.post(
            f"/api/file-attachments/{attachment.id}/rename/",
            {"original_name": "stolen.txt"},
            format="json",
        )

        self.assertEqual(response.status_code, 404)
        attachment.refresh_from_db()
        self.assertEqual(attachment.original_name, "existing.txt")

    def test_forbidden_extension_rejected(self):
        self.api.force_authenticate(self.owner)
        upload = SimpleUploadedFile("payload.exe", b"bad", content_type="application/octet-stream")

        response = self.api.post(
            "/api/file-attachments/",
            {
                "business": self.business.id,
                "entity_type": "client",
                "entity_id": str(self.client.id),
                "file": upload,
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(FileAttachment.objects.count(), 0)

    def test_merchant_cannot_see_or_download_another_merchant_file(self):
        self.api.force_authenticate(self.owner)
        upload = SimpleUploadedFile("note.txt", b"secret", content_type="text/plain")
        create_response = self.api.post(
            "/api/file-attachments/",
            {
                "business": self.business.id,
                "entity_type": "client",
                "entity_id": str(self.client.id),
                "file": upload,
            },
            format="multipart",
        )
        attachment_id = create_response.data["id"]

        self.api.force_authenticate(self.other_owner)
        list_response = self.api.get("/api/file-attachments/")
        download_response = self.api.get(f"/api/file-attachments/{attachment_id}/download/")

        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(list_response.data["results"], [])
        self.assertEqual(download_response.status_code, 404)

    def test_storage_quota_rejects_upload_over_plan_limit(self):
        plan = SubscriptionPlan.objects.get(code="start")
        plan.limits_json = {"storage_mb": 1}
        plan.save(update_fields=["limits_json"])
        Subscription.objects.create(business=self.business, plan=plan)
        FileAttachment.objects.create(
            business=self.business,
            uploaded_by=self.owner,
            file=SimpleUploadedFile("existing.txt", b"a" * 900_000, content_type="text/plain"),
            original_name="existing.txt",
            content_type="text/plain",
            size=900_000,
            entity_type="client",
            entity_id=str(self.client.id),
        )
        self.api.force_authenticate(self.owner)
        upload = SimpleUploadedFile("large.txt", b"b" * 300_000, content_type="text/plain")

        response = self.api.post(
            "/api/file-attachments/",
            {
                "business": self.business.id,
                "entity_type": "client",
                "entity_id": str(self.client.id),
                "file": upload,
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(FileAttachment.objects.filter(original_name="large.txt").count(), 0)
