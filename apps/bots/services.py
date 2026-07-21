import ipaddress
import secrets
from urllib.parse import urlparse

from django.conf import settings
from django.utils import timezone

from apps.bots.models import BotChannel
from apps.integrations.bot_channel_credentials import (
    has_instagram_access_token,
    has_telegram_bot_token,
    store_instagram_access_token,
    store_telegram_bot_token,
)
from apps.integrations.models import BusinessConnector, IntegrationEventLog
from apps.integrations.providers import get_provider
from apps.integrations.telegram import set_telegram_webhook, sync_telegram_updates as pull_telegram_updates, validate_telegram_token
from apps.integrations.whatsapp_credentials import has_whatsapp_access_token, store_whatsapp_access_token


def is_public_https_url(url):
    parsed = urlparse(url or "")
    if parsed.scheme != "https" or not parsed.hostname:
        return False
    hostname = parsed.hostname.lower()
    if hostname in {"localhost", "127.0.0.1", "0.0.0.0"} or hostname.endswith(".local"):
        return False
    try:
        ip = ipaddress.ip_address(hostname)
    except ValueError:
        return True
    return not (ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved)


def sync_telegram_connector(channel, status=None, last_error="", operation="config"):
    config = channel.config_json or {}
    token_configured = has_telegram_bot_token(channel)
    connector_status = status or (
        BusinessConnector.Statuses.NEEDS_ATTENTION if token_configured else BusinessConnector.Statuses.DRAFT
    )
    connector, _ = BusinessConnector.objects.get_or_create(
        business=channel.bot.business,
        provider=BusinessConnector.Providers.TELEGRAM,
        name="Telegram",
        defaults={
            "capability": BusinessConnector.Capabilities.COMMUNICATIONS,
            "auth_type": BusinessConnector.AuthTypes.TOKEN,
            "status": connector_status,
        },
    )
    safe_config = dict(connector.config_json or {})
    safe_config.update(
        {
            "bot_channel_id": channel.id,
            "token_configured": token_configured,
            "webhook_secret_configured": bool(config.get("webhook_secret")),
            "webhook_configured": bool(config.get("webhook_configured")),
            "last_operation": operation,
        }
    )
    connector.capability = BusinessConnector.Capabilities.COMMUNICATIONS
    connector.auth_type = BusinessConnector.AuthTypes.TOKEN
    connector.status = connector_status
    connector.config_json = safe_config
    connector.last_error = last_error
    if connector_status == BusinessConnector.Statuses.CONNECTED and connector.connected_at is None:
        connector.connected_at = timezone.now()
    connector.save(
        update_fields=[
            "capability",
            "auth_type",
            "status",
            "config_json",
            "last_error",
            "connected_at",
            "updated_at",
        ]
    )
    return connector


def sync_whatsapp_connector(channel, status=None, last_error="", operation="config"):
    config = channel.config_json or {}
    token_configured = has_whatsapp_access_token(channel)
    credentials_configured = bool((config.get("phone_number_id") or channel.external_id) and token_configured)
    connector_status = status or (
        BusinessConnector.Statuses.CONNECTED if credentials_configured else BusinessConnector.Statuses.NEEDS_ATTENTION
    )
    connector, _ = BusinessConnector.objects.get_or_create(
        business=channel.bot.business,
        provider=BusinessConnector.Providers.WHATSAPP,
        name="WhatsApp",
        defaults={
            "capability": BusinessConnector.Capabilities.COMMUNICATIONS,
            "auth_type": BusinessConnector.AuthTypes.TOKEN,
            "status": connector_status,
        },
    )
    safe_config = dict(connector.config_json or {})
    safe_config.update(
        {
            "bot_channel_id": channel.id,
            "provider_mode": config.get("provider_mode") or "mock",
            "phone_number_id_configured": bool(config.get("phone_number_id") or channel.external_id),
            "access_token_configured": token_configured,
            "business_account_id_configured": bool(config.get("business_account_id")),
            "last_operation": operation,
        }
    )
    connector.capability = BusinessConnector.Capabilities.COMMUNICATIONS
    connector.auth_type = BusinessConnector.AuthTypes.OAUTH
    connector.status = connector_status
    connector.config_json = safe_config
    connector.last_error = last_error
    if connector_status == BusinessConnector.Statuses.CONNECTED and connector.connected_at is None:
        connector.connected_at = timezone.now()
    connector.save(update_fields=["capability", "auth_type", "status", "config_json", "last_error", "connected_at", "updated_at"])
    return connector


