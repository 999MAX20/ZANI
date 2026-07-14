from io import StringIO

from django.core.management import call_command
from django.test import TestCase

from apps.accounts.models import User
from apps.businesses.models import Business, BusinessMember
from apps.core.models import FileAttachment


class StorageRuntimeSmokeCommandTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            username="storage-owner",
            email="storage-owner@example.com",
            password="pass",
            role=User.Roles.BUSINESS_OWNER,
        )
        self.business = Business.objects.create(owner=self.owner, name="Storage Clinic", slug="storage-clinic")
        BusinessMember.objects.create(business=self.business, user=self.owner, role=BusinessMember.Roles.OWNER)

    def test_storage_runtime_smoke_creates_business_scoped_attachment_and_cleans_up(self):
        output = StringIO()

        call_command("storage_runtime_smoke", "--business-id", str(self.business.id), "--cleanup", stdout=output)

        self.assertIn("Storage runtime smoke passed", output.getvalue())
        self.assertFalse(FileAttachment.objects.filter(business=self.business, entity_type="storage_smoke").exists())
