import base64
import binascii
import hashlib
import json
import re
import secrets

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from django.conf import settings
from django.core import signing
from django.utils import timezone


ENVELOPE_VERSION = 2
ENVELOPE_ALGORITHM = "AES-256-GCM"
LEGACY_KEY_ID = "legacy-v1"
_KEY_ID_PATTERN = re.compile(r"^[A-Za-z0-9._-]{1,64}$")
_NONCE_BYTES = 12
_KEY_BYTES = 32


class ConnectorCredentialError(Exception):
    """Base class with messages that are safe to log or map to merchant UX."""


class CredentialKeyConfigurationError(ConnectorCredentialError):
    def __init__(self):
        super().__init__("Connector credential key configuration is unavailable.")


class CredentialDecryptionError(ConnectorCredentialError):
    def __init__(self):
        super().__init__("Connector credential cannot be decrypted.")


class CredentialExpiredError(ConnectorCredentialError):
    def __init__(self):
        super().__init__("Connector credential has expired.")


def encrypt_credential_value(raw_value, *, key_id=None):
    keyring = _load_keyring()
    selected_key_id = key_id or active_credential_key_id()
    key = keyring.get(selected_key_id)
    if key is None:
        raise CredentialKeyConfigurationError()

    nonce = secrets.token_bytes(_NONCE_BYTES)
    metadata = {
        "alg": ENVELOPE_ALGORITHM,
        "kid": selected_key_id,
        "v": ENVELOPE_VERSION,
    }
    ciphertext = AESGCM(key).encrypt(
        nonce,
        str(raw_value).encode("utf-8"),
        _associated_data(metadata),
    )
    envelope = {
        **metadata,
        "ciphertext": _encode_base64(ciphertext),
        "nonce": _encode_base64(nonce),
    }
    return json.dumps(envelope, separators=(",", ":"), sort_keys=True)


def decrypt_credential_value(encrypted_value):
    envelope = _parse_aead_envelope(encrypted_value)
    if envelope is None:
        return _decrypt_legacy_value(encrypted_value)

    key = _load_keyring().get(envelope["kid"])
    if key is None:
        raise CredentialKeyConfigurationError()
    try:
        plaintext = AESGCM(key).decrypt(
            _decode_base64(envelope["nonce"]),
            _decode_base64(envelope["ciphertext"]),
            _associated_data(envelope),
        )
        return plaintext.decode("utf-8")
    except (InvalidTag, UnicodeDecodeError, ValueError, TypeError, binascii.Error):
        raise CredentialDecryptionError() from None


def decrypt_connector_credential(credential, *, at=None):
    current_time = at or timezone.now()
    if credential.expires_at and credential.expires_at <= current_time:
        raise CredentialExpiredError()
    return decrypt_credential_value(credential.encrypted_value)


def credential_envelope_key_id(encrypted_value):
    envelope = _parse_aead_envelope(encrypted_value)
    return envelope["kid"] if envelope is not None else LEGACY_KEY_ID


def credential_needs_rotation(encrypted_value, *, target_key_id=None):
    target = target_key_id or active_credential_key_id()
    return credential_envelope_key_id(encrypted_value) != target


def rotate_credential_value(encrypted_value, *, target_key_id=None):
    plaintext = decrypt_credential_value(encrypted_value)
    try:
        return encrypt_credential_value(plaintext, key_id=target_key_id)
    finally:
        plaintext = None


def active_credential_key_id():
    key_id = str(getattr(settings, "CONNECTOR_CREDENTIAL_ACTIVE_KEY_ID", "") or "").strip()
    if not _KEY_ID_PATTERN.fullmatch(key_id):
        raise CredentialKeyConfigurationError()
    return key_id


def configured_credential_key_ids():
    return tuple(sorted(_load_keyring()))