def sync_instagram_connector(channel, status=None, last_error="", operation="config"):
    config = channel.config_json or {}
    token_configured = has_instagram_access_token(channel)
    credentials_configured = bool((config.get("instagram_user_id") or channel.external_id) and token_configured)
    connector_status = status or (
        BusinessConnector.Statuses.CONNECTED if credentials_configured else BusinessConnector.Statuses.NEEDS_ATTENTION
    )
    connector, _ = BusinessConnector.objects.get_or_create(
        business=channel.bot.business,
        provider=BusinessConnector.Providers.INSTAGRAM,
        name="Instagram",
        defaults={
            "capability": BusinessConnector.Capabilities.COMMUNICATIONS,
            "auth_type": BusinessConnector.AuthTypes.OAUTH,
            "status": connector_status,
        },
    )
    safe_config = dict(connector.config_json or {})
    safe_config.update(
        {
            "bot_channel_id": channel.id,
            "provider_mode": config.get("provider_mode") or "mock",
            "instagram_user_id_configured": bool(config.get("instagram_user_id") or channel.external_id),
            "access_token_configured": token_configured,
            "page_id_configured": bool(config.get("page_id")),
            "last_operation": operation,
        }
    )
    connector.capability = BusinessConnector.Capabilities.COMMUNICATIONS
    connector.auth_type = BusinessConnector.AuthTypes.OAUTH
    connector.status = connector_status
    connector.config_json = safe_config
    connector.last_error = last_error
    if connector_status == BusinessConnector.Statuses.CONNECTED and connector.connected_at is None:
        connector.connected_at = timezone.now()
    connector.save(update_fields=["capability", "auth_type", "status", "config_json", "last_error", "connected_at", "updated_at"])
    return connector


def configure_telegram_channel(channel, validated_data):
    config = dict(channel.config_json or {})
    if "bot_token" in validated_data:
        bot_token = validated_data["bot_token"]
        if bot_token:
            store_telegram_bot_token(channel, bot_token)
            config["token_configured"] = True
            config["token_verified"] = False
            config.pop("bot_username", None)
        config.pop("bot_token", None)
    if "webhook_secret" in validated_data:
        config["webhook_secret"] = validated_data["webhook_secret"]
    token_configured = has_telegram_bot_token(channel) or bool(config.get("token_configured"))
    if token_configured and not config.get("webhook_secret"):
        config["webhook_secret"] = secrets.token_urlsafe(32)
    channel.config_json = config
    channel.status = BotChannel.Statuses.ACTIVE if token_configured else channel.status
    channel.save(update_fields=["config_json", "status", "updated_at"])
    sync_telegram_connector(channel, operation="config")
    return {
        "ok": True,
        "token_configured": has_telegram_bot_token(channel),
        "webhook_secret_configured": bool(config.get("webhook_secret")),
        "status": channel.status,
    }


def set_telegram_channel_webhook(channel, webhook_url):
    result = set_telegram_webhook(channel, webhook_url)
    connector_status = BusinessConnector.Statuses.CONNECTED if result.get("ok") else BusinessConnector.Statuses.FAILED
    if result.get("ok"):
        config = dict(channel.config_json or {})
        config["webhook_configured"] = True
        channel.config_json = config
        channel.save(update_fields=["config_json", "updated_at"])
    sync_telegram_connector(
        channel,
        status=connector_status,
        last_error="" if result.get("ok") else result.get("reason", "Telegram webhook setup failed."),
        operation="set_webhook",
    )
    return result


def telegram_channel_status(channel, webhook_url):
    failed_event = IntegrationEventLog.objects.filter(
        business=channel.bot.business,
        provider=BotChannel.Channels.TELEGRAM,
        channel=BotChannel.Channels.TELEGRAM,
        status=IntegrationEventLog.Statuses.FAILED,
    ).first()
    last_inbound_event = IntegrationEventLog.objects.filter(
        business=channel.bot.business,
        provider=BotChannel.Channels.TELEGRAM,
        channel=BotChannel.Channels.TELEGRAM,
        direction=IntegrationEventLog.Directions.INBOUND,
    ).first()
    last_outbound_event = IntegrationEventLog.objects.filter(
        business=channel.bot.business,
        provider=BotChannel.Channels.TELEGRAM,
        channel=BotChannel.Channels.TELEGRAM,
        direction=IntegrationEventLog.Directions.OUTBOUND,
    ).first()
    config = channel.config_json or {}
    inbound_backend_ready = bool(last_inbound_event and last_inbound_event.status == IntegrationEventLog.Statuses.PROCESSED)
    webhook_public_ready = is_public_https_url(webhook_url)
    return {
        "status": channel.status,
        "token_configured": has_telegram_bot_token(channel),
        "token_verified": bool(config.get("token_verified")),
        "bot_username": config.get("bot_username", ""),
        "webhook_secret_configured": bool(config.get("webhook_secret")),
        "webhook_configured": bool(config.get("webhook_configured")),
        "webhook_url": webhook_url,
        "webhook_public_ready": webhook_public_ready,
        "inbound_backend_ready": inbound_backend_ready,
        "inbound_ready": bool(config.get("webhook_configured") and webhook_public_ready and inbound_backend_ready),
        "last_error": failed_event.error if failed_event else "",
        "last_inbound_status": last_inbound_event.status if last_inbound_event else "",
        "last_inbound_at": last_inbound_event.created_at if last_inbound_event else None,
        "last_outbound_status": last_outbound_event.status if last_outbound_event else "",
        "last_outbound_at": last_outbound_event.created_at if last_outbound_event else None,
    }


