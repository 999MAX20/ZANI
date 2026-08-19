import base64
import hashlib
import io
import json
import secrets
from datetime import timedelta

from django.conf import settings
from django.core import signing
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import SimpleTestCase, TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.businesses.models import Business, BusinessMember
from apps.integrations.credential_encryption import (
    CredentialDecryptionError,
    CredentialExpiredError,
    CredentialKeyConfigurationError,
    credential_envelope_key_id,
    decrypt_connector_credential,
    decrypt_credential_value,
    encrypt_credential_value,
)
from apps.integrations.connectors import read_connector_credential
from apps.integrations.models import BusinessConnector, ConnectorCredential


KEY_A = "QUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUE="
KEY_B = "QkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkI="
KEYRING_A = {"key-a": KEY_A}
KEYRING_AB = {"key-a": KEY_A, "key-b": KEY_B}


@override_settings(
    CONNECTOR_CREDENTIAL_KEYS=KEYRING_A,
    CONNECTOR_CREDENTIAL_ACTIVE_KEY_ID="key-a",
    CONNECTOR_CREDENTIAL_ALLOW_LEGACY_DECRYPT=True,
)
class ConnectorCredentialEnvelopeTests(SimpleTestCase):
    def test_aead_envelope_round_trip_is_versioned_and_randomized(self):
        first = encrypt_credential_value("provider-secret")
        second = encrypt_credential_value("provider-secret")

        envelope = json.loads(first)
        self.assertEqual(envelope["v"], 2)
        self.assertEqual(envelope["alg"], "AES-256-GCM")
        self.assertEqual(envelope["kid"], "key-a")
        self.assertNotEqual(first, second)
        self.assertNotIn("provider-secret", first)
        self.assertEqual(decrypt_credential_value(first), "provider-secret")

    def test_ciphertext_tampering_fails_with_safe_error(self):
        encrypted = encrypt_credential_value("never-expose-this-secret")
        envelope = json.loads(encrypted)
        ciphertext = bytearray(base64.urlsafe_b64decode(envelope["ciphertext"]))
        ciphertext[0] ^= 1
        envelope["ciphertext"] = base64.urlsafe_b64encode(ciphertext).decode("ascii")

        with self.assertRaises(CredentialDecryptionError) as caught:
            decrypt_credential_value(json.dumps(envelope))

        self.assertNotIn("never-expose-this-secret", str(caught.exception))
        self.assertNotIn(envelope["ciphertext"], str(caught.exception))

    def test_unknown_key_id_fails_without_falling_back_to_secret_key(self):
        encrypted = encrypt_credential_value("key-bound-secret")

        with override_settings(
            CONNECTOR_CREDENTIAL_KEYS={"key-b": KEY_B},
            CONNECTOR_CREDENTIAL_ACTIVE_KEY_ID="key-b",
        ):
            with self.assertRaises(CredentialKeyConfigurationError):
                decrypt_credential_value(encrypted)

    def test_invalid_key_material_is_rejected(self):
        with override_settings(
            CONNECTOR_CREDENTIAL_KEYS={"bad-key": "dG9vLXNob3J0"},
            CONNECTOR_CREDENTIAL_ACTIVE_KEY_ID="bad-key",
        ):
            with self.assertRaises(CredentialKeyConfigurationError):
                encrypt_credential_value("secret")

    def test_legacy_decrypt_can_be_disabled_after_rotation(self):
        legacy = _legacy_encrypt("legacy-secret")
        self.assertEqual(decrypt_credential_value(legacy), "legacy-secret")

        with override_settings(CONNECTOR_CREDENTIAL_ALLOW_LEGACY_DECRYPT=False):
            with self.assertRaises(CredentialDecryptionError):
                decrypt_credential_value(legacy)


