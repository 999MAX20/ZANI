from django.utils import timezone

from apps.bots.models import BotChannel
from apps.integrations.connectors import create_or_update_credential, decrypt_credential_value
from apps.integrations.models import BusinessConnector, ConnectorCredential


PROVIDER_META = {
    BusinessConnector.Providers.TELEGRAM: {
        "name": "Telegram",
        "auth_type": BusinessConnector.AuthTypes.TOKEN,
        "configured_flag": "token_configured",
        "legacy_key": "bot_token",
        "expired_error": "Telegram bot token expired.",
    },
    BusinessConnector.Providers.INSTAGRAM: {
        "name": "Instagram",
        "auth_type": BusinessConnector.AuthTypes.OAUTH,
        "configured_flag": "access_token_configured",
        "legacy_key": "access_token",
        "expired_error": "Instagram access token expired.",
    },
}


def get_bot_channel_connector(channel, provider):
    meta = PROVIDER_META[provider]
    connector, _ = BusinessConnector.objects.get_or_create(
        business=channel.bot.business,
        provider=provider,
        name=meta["name"],
        defaults={
            "capability": BusinessConnector.Capabilities.COMMUNICATIONS,
            "auth_type": meta["auth_type"],
            "status": BusinessConnector.Statuses.NEEDS_ATTENTION,
        },
    )
    return connector


def store_bot_channel_credential(channel, provider, key, raw_value, *, expires_at=None, config_updates=None):
    if not raw_value:
        return None

    connector = get_bot_channel_connector(channel, provider)
    credential = create_or_update_credential(connector, key, raw_value, expires_at=expires_at)
    meta = PROVIDER_META[provider]
    config = dict(connector.config_json or {})
    config.update(
        {
            "bot_channel_id": channel.id,
            meta["configured_flag"]: True,
            "last_operation": "credential_saved",
        }
    )
    config.update(config_updates or {})
    connector.auth_type = meta["auth_type"]
    connector.capability = BusinessConnector.Capabilities.COMMUNICATIONS
    connector.status = BusinessConnector.Statuses.NEEDS_ATTENTION
    connector.config_json = config
    connector.last_error = ""
    connector.save(update_fields=["auth_type", "capability", "status", "config_json", "last_error", "updated_at"])
    return credential


def get_bot_channel_credential(channel, provider, key):
    connector = BusinessConnector.objects.filter(
        business=channel.bot.business,
        provider=provider,
    ).first()
    credential = connector.credentials.filter(key=key).first() if connector else None
    meta = PROVIDER_META[provider]
    if credential:
        if credential.expires_at and credential.expires_at <= timezone.now():
            connector.status = BusinessConnector.Statuses.EXPIRED_CREDENTIALS
            connector.last_error = meta["expired_error"]
            connector.save(update_fields=["status", "last_error", "updated_at"])
            return ""
        return decrypt_credential_value(credential.encrypted_value)

    legacy_key = meta["legacy_key"]
    legacy_value = (channel.config_json or {}).get(legacy_key, "")
    if legacy_value:
        store_bot_channel_credential(channel, provider, key, legacy_value)
        config = dict(channel.config_json or {})
        config.pop(legacy_key, None)
        config[meta["configured_flag"]] = True
        channel.config_json = config
        channel.save(update_fields=["config_json", "updated_at"])
    return legacy_value


def has_bot_channel_credential(channel, provider, key):
    connector = BusinessConnector.objects.filter(
        business=channel.bot.business,
        provider=provider,
    ).first()
    if connector and ConnectorCredential.objects.filter(connector=connector, key=key).exists():
        return True
    return bool((channel.config_json or {}).get(PROVIDER_META[provider]["legacy_key"]))


def store_telegram_bot_token(channel, bot_token, expires_at=None):
    return store_bot_channel_credential(
        channel,
        BusinessConnector.Providers.TELEGRAM,
        "bot_token",
        bot_token,
        expires_at=expires_at,
    )


def get_telegram_bot_token(channel):
    return get_bot_channel_credential(channel, BusinessConnector.Providers.TELEGRAM, "bot_token")


def has_telegram_bot_token(channel):
    return has_bot_channel_credential(channel, BusinessConnector.Providers.TELEGRAM, "bot_token")


def store_instagram_access_token(channel, access_token, expires_at=None):
    config = channel.config_json or {}
    return store_bot_channel_credential(
        channel,
        BusinessConnector.Providers.INSTAGRAM,
        "access_token",
        access_token,
        expires_at=expires_at,
        config_updates={
            "provider_mode": config.get("provider_mode") or "meta_graph",
            "instagram_user_id_configured": bool(config.get("instagram_user_id") or channel.external_id),
            "page_id_configured": bool(config.get("page_id")),
        },
    )


def get_instagram_access_token(channel):
    return get_bot_channel_credential(channel, BusinessConnector.Providers.INSTAGRAM, "access_token")


def has_instagram_access_token(channel):
    return has_bot_channel_credential(channel, BusinessConnector.Providers.INSTAGRAM, "access_token")