def test_telegram_channel_connection(channel):
    result = validate_telegram_token(channel)
    channel.status = BotChannel.Statuses.ACTIVE if result.get("ok") else BotChannel.Statuses.ERROR
    config = dict(channel.config_json or {})
    config["token_verified"] = bool(result.get("ok"))
    if result.get("ok") and result.get("bot", {}).get("username"):
        config["bot_username"] = result["bot"]["username"]
    channel.config_json = config
    channel.save(update_fields=["config_json", "status", "updated_at"])
    connector_status = BusinessConnector.Statuses.CONNECTED if result.get("ok") else BusinessConnector.Statuses.FAILED
    sync_telegram_connector(
        channel,
        status=connector_status,
        last_error="" if result.get("ok") else result.get("reason", "Telegram token validation failed."),
        operation="test_connection",
    )
    return {
        "ok": result.get("ok", False),
        "reason": result.get("reason", ""),
        "status": channel.status,
        "token_configured": result.get("token_configured", False),
        "bot": result.get("bot", {}),
    }


def sync_telegram_channel_updates(channel, limit=20):
    result = pull_telegram_updates(channel, limit=limit)
    sync_telegram_connector(
        channel,
        status=BusinessConnector.Statuses.CONNECTED if result.get("ok") else BusinessConnector.Statuses.FAILED,
        last_error="" if result.get("ok") else result.get("reason", "Telegram updates sync failed."),
        operation="sync_updates",
    )
    return result


def configure_whatsapp_channel(channel, validated_data):
    config = dict(channel.config_json or {})
    for key, value in validated_data.items():
        if key == "access_token":
            continue
        config[key] = value
    access_token = validated_data.get("access_token", "")
    if access_token:
        store_whatsapp_access_token(channel, access_token)
        config["access_token_configured"] = True
    config.pop("access_token", None)
    if not config.get("provider_mode"):
        config["provider_mode"] = "meta_cloud" if has_whatsapp_access_token(channel) and config.get("phone_number_id") else "mock"
    channel.config_json = config
    channel.external_id = config.get("phone_number_id", channel.external_id)
    channel.status = BotChannel.Statuses.PAUSED if config.get("provider_mode") == "disabled" else BotChannel.Statuses.ACTIVE
    channel.save(update_fields=["config_json", "external_id", "status", "updated_at"])
    sync_whatsapp_connector(channel, operation="config")
    return {
        "ok": True,
        "provider_mode": config["provider_mode"],
        "status": channel.status,
        "phone_number_id_configured": bool(config.get("phone_number_id") or channel.external_id),
        "access_token_configured": has_whatsapp_access_token(channel),
        "webhook_secret_configured": bool(config.get("webhook_secret")),
    }


def test_whatsapp_channel_connection(channel):
    result = get_provider(BotChannel.Channels.WHATSAPP).validate_credentials(channel)
    channel.status = BotChannel.Statuses.ACTIVE if result.get("ok") else BotChannel.Statuses.ERROR
    channel.save(update_fields=["status", "updated_at"])
    connector_status = BusinessConnector.Statuses.CONNECTED if result.get("ok") else BusinessConnector.Statuses.FAILED
    sync_whatsapp_connector(
        channel,
        status=connector_status,
        last_error="" if result.get("ok") else result.get("reason", "WhatsApp credentials validation failed."),
        operation="test_connection",
    )
    config = channel.config_json or {}
    return {
        "ok": result.get("ok", False),
        "mock": result.get("mock", False),
        "reason": result.get("reason", ""),
        "status": channel.status,
        "provider_mode": config.get("provider_mode") or "mock",
        "phone_number_id_configured": bool(config.get("phone_number_id") or channel.external_id),
        "access_token_configured": has_whatsapp_access_token(channel),
        "phone_number": result.get("phone_number", {}),
    }