def credential_key_configuration_issues(*, production_like=None):
    issues = []
    try:
        keyring = _parse_configured_keyring()
    except CredentialKeyConfigurationError:
        return ["CONNECTOR_CREDENTIAL_KEYS is not a valid key mapping."]

    active_key_id = str(getattr(settings, "CONNECTOR_CREDENTIAL_ACTIVE_KEY_ID", "") or "").strip()
    if not _KEY_ID_PATTERN.fullmatch(active_key_id):
        issues.append("CONNECTOR_CREDENTIAL_ACTIVE_KEY_ID is missing or invalid.")
    elif active_key_id not in keyring:
        issues.append("The active connector credential key is absent from CONNECTOR_CREDENTIAL_KEYS.")

    if not keyring:
        issues.append("CONNECTOR_CREDENTIAL_KEYS has no usable AES-256 key.")

    is_production_like = (
        getattr(settings, "ENVIRONMENT", "development") in {"production", "staging"}
        if production_like is None
        else production_like
    )
    if is_production_like and active_key_id.startswith("local-"):
        issues.append("The local development credential key cannot be active in staging or production.")
    return issues


def _load_keyring():
    issues = credential_key_configuration_issues()
    if issues:
        raise CredentialKeyConfigurationError()
    return _parse_configured_keyring()


def _parse_configured_keyring():
    raw_keyring = getattr(settings, "CONNECTOR_CREDENTIAL_KEYS", "")
    if isinstance(raw_keyring, dict):
        values = raw_keyring
    else:
        try:
            values = json.loads(str(raw_keyring or "{}"))
        except (TypeError, ValueError):
            raise CredentialKeyConfigurationError() from None
    if not isinstance(values, dict):
        raise CredentialKeyConfigurationError()

    keyring = {}
    for raw_key_id, encoded_key in values.items():
        key_id = str(raw_key_id or "").strip()
        if not _KEY_ID_PATTERN.fullmatch(key_id):
            raise CredentialKeyConfigurationError()
        try:
            key = _decode_base64(str(encoded_key or ""))
        except (ValueError, TypeError, binascii.Error):
            raise CredentialKeyConfigurationError() from None
        if len(key) != _KEY_BYTES:
            raise CredentialKeyConfigurationError()
        keyring[key_id] = key
    return keyring


def _parse_aead_envelope(encrypted_value):
    try:
        envelope = json.loads(str(encrypted_value or ""))
    except (TypeError, ValueError):
        return None
    if not isinstance(envelope, dict):
        raise CredentialDecryptionError()
    required_fields = {"alg", "ciphertext", "kid", "nonce", "v"}
    if set(envelope) != required_fields:
        raise CredentialDecryptionError()
    if envelope.get("v") != ENVELOPE_VERSION or envelope.get("alg") != ENVELOPE_ALGORITHM:
        raise CredentialDecryptionError()
    if not _KEY_ID_PATTERN.fullmatch(str(envelope.get("kid") or "")):
        raise CredentialDecryptionError()
    return envelope


def _decrypt_legacy_value(encrypted_value):
    if not getattr(settings, "CONNECTOR_CREDENTIAL_ALLOW_LEGACY_DECRYPT", True):
        raise CredentialDecryptionError()
    try:
        envelope = signing.loads(encrypted_value, salt="zani.connector-credential")
        ciphertext = _decode_base64(envelope["ciphertext"])
        salt = str(envelope["salt"])
        stream = _legacy_key_stream(salt, len(ciphertext))
        plaintext = bytes(left ^ right for left, right in zip(ciphertext, stream))
        return plaintext.decode("utf-8")
    except (KeyError, TypeError, ValueError, UnicodeDecodeError, signing.BadSignature, binascii.Error):
        raise CredentialDecryptionError() from None


def _legacy_key_stream(salt, length):
    seed = f"{settings.SECRET_KEY}:{salt}:connector-credential".encode("utf-8")
    output = b""
    counter = 0
    while len(output) < length:
        output += hashlib.sha256(seed + counter.to_bytes(4, "big")).digest()
        counter += 1
    return output[:length]


def _associated_data(envelope):
    return json.dumps(
        {
            "alg": envelope["alg"],
            "kid": envelope["kid"],
            "v": envelope["v"],
        },
        separators=(",", ":"),
        sort_keys=True,
    ).encode("ascii")


def _encode_base64(value):
    return base64.urlsafe_b64encode(value).decode("ascii")


def _decode_base64(value):
    return base64.b64decode(value.encode("ascii"), altchars=b"-_", validate=True)
