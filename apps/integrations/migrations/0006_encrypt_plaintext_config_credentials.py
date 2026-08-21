import hashlib
import hmac
import json
import re

from django.conf import settings
from django.db import migrations
from django.utils import timezone

from apps.integrations.credential_encryption import encrypt_credential_value


SAFE_SUFFIXES = ("_configured", "_config_id", "_digest", "_fingerprint", "_status", "_type", "_verified")
SENSITIVE_EXACT_KEYS = {"token", "api_secret", "secret", "password", "credentials"}
SENSITIVE_MARKERS = (
    "password",
    "secret",
    "access_token",
    "refresh_token",
    "api_key",
    "api_token",
    "auth_token",
    "bearer_token",
    "bot_token",
    "private_key",
    "authorization",
    "credential",
)
PROVIDER_NAMES = {
    "website": "Website",
    "telegram": "Telegram",
    "whatsapp": "WhatsApp",
    "instagram": "Instagram",
}


def _normalize_key(key):
    value = re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", str(key or ""))
    return re.sub(r"[^a-zA-Z0-9]+", "_", value).strip("_").lower()


def _is_sensitive(key):
    normalized = _normalize_key(key)
    if normalized.endswith(SAFE_SUFFIXES):
        return False
    if normalized in SENSITIVE_EXACT_KEYS:
        return True
    compact = normalized.replace("_", "")
    return any(marker in normalized or marker.replace("_", "") in compact for marker in SENSITIVE_MARKERS)


def _credential_key(path):
    normalized = ".".join(_normalize_key(part) for part in re.split(r"\.|\[\d+\]", path) if part)
    if len(normalized) <= 96:
        return normalized
    digest = hashlib.sha256(normalized.encode("utf-8")).hexdigest()[:16]
    return f"{normalized[:79]}.{digest}"


def _raw_value(value):
    if isinstance(value, (dict, list)):
        return json.dumps(value, separators=(",", ":"), sort_keys=True)
    return str(value)


def _extract(value, prefix=""):
    credentials = []
    if isinstance(value, dict):
        clean = {}
        for key, item in value.items():
            path = f"{prefix}.{key}" if prefix else str(key)
            if _is_sensitive(key):
                if item not in (None, "", False):
                    credentials.append((_credential_key(path), _raw_value(item)))
                    configured_flag = "token_configured" if _normalize_key(key) == "bot_token" else f"{key}_configured"
                    clean[configured_flag] = True
                continue
            clean_item, nested = _extract(item, path)
            clean[key] = clean_item
            credentials.extend(nested)
        return clean, credentials
    if isinstance(value, list):
        clean = []
        for index, item in enumerate(value):
            clean_item, nested = _extract(item, f"{prefix}[{index}]")
            clean.append(clean_item)
            credentials.extend(nested)
        return clean, credentials
    return value, credentials


def _mask(value):
    value = str(value or "")
    if len(value) <= 8:
        return f"{value[:2]}***{value[-2:]}" if value else ""
    return f"{value[:4]}...{value[-4:]}"


def _lookup_digest(provider, key, value):
    message = f"{provider}:{key}:{value}".encode("utf-8")
    return hmac.new(str(settings.SECRET_KEY).encode("utf-8"), message, hashlib.sha256).hexdigest()


def _store_credentials(Credential, connector, credentials):
    for key, raw_value in credentials:
        Credential.objects.get_or_create(
            connector_id=connector.id,
            key=key,
            defaults={
                "business_id": connector.business_id,
                "encrypted_value": encrypt_credential_value(raw_value),
                "masked_value": _mask(raw_value),
                "rotated_at": timezone.now(),
            },
        )


def migrate_plaintext_config_credentials(apps, schema_editor):
    BusinessConnector = apps.get_model("integrations", "BusinessConnector")
    Credential = apps.get_model("integrations", "ConnectorCredential")
    BotChannel = apps.get_model("bots", "BotChannel")

    for connector in BusinessConnector.objects.all().iterator():
        clean, credentials = _extract(connector.config_json or {})
        for key, raw_value in credentials:
            if key == "webhook_secret":
                clean["webhook_secret_digest"] = _lookup_digest(connector.provider, key, raw_value)
        _store_credentials(Credential, connector, credentials)
        if clean != (connector.config_json or {}):
            BusinessConnector.objects.filter(id=connector.id).update(config_json=clean)

    for channel in BotChannel.objects.select_related("bot").all().iterator():
        clean, credentials = _extract(channel.config_json or {})
        if not credentials:
            continue
        provider = channel.channel
        connector, _ = BusinessConnector.objects.get_or_create(
            business_id=channel.bot.business_id,
            provider=provider,
            name=PROVIDER_NAMES.get(provider, str(provider).replace("_", " ").title()),
            defaults={
                "capability": "communications",
                "auth_type": "oauth" if provider in {"whatsapp", "instagram"} else "token",
                "status": "needs_attention",
            },
        )
        connector_config = dict(connector.config_json or {})
        connector_config["bot_channel_id"] = channel.id
        for key, raw_value in credentials:
            configured_flag = "token_configured" if key == "bot_token" else f"{key}_configured"
            connector_config[configured_flag] = True
            if key == "webhook_secret":
                connector_config["webhook_secret_digest"] = _lookup_digest(provider, key, raw_value)
        connector_config["last_operation"] = "plaintext_credential_migrated"
        _store_credentials(Credential, connector, credentials)
        BusinessConnector.objects.filter(id=connector.id).update(config_json=connector_config)
        BotChannel.objects.filter(id=channel.id).update(config_json=clean)


class Migration(migrations.Migration):
    dependencies = [
        ("bots", "0010_botmessage_delivery_attempts_and_more"),
        ("integrations", "0005_alter_businessconnector_status"),
    ]

    operations = [
        migrations.RunPython(migrate_plaintext_config_credentials, migrations.RunPython.noop),
    ]
