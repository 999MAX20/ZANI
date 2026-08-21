from django.utils import timezone

from apps.bots.models import BotChannel
from apps.integrations.bot_channel_credentials import credential_lookup_digest, find_bot_channel_by_credential
from apps.integrations.connectors import create_or_update_credential, read_connector_credential
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
        return read_connector_credential(
            connector,
            "access_token",
            expired_error="WhatsApp access token expired.",
        )

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


def store_whatsapp_webhook_secret(channel, webhook_secret):
    if not webhook_secret:
        return None
    connector = get_whatsapp_connector(channel)
    credential = create_or_update_credential(connector, "webhook_secret", webhook_secret)
    config = dict(connector.config_json or {})
    config.update(
        {
            "bot_channel_id": channel.id,
            "webhook_secret_configured": True,
            "webhook_secret_digest": credential_lookup_digest(
                BusinessConnector.Providers.WHATSAPP,
                "webhook_secret",
                webhook_secret,
            ),
            "last_operation": "credential_saved",
        }
    )
    connector.config_json = config
    connector.last_error = ""
    connector.save(update_fields=["config_json", "last_error", "updated_at"])
    return credential


def get_whatsapp_webhook_secret(channel):
    connector = BusinessConnector.objects.filter(
        business=channel.bot.business,
        provider=BusinessConnector.Providers.WHATSAPP,
    ).first()
    credential = connector.credentials.filter(key="webhook_secret").first() if connector else None
    if credential:
        return read_connector_credential(
            connector,
            "webhook_secret",
            expired_error="WhatsApp webhook secret expired.",
        )

    legacy_secret = (channel.config_json or {}).get("webhook_secret", "")
    if legacy_secret:
        store_whatsapp_webhook_secret(channel, legacy_secret)
        config = dict(channel.config_json or {})
        config.pop("webhook_secret", None)
        config["webhook_secret_configured"] = True
        channel.config_json = config
        channel.save(update_fields=["config_json", "updated_at"])
    return legacy_secret


def has_whatsapp_webhook_secret(channel):
    connector = BusinessConnector.objects.filter(
        business=channel.bot.business,
        provider=BusinessConnector.Providers.WHATSAPP,
    ).first()
    if connector and ConnectorCredential.objects.filter(connector=connector, key="webhook_secret").exists():
        return True
    return bool((channel.config_json or {}).get("webhook_secret"))


def find_whatsapp_channel_by_webhook_secret(webhook_secret):
    return find_bot_channel_by_credential(
        BusinessConnector.Providers.WHATSAPP,
        "webhook_secret",
        webhook_secret,
        BotChannel.Channels.WHATSAPP,
    )
