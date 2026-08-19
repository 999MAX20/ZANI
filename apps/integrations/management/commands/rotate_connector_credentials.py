from collections import Counter

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from apps.integrations.credential_encryption import (
    ConnectorCredentialError,
    CredentialKeyConfigurationError,
    active_credential_key_id,
    configured_credential_key_ids,
    credential_envelope_key_id,
    rotate_credential_value,
)
from apps.integrations.models import ConnectorCredential


class Command(BaseCommand):
    help = "Atomically re-encrypt connector credentials with the configured target AEAD key."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true", help="Verify decryptability and report counts without writing.")
        parser.add_argument("--from-key-id", default="", help="Rotate only envelopes currently using this key ID or legacy-v1.")
        parser.add_argument("--target-key-id", default="", help="Target key ID; defaults to CONNECTOR_CREDENTIAL_ACTIVE_KEY_ID.")

    def handle(self, *args, **options):
        try:
            target_key_id = str(options["target_key_id"] or active_credential_key_id()).strip()
            if target_key_id not in configured_credential_key_ids():
                raise CredentialKeyConfigurationError()
        except ConnectorCredentialError as exc:
            raise CommandError("Connector credential rotation keys are not configured safely.") from exc

        source_filter = str(options["from_key_id"] or "").strip()
        dry_run = bool(options["dry_run"])
        counts = Counter()
        source_counts = Counter()

        try:
            with transaction.atomic():
                credentials = ConnectorCredential.objects.select_for_update().order_by("id")
                for credential in credentials.iterator(chunk_size=200):
                    counts["scanned"] += 1
                    source_key_id = credential_envelope_key_id(credential.encrypted_value)
                    source_counts[source_key_id] += 1
                    if source_filter and source_key_id != source_filter:
                        counts["filtered"] += 1
                        continue
                    if source_key_id == target_key_id:
                        counts["current"] += 1
                        continue

                    rotated_value = rotate_credential_value(
                        credential.encrypted_value,
                        target_key_id=target_key_id,
                    )
                    counts["verified" if dry_run else "rotated"] += 1
                    if not dry_run:
                        credential.encrypted_value = rotated_value
                        credential.rotated_at = timezone.now()
                        credential.save(update_fields=["encrypted_value", "rotated_at", "updated_at"])
        except ConnectorCredentialError as exc:
            raise CommandError(
                "Connector credential rotation stopped safely; no changes from this command were committed."
            ) from exc

        action_label = "Would rotate" if dry_run else "Rotated"
        self.stdout.write(
            self.style.SUCCESS(
                f"Scanned: {counts['scanned']}; {action_label}: {counts['verified' if dry_run else 'rotated']}; "
                f"already current: {counts['current']}; filtered: {counts['filtered']}; target key: {target_key_id}."
            )
        )
        source_summary = ", ".join(f"{key_id}={count}" for key_id, count in sorted(source_counts.items())) or "none"
        self.stdout.write(f"Source envelopes: {source_summary}.")
