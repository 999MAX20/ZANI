from django.utils import timezone

from apps.integrations.connectors import create_or_update_credential, decrypt_credential_value
from apps.integrations.models import BusinessConnector, ConnectorCredential


def get_whatsapp_connector(channel):
    connector, _ = BusinessConnector.objects.get_or_create(
        business=channel.bot.business,
        provider=BusinessConnector.Providers.WHATSAPP,
        name="WhatsApp",
        defaults={
            "capability": BusinessConnector.Capabilities.COMMUNICATIONS,
            "auth_type": BusinessConnector.AuthTypes.OAUTH,
            "status": BusinessConnector.Statuses.NEEDS_ATTENTION,
        },
    )
    return connector


def store_whatsapp_access_token(channel, access_token, expires_at=None):
    if not access_token:
        return None
    connector = get_whatsapp_connector(channel)
    credential = create_or_update_credential(connector, "access_token", access_token, expires_at=expires_at)
    config = dict(connector.config_json or {})
    config.update(
        {
            "bot_channel_id": channel.id,
            "provider_mode": "meta_cloud",
            "phone_number_id_configured": bool((channel.config_json or {}).get("phone_number_id") or channel.external_id),
            "access_token_configured": True,
            "last_operation": "credential_saved",
        }
    )
    connector.auth_type = BusinessConnector.AuthTypes.OAUTH
    connector.capability = BusinessConnector.Capabilities.COMMUNICATIONS
    connector.status = BusinessConnector.Statuses.CONNECTED
    connector.config_json = config
    connector.last_error = ""
    connector.connected_at = connector.connected_at or timezone.now()
    connector.save(update_fields=["auth_type", "capability", "status", "config_json", "last_error", "connected_at", "updated_at"])
    return credential


def get_whatsapp_access_token(channel):
    connector = BusinessConnector.objects.filter(
        business=channel.bot.business,
        provider=BusinessConnector.Providers.WHATSAPP,
    ).first()
    credential = connector.credentials.filter(key="access_token").first() if connector else None
    if credential:
        if credential.expires_at and credential.expires_at <= timezone.now():
            connector.status = BusinessConnector.Statuses.EXPIRED_CREDENTIALS
            connector.last_error = "WhatsApp access token expired."
            connector.save(update_fields=["status", "last_error", "updated_at"])
            return ""
        return decrypt_credential_value(credential.encrypted_value)

    legacy_token = (channel.config_json or {}).get("access_token", "")
    if legacy_token:
        store_whatsapp_access_token(channel, legacy_token)
        config = dict(channel.config_json or {})
        config.pop("access_token", None)
        config["access_token_configured"] = True
        channel.config_json = config
        channel.save(update_fields=["config_json", "updated_at"])
    return legacy_token


def has_whatsapp_access_token(channel):
    connector = BusinessConnector.objects.filter(
        business=channel.bot.business,
        provider=BusinessConnector.Providers.WHATSAPP,
    ).first()
    if connector and ConnectorCredential.objects.filter(connector=connector, key="access_token").exists():
        return True
    return bool((channel.config_json or {}).get("access_token"))
