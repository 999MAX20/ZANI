from uuid import uuid4

from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand, CommandError

from apps.accounts.models import User
from apps.businesses.models import Business, BusinessMember
from apps.core.models import FileAttachment


class Command(BaseCommand):
    help = "Create a small private attachment and verify that the configured storage backend persists it."

    def add_arguments(self, parser):
        parser.add_argument("--business-id", type=int, help="Existing business id to use for the smoke file.")
        parser.add_argument("--cleanup", action="store_true", help="Delete smoke attachment and stored object after a successful check.")

    def handle(self, *args, **options):
        business = self._get_business(options.get("business_id"))
        token = uuid4().hex[:12]
        filename = f"zani-storage-smoke-{token}.txt"
        content = ContentFile(f"ZANI storage smoke {token}\n".encode("utf-8"))

        attachment = FileAttachment(
            business=business,
            uploaded_by=business.owner,
            original_name=filename,
            content_type="text/plain",
            size=content.size,
            entity_type="storage_smoke",
            entity_id=token,
        )
        attachment.file.save(filename, content, save=True)

        if not attachment.file.storage.exists(attachment.file.name):
            attachment.delete()
            raise CommandError(f"Storage smoke failed: object was not found at {attachment.file.name}.")

        self.stdout.write(self.style.SUCCESS(f"Storage runtime smoke passed. Attachment #{attachment.id}: {attachment.file.name}"))

        if options["cleanup"]:
            storage = attachment.file.storage
            object_name = attachment.file.name
            attachment.delete()
            if storage.exists(object_name):
                storage.delete(object_name)
            self.stdout.write("Smoke attachment cleaned up.")

    def _get_business(self, business_id):
        if business_id:
            try:
                return Business.objects.select_related("owner").get(id=business_id)
            except Business.DoesNotExist as exc:
                raise CommandError(f"Business #{business_id} does not exist.") from exc

        owner, _ = User.objects.get_or_create(
            email="storage-smoke@zani.local",
            defaults={
                "username": "storage_smoke",
                "role": User.Roles.BUSINESS_OWNER,
                "full_name": "ZANI Storage Smoke",
                "is_active": True,
            },
        )
        if not owner.has_usable_password():
            owner.set_unusable_password()
            owner.save(update_fields=["password"])

        business, _ = Business.objects.get_or_create(
            slug="zani-storage-smoke",
            defaults={
                "owner": owner,
                "name": "ZANI Storage Smoke",
                "status": Business.Statuses.TRIAL,
                "timezone": "UTC",
            },
        )
        BusinessMember.objects.get_or_create(
            business=business,
            user=owner,
            defaults={"role": BusinessMember.Roles.OWNER, "is_active": True},
        )
        return business
