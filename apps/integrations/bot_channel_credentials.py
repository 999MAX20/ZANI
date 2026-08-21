import hashlib
import hmac

from django.conf import settings

from apps.bots.models import BotChannel
from apps.integrations.connectors import create_or_update_credential, read_connector_credential
from apps.integrations.models import BusinessConnector, ConnectorCredential


PROVIDER_META = {
    BusinessConnector.Providers.TELEGRAM: {
        "name": "Telegram",
        "auth_type": BusinessConnector.AuthTypes.TOKEN,
        "expired_error": "Telegram bot token expired.",
    },
    BusinessConnector.Providers.INSTAGRAM: {
        "name": "Instagram",
        "auth_type": BusinessConnector.AuthTypes.OAUTH,
        "expired_error": "Instagram access token expired.",
    },
    BusinessConnector.Providers.WHATSAPP: {
        "name": "WhatsApp",
        "auth_type": BusinessConnector.AuthTypes.OAUTH,
        "expired_error": "WhatsApp credential expired.",
    },
}


def credential_configured_flag(key):
    return "token_configured" if key == "bot_token" else f"{key}_configured"


def credential_lookup_digest(provider, key, raw_value):
    message = f"{provider}:{key}:{raw_value}".encode("utf-8")
    return hmac.new(str(settings.SECRET_KEY).encode("utf-8"), message, hashlib.sha256).hexdigest()


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
            credential_configured_flag(key): True,
            "last_operation": "credential_saved",
        }
    )
    if key == "webhook_secret":
        config["webhook_secret_digest"] = credential_lookup_digest(provider, key, raw_value)
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
        return read_connector_credential(connector, key, expired_error=meta["expired_error"])

    legacy_key = key
    legacy_value = (channel.config_json or {}).get(legacy_key, "")
    if legacy_value:
        store_bot_channel_credential(channel, provider, key, legacy_value)
        config = dict(channel.config_json or {})
        config.pop(legacy_key, None)
        config[credential_configured_flag(key)] = True
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
    return bool((channel.config_json or {}).get(key))


def find_bot_channel_by_credential(provider, key, raw_value, channel_type):
    if not raw_value:
        return None

    from apps.bots.models import Bot

    digest = credential_lookup_digest(provider, key, raw_value)
    connectors = BusinessConnector.objects.filter(
        provider=provider,
        config_json__webhook_secret_digest=digest,
        credentials__key=key,
    ).distinct()
    for connector in connectors:
        expected = read_connector_credential(connector, key, expired_error=PROVIDER_META[provider]["expired_error"])
        if not expected or not hmac.compare_digest(str(raw_value), str(expected)):
            continue
        channel_id = (connector.config_json or {}).get("bot_channel_id")
        channel = BotChannel.objects.select_related("bot", "bot__business").filter(
            id=channel_id,
            channel=channel_type,
            status__in=[BotChannel.Statuses.DRAFT, BotChannel.Statuses.ACTIVE],
            bot__status__in=[Bot.Statuses.DRAFT, Bot.Statuses.ACTIVE],
        ).first()
        if channel:
            return channel

    legacy_channel = BotChannel.objects.select_related("bot", "bot__business").filter(
        channel=channel_type,
        status__in=[BotChannel.Statuses.DRAFT, BotChannel.Statuses.ACTIVE],
        bot__status__in=[Bot.Statuses.DRAFT, Bot.Statuses.ACTIVE],
        **{f"config_json__{key}": raw_value},
    ).first()
    if legacy_channel:
        get_bot_channel_credential(legacy_channel, provider, key)
    return legacy_channel


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


def store_telegram_webhook_secret(channel, webhook_secret):
    return store_bot_channel_credential(
        channel,
        BusinessConnector.Providers.TELEGRAM,
        "webhook_secret",
        webhook_secret,
    )


def get_telegram_webhook_secret(channel):
    return get_bot_channel_credential(channel, BusinessConnector.Providers.TELEGRAM, "webhook_secret")


def has_telegram_webhook_secret(channel):
    return has_bot_channel_credential(channel, BusinessConnector.Providers.TELEGRAM, "webhook_secret")


def find_telegram_channel_by_webhook_secret(webhook_secret):
    return find_bot_channel_by_credential(
        BusinessConnector.Providers.TELEGRAM,
        "webhook_secret",
        webhook_secret,
        BotChannel.Channels.TELEGRAM,
    )


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
