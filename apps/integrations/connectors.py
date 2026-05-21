import base64
import hashlib
import json
import secrets
from datetime import timedelta

from django.conf import settings
from django.core import signing
from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.integrations.models import BusinessConnector, BusinessEvent, ConnectorCredential, ConnectorSyncRun


CONNECTOR_PROVIDER_CAPABILITIES = {
    BusinessConnector.Providers.WEBSITE: {
        "capability": BusinessConnector.Capabilities.SALES,
        "auth_type": BusinessConnector.AuthTypes.NONE,
        "label": "Website forms",
    },
    BusinessConnector.Providers.TELEGRAM: {
        "capability": BusinessConnector.Capabilities.COMMUNICATIONS,
        "auth_type": BusinessConnector.AuthTypes.TOKEN,
        "label": "Telegram",
    },
    BusinessConnector.Providers.WHATSAPP: {
        "capability": BusinessConnector.Capabilities.COMMUNICATIONS,
        "auth_type": BusinessConnector.AuthTypes.TOKEN,
        "label": "WhatsApp",
    },
    BusinessConnector.Providers.INSTAGRAM: {
        "capability": BusinessConnector.Capabilities.COMMUNICATIONS,
        "auth_type": BusinessConnector.AuthTypes.OAUTH,
        "label": "Instagram",
    },
    BusinessConnector.Providers.EMAIL: {
        "capability": BusinessConnector.Capabilities.COMMUNICATIONS,
        "auth_type": BusinessConnector.AuthTypes.LOGIN,
        "label": "Email",
    },
    BusinessConnector.Providers.KASPI: {
        "capability": BusinessConnector.Capabilities.FINANCE,
        "auth_type": BusinessConnector.AuthTypes.CONNECTOR,
        "label": "Kaspi",
    },
    BusinessConnector.Providers.ONE_C: {
        "capability": BusinessConnector.Capabilities.INVENTORY,
        "auth_type": BusinessConnector.AuthTypes.CONNECTOR,
        "label": "1C",
    },
    BusinessConnector.Providers.GOOGLE_CALENDAR: {
        "capability": BusinessConnector.Capabilities.CALENDAR,
        "auth_type": BusinessConnector.AuthTypes.OAUTH,
        "label": "Google Calendar",
    },
    BusinessConnector.Providers.CUSTOM: {
        "capability": BusinessConnector.Capabilities.CUSTOM,
        "auth_type": BusinessConnector.AuthTypes.CONNECTOR,
        "label": "Custom connector",
    },
}


def available_connector_capabilities():
    return [
        {
            "provider": provider,
            "label": config["label"],
            "capability": config["capability"],
            "auth_type": config["auth_type"],
        }
        for provider, config in CONNECTOR_PROVIDER_CAPABILITIES.items()
    ]


def defaults_for_provider(provider):
    return CONNECTOR_PROVIDER_CAPABILITIES.get(
        provider,
        {
            "capability": BusinessConnector.Capabilities.CUSTOM,
            "auth_type": BusinessConnector.AuthTypes.CONNECTOR,
            "label": provider.replace("_", " ").title(),
        },
    )


def mask_secret(value):
    value = str(value or "")
    if not value:
        return ""
    if len(value) <= 8:
        return f"{value[:2]}***{value[-2:]}"
    return f"{value[:4]}...{value[-4:]}"


def _credential_key_stream(salt, length):
    seed = f"{settings.SECRET_KEY}:{salt}:connector-credential".encode("utf-8")
    output = b""
    counter = 0
    while len(output) < length:
        output += hashlib.sha256(seed + counter.to_bytes(4, "big")).digest()
        counter += 1
    return output[:length]


def encrypt_credential_value(raw_value):
    plaintext = str(raw_value).encode("utf-8")
    salt = secrets.token_hex(16)
    stream = _credential_key_stream(salt, len(plaintext))
    ciphertext = bytes(left ^ right for left, right in zip(plaintext, stream))
    envelope = {
        "v": 1,
        "salt": salt,
        "ciphertext": base64.urlsafe_b64encode(ciphertext).decode("ascii"),
    }
    return signing.dumps(envelope, salt="zani.connector-credential")