@override_settings(
    CONNECTOR_CREDENTIAL_KEYS=KEYRING_AB,
    CONNECTOR_CREDENTIAL_ACTIVE_KEY_ID="key-b",
    CONNECTOR_CREDENTIAL_ALLOW_LEGACY_DECRYPT=True,
)
class ConnectorCredentialRotationTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            username="credential-owner",
            email="credential-owner@example.com",
            password="pass",
            role=User.Roles.BUSINESS_OWNER,
        )
        self.business = Business.objects.create(
            owner=self.owner,
            name="Credential Rotation Clinic",
            slug="credential-rotation-clinic",
        )
        BusinessMember.objects.create(
            business=self.business,
            user=self.owner,
            role=BusinessMember.Roles.OWNER,
        )
        self.connector = BusinessConnector.objects.create(
            business=self.business,
            provider=BusinessConnector.Providers.TELEGRAM,
            name="Telegram",
            auth_type=BusinessConnector.AuthTypes.TOKEN,
            created_by=self.owner,
        )

    def test_legacy_credential_rotates_without_plaintext_output(self):
        credential = self._credential(_legacy_encrypt("legacy-provider-secret"))
        before = credential.encrypted_value
        dry_run_output = io.StringIO()

        call_command("rotate_connector_credentials", "--dry-run", stdout=dry_run_output)
        credential.refresh_from_db()
        self.assertEqual(credential.encrypted_value, before)
        self.assertNotIn("legacy-provider-secret", dry_run_output.getvalue())

        output = io.StringIO()
        call_command("rotate_connector_credentials", stdout=output)
        credential.refresh_from_db()

        self.assertEqual(credential_envelope_key_id(credential.encrypted_value), "key-b")
        self.assertEqual(decrypt_credential_value(credential.encrypted_value), "legacy-provider-secret")
        self.assertEqual(credential.masked_value, "lega...cret")
        self.assertIsNotNone(credential.rotated_at)
        self.assertNotIn("legacy-provider-secret", output.getvalue())

    def test_old_aead_key_decrypts_and_encrypts_with_active_key(self):
        with override_settings(CONNECTOR_CREDENTIAL_ACTIVE_KEY_ID="key-a"):
            old_envelope = encrypt_credential_value("old-key-secret")
        credential = self._credential(old_envelope)

        call_command("rotate_connector_credentials", "--from-key-id", "key-a", stdout=io.StringIO())
        credential.refresh_from_db()

        self.assertEqual(credential_envelope_key_id(credential.encrypted_value), "key-b")
        self.assertEqual(decrypt_credential_value(credential.encrypted_value), "old-key-secret")

    def test_rotation_rolls_back_every_write_when_one_envelope_is_corrupt(self):
        valid = self._credential(_legacy_encrypt("valid-legacy-secret"), key="access_token")
        invalid = self._credential("not-a-valid-envelope", key="api_token")
        valid_before = valid.encrypted_value
        invalid_before = invalid.encrypted_value

        with self.assertRaises(CommandError):
            call_command("rotate_connector_credentials", stdout=io.StringIO(), stderr=io.StringIO())

        valid.refresh_from_db()
        invalid.refresh_from_db()
        self.assertEqual(valid.encrypted_value, valid_before)
        self.assertEqual(invalid.encrypted_value, invalid_before)

    def test_expired_credential_is_rejected_before_decryption(self):
        credential = self._credential(
            encrypt_credential_value("expired-secret"),
            expires_at=timezone.now() - timedelta(seconds=1),
        )

        with self.assertRaises(CredentialExpiredError):
            decrypt_connector_credential(credential)

        self.assertEqual(
            read_connector_credential(self.connector, credential.key, expired_error="Provider credential expired."),
            "",
        )
        self.connector.refresh_from_db()
        self.assertEqual(self.connector.status, BusinessConnector.Statuses.EXPIRED_CREDENTIALS)
        self.assertEqual(self.connector.last_error, "Provider credential expired.")

    def test_corrupt_credential_marks_connector_for_safe_recovery(self):
        credential = self._credential("corrupt-secret-envelope")

        self.assertEqual(read_connector_credential(self.connector, credential.key), "")
        self.connector.refresh_from_db()
        self.assertEqual(self.connector.status, BusinessConnector.Statuses.NEEDS_ATTENTION)
        self.assertEqual(
            self.connector.last_error,
            "Stored credential is unavailable. Reconnect the provider.",
        )
        self.assertNotIn("corrupt-secret-envelope", self.connector.last_error)

    def _credential(self, encrypted_value, *, key="bot_token", expires_at=None):
        return ConnectorCredential.objects.create(
            business=self.business,
            connector=self.connector,
            key=key,
            encrypted_value=encrypted_value,
            masked_value="lega...cret",
            expires_at=expires_at,
        )