def whatsapp_channel_status(channel, webhook_url):
    failed_event = IntegrationEventLog.objects.filter(
        business=channel.bot.business,
        provider=BotChannel.Channels.WHATSAPP,
        channel=BotChannel.Channels.WHATSAPP,
        status=IntegrationEventLog.Statuses.FAILED,
    ).first()
    last_event = IntegrationEventLog.objects.filter(
        business=channel.bot.business,
        provider=BotChannel.Channels.WHATSAPP,
        channel=BotChannel.Channels.WHATSAPP,
    ).first()
    config = channel.config_json or {}
    return {
        "status": channel.status,
        "provider_mode": config.get("provider_mode") or "mock",
        "webhook_url": webhook_url,
        "phone_number_id_configured": bool(config.get("phone_number_id") or channel.external_id),
        "access_token_configured": has_whatsapp_access_token(channel),
        "business_account_id_configured": bool(config.get("business_account_id")),
        "webhook_secret_configured": bool(config.get("webhook_secret")),
        "verify_token_configured": bool(settings.WHATSAPP_VERIFY_TOKEN),
        "app_secret_configured": bool(settings.WHATSAPP_APP_SECRET),
        "last_error": failed_event.error if failed_event else "",
        "last_event_status": last_event.status if last_event else "",
        "last_event_at": last_event.created_at if last_event else None,
    }


def configure_instagram_channel(channel, validated_data):
    config = dict(channel.config_json or {})
    for key, value in validated_data.items():
        if key == "access_token":
            continue
        config[key] = value
    access_token = validated_data.get("access_token", "")
    if access_token:
        store_instagram_access_token(channel, access_token)
        config["access_token_configured"] = True
    config.pop("access_token", None)
    if not config.get("provider_mode"):
        config["provider_mode"] = "meta_graph" if has_instagram_access_token(channel) and config.get("instagram_user_id") else "mock"
    channel.config_json = config
    channel.external_id = config.get("instagram_user_id", channel.external_id)
    channel.status = BotChannel.Statuses.PAUSED if config.get("provider_mode") == "disabled" else BotChannel.Statuses.ACTIVE
    channel.save(update_fields=["config_json", "external_id", "status", "updated_at"])
    sync_instagram_connector(channel, operation="config")
    return {
        "ok": True,
        "provider_mode": config["provider_mode"],
        "status": channel.status,
        "instagram_user_id_configured": bool(config.get("instagram_user_id") or channel.external_id),
        "access_token_configured": has_instagram_access_token(channel),
        "page_id_configured": bool(config.get("page_id")),
    }


def test_instagram_channel_connection(channel):
    result = get_provider(BotChannel.Channels.INSTAGRAM).validate_credentials(channel)
    channel.status = BotChannel.Statuses.ACTIVE if result.get("ok") else BotChannel.Statuses.ERROR
    channel.save(update_fields=["status", "updated_at"])
    connector_status = BusinessConnector.Statuses.CONNECTED if result.get("ok") else BusinessConnector.Statuses.FAILED
    sync_instagram_connector(
        channel,
        status=connector_status,
        last_error="" if result.get("ok") else result.get("reason", "Instagram credentials validation failed."),
        operation="test_connection",
    )
    config = channel.config_json or {}
    return {
        "ok": result.get("ok", False),
        "mock": result.get("mock", False),
        "reason": result.get("reason", ""),
        "status": channel.status,
        "provider_mode": config.get("provider_mode") or "mock",
        "instagram_user_id_configured": bool(config.get("instagram_user_id") or channel.external_id),
        "access_token_configured": has_instagram_access_token(channel),
        "instagram_account": result.get("instagram_account", {}),
    }


def instagram_channel_status(channel, webhook_url):
    failed_event = IntegrationEventLog.objects.filter(
        business=channel.bot.business,
        provider=BotChannel.Channels.INSTAGRAM,
        channel=BotChannel.Channels.INSTAGRAM,
        status=IntegrationEventLog.Statuses.FAILED,
    ).first()
    last_event = IntegrationEventLog.objects.filter(
        business=channel.bot.business,
        provider=BotChannel.Channels.INSTAGRAM,
        channel=BotChannel.Channels.INSTAGRAM,
    ).first()
    config = channel.config_json or {}
    return {
        "status": channel.status,
        "provider_mode": config.get("provider_mode") or "mock",
        "webhook_url": webhook_url,
        "instagram_user_id_configured": bool(config.get("instagram_user_id") or channel.external_id),
        "access_token_configured": has_instagram_access_token(channel),
        "page_id_configured": bool(config.get("page_id")),
        "verify_token_configured": bool(settings.INSTAGRAM_VERIFY_TOKEN),
        "app_secret_configured": bool(settings.INSTAGRAM_APP_SECRET or settings.META_APP_SECRET),
        "last_error": failed_event.error if failed_event else "",
        "last_event_status": last_event.status if last_event else "",
        "last_event_at": last_event.created_at if last_event else None,
    }