def decrypt_credential_value(encrypted_value):
    envelope = signing.loads(encrypted_value, salt="zani.connector-credential")
    ciphertext = base64.urlsafe_b64decode(envelope["ciphertext"].encode("ascii"))
    stream = _credential_key_stream(envelope["salt"], len(ciphertext))
    plaintext = bytes(left ^ right for left, right in zip(ciphertext, stream))
    return plaintext.decode("utf-8")


def create_or_update_credential(connector, key, raw_value, expires_at=None):
    encrypted_value = encrypt_credential_value(raw_value)
    defaults = {
        "business": connector.business,
        "encrypted_value": encrypted_value,
        "masked_value": mask_secret(raw_value),
        "expires_at": expires_at,
        "rotated_at": timezone.now(),
    }
    credential, _ = ConnectorCredential.objects.update_or_create(
        connector=connector,
        key=key,
        defaults=defaults,
    )
    return credential


def connector_has_active_credentials(connector):
    now = timezone.now()
    return connector.credentials.filter(expires_at__isnull=True).exists() or connector.credentials.filter(expires_at__gt=now).exists()


def update_connector_health(connector, status=None, error="", save=True):
    if status is None:
        status = BusinessConnector.Statuses.CONNECTED if connector_has_active_credentials(connector) or connector.auth_type == BusinessConnector.AuthTypes.NONE else BusinessConnector.Statuses.NEEDS_ATTENTION
    connector.status = status
    connector.last_error = error
    if status == BusinessConnector.Statuses.CONNECTED and connector.connected_at is None:
        connector.connected_at = timezone.now()
    if save:
        connector.save(update_fields=["status", "last_error", "connected_at", "updated_at"])
    return connector


def business_event_deduplication_key(source, event_type, payload, external_id=""):
    if external_id:
        raw = f"{source}:{event_type}:{external_id}"
    else:
        serialized = json.dumps(payload or {}, sort_keys=True, default=str)
        raw = f"{source}:{event_type}:{serialized}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def normalize_business_event(business, source, event_type, payload, external_id="", connector=None, occurred_at=None):
    deduplication_key = business_event_deduplication_key(source, event_type, payload, external_id=external_id)
    defaults = {
        "connector": connector,
        "event_type": event_type,
        "external_id": external_id or "",
        "occurred_at": occurred_at or timezone.now(),
        "payload_json": payload or {},
        "status": BusinessEvent.Statuses.RECEIVED,
    }
    try:
        with transaction.atomic():
            event, created = BusinessEvent.objects.get_or_create(
                business=business,
                source=source,
                deduplication_key=deduplication_key,
                defaults=defaults,
            )
    except IntegrityError:
        event = BusinessEvent.objects.get(
            business=business,
            source=source,
            deduplication_key=deduplication_key,
        )
        created = False
    return event, created


def run_connector_healthcheck(connector):
    now = timezone.now()
    run = ConnectorSyncRun.objects.create(
        business=connector.business,
        connector=connector,
        mode=ConnectorSyncRun.Modes.HEALTHCHECK,
        status=ConnectorSyncRun.Statuses.RUNNING,
        started_at=now,
    )
    status = BusinessConnector.Statuses.CONNECTED
    error = ""
    if connector.status == BusinessConnector.Statuses.DISABLED:
        status = BusinessConnector.Statuses.DISABLED
    elif connector.auth_type != BusinessConnector.AuthTypes.NONE and not connector_has_active_credentials(connector):
        status = BusinessConnector.Statuses.NEEDS_ATTENTION
        error = "Connector credentials are missing or expired."
    update_connector_health(connector, status=status, error=error)
    run.status = ConnectorSyncRun.Statuses.SUCCEEDED if not error else ConnectorSyncRun.Statuses.FAILED
    run.error = error
    run.finished_at = timezone.now()
    run.events_received = 0
    run.events_processed = 0
    run.save(update_fields=["status", "error", "finished_at", "events_received", "events_processed"])
    connector.next_sync_at = timezone.now() + timedelta(hours=6)
    connector.last_sync_at = run.finished_at
    connector.save(update_fields=["last_sync_at", "next_sync_at", "updated_at"])
    return run