@override_settings(
    CONNECTOR_CREDENTIAL_KEYS=KEYRING_A,
    CONNECTOR_CREDENTIAL_ACTIVE_KEY_ID="key-a",
    CONNECTOR_CREDENTIAL_ALLOW_LEGACY_DECRYPT=True,
)
class ConnectorCredentialApiSecurityTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.owner = User.objects.create_user(
            username="credential-api-owner",
            email="credential-api-owner@example.com",
            password="pass",
            role=User.Roles.BUSINESS_OWNER,
        )
        self.other_owner = User.objects.create_user(
            username="credential-api-other",
            email="credential-api-other@example.com",
            password="pass",
            role=User.Roles.BUSINESS_OWNER,
        )
        self.operator = User.objects.create_user(
            username="credential-api-operator",
            email="credential-api-operator@example.com",
            password="pass",
            role=User.Roles.BUSINESS_OPERATOR,
        )
        self.business = Business.objects.create(owner=self.owner, name="Credential API Clinic", slug="credential-api-clinic")
        self.other_business = Business.objects.create(owner=self.other_owner, name="Other Clinic", slug="credential-api-other")
        BusinessMember.objects.create(business=self.business, user=self.owner, role=BusinessMember.Roles.OWNER)
        BusinessMember.objects.create(business=self.business, user=self.operator, role=BusinessMember.Roles.OPERATOR)
        BusinessMember.objects.create(business=self.other_business, user=self.other_owner, role=BusinessMember.Roles.OWNER)
        self.connector = BusinessConnector.objects.create(
            business=self.business,
            provider=BusinessConnector.Providers.TELEGRAM,
            name="Telegram",
            auth_type=BusinessConnector.AuthTypes.TOKEN,
            created_by=self.owner,
        )

    def test_api_masks_value_and_other_tenant_cannot_retrieve_it(self):
        self.api.force_authenticate(self.owner)
        created = self.api.post(
            "/api/connector-credentials/",
            {"connector": self.connector.id, "key": "bot_token", "value": "tenant-provider-secret"},
            format="json",
        )
        self.assertEqual(created.status_code, 201)
        self.assertNotIn("tenant-provider-secret", str(created.data))
        self.assertNotIn("encrypted_value", created.data)

        self.api.force_authenticate(self.other_owner)
        response = self.api.get(f"/api/connector-credentials/{created.data['id']}/")
        self.assertEqual(response.status_code, 404)
        self.assertNotIn("tenant-provider-secret", str(response.data))

    def test_operator_cannot_create_connector_credential(self):
        self.api.force_authenticate(self.operator)
        response = self.api.post(
            "/api/connector-credentials/",
            {"connector": self.connector.id, "key": "bot_token", "value": "operator-secret"},
            format="json",
        )

        self.assertEqual(response.status_code, 403)
        self.assertFalse(ConnectorCredential.objects.filter(connector=self.connector).exists())


def _legacy_encrypt(raw_value):
    plaintext = str(raw_value).encode("utf-8")
    salt = secrets.token_hex(16)
    seed = f"{settings.SECRET_KEY}:{salt}:connector-credential".encode("utf-8")
    output = b""
    counter = 0
    while len(output) < len(plaintext):
        output += hashlib.sha256(seed + counter.to_bytes(4, "big")).digest()
        counter += 1
    ciphertext = bytes(left ^ right for left, right in zip(plaintext, output[: len(plaintext)]))
    envelope = {
        "v": 1,
        "salt": salt,
        "ciphertext": base64.urlsafe_b64encode(ciphertext).decode("ascii"),
    }
    return signing.dumps(envelope, salt="zani.connector-credential")
