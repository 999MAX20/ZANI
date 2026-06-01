import json
from urllib import parse, request as urllib_request

from django.conf import settings
from django.core import signing
from django.utils import timezone

from apps.bots.models import Bot, BotChannel
from apps.core.production_rules import is_safe_public_https_url
from apps.integrations.models import BusinessConnector


SIGNING_SALT = "zani.whatsapp.embedded-signup"


def build_embedded_signup_state(*, business, user, redirect_uri):
    return signing.dumps(
        {
            "business_id": business.id,
            "user_id": user.id,
            "redirect_uri": redirect_uri,
            "iat": timezone.now().isoformat(),
        },
        salt=SIGNING_SALT,
    )


def load_embedded_signup_state(state, max_age=1800):
    return signing.loads(state, salt=SIGNING_SALT, max_age=max_age)


def build_embedded_signup_url(*, business, user, redirect_uri):
    state = build_embedded_signup_state(business=business, user=user, redirect_uri=redirect_uri)
    params = {
        "client_id": settings.META_APP_ID,
        "redirect_uri": redirect_uri,
        "state": state,
        "response_type": "code",
        "scope": "whatsapp_business_management,whatsapp_business_messaging,business_management",
    }
    if settings.WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID:
        params["config_id"] = settings.WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID
    return f"{settings.WHATSAPP_EMBEDDED_SIGNUP_LOGIN_URL}?{parse.urlencode(params)}", state


def exchange_code_for_access_token(*, code, redirect_uri):
    if not settings.META_APP_ID or not settings.META_APP_SECRET:
        raise ValueError("META_APP_ID and META_APP_SECRET must be configured.")
    url = _graph_url(
        "oauth/access_token",
        {
            "client_id": settings.META_APP_ID,
            "client_secret": settings.META_APP_SECRET,
            "redirect_uri": redirect_uri,
            "code": code,
        },
    )
    with urllib_request.urlopen(url, timeout=15) as response:
        return json.loads(response.read().decode("utf-8"))


def complete_embedded_signup(*, business, user, code, state, redirect_uri, phone_number_id, waba_id="", display_phone_number=""):
    state_payload = load_embedded_signup_state(state)
    if state_payload["business_id"] != business.id or state_payload["user_id"] != user.id:
        raise ValueError("WhatsApp embedded signup state does not match the current user or business.")
    if state_payload.get("redirect_uri") != redirect_uri:
        raise ValueError("WhatsApp embedded signup redirect_uri mismatch.")
    token_payload = exchange_code_for_access_token(code=code, redirect_uri=redirect_uri)
    access_token = token_payload.get("access_token", "")
    if not access_token:
        raise ValueError("Meta did not return an access token.")
    if not phone_number_id:
        raise ValueError("Meta session did not return a WhatsApp phone_number_id.")

    bot, _ = Bot.objects.get_or_create(
        business=business,
        name="WhatsApp bot",
        defaults={"status": Bot.Statuses.ACTIVE, "default_language": "ru", "settings_json": {}},
    )
    if bot.status != Bot.Statuses.ACTIVE:
        bot.status = Bot.Statuses.ACTIVE
        bot.save(update_fields=["status", "updated_at"])

    channel, _ = BotChannel.objects.update_or_create(
        bot=bot,
        channel=BotChannel.Channels.WHATSAPP,
        defaults={
            "status": BotChannel.Statuses.ACTIVE,
            "external_id": phone_number_id,
            "config_json": {
                "provider_mode": "meta_cloud",
                "phone_number_id": phone_number_id,
                "access_token": access_token,
                "business_account_id": waba_id,
                "display_phone_number": display_phone_number,
                "embedded_signup": True,
            },
        },
    )
    connector, _ = BusinessConnector.objects.get_or_create(
        business=business,
        provider=BusinessConnector.Providers.WHATSAPP,
        name="WhatsApp",
        defaults={
            "capability": BusinessConnector.Capabilities.COMMUNICATIONS,
            "auth_type": BusinessConnector.AuthTypes.TOKEN,
        },
    )
    safe_config = dict(connector.config_json or {})
    safe_config.update(
        {
            "bot_channel_id": channel.id,
            "provider_mode": "meta_cloud",
            "phone_number_id_configured": True,
            "access_token_configured": True,
            "business_account_id_configured": bool(waba_id),
            "embedded_signup": True,
            "last_operation": "embedded_signup_complete",
        }
    )
    connector.status = BusinessConnector.Statuses.CONNECTED
    connector.capability = BusinessConnector.Capabilities.COMMUNICATIONS
    connector.auth_type = BusinessConnector.AuthTypes.TOKEN
    connector.config_json = safe_config
    connector.last_error = ""
    connector.connected_at = connector.connected_at or timezone.now()
    connector.save(update_fields=["status", "capability", "auth_type", "config_json", "last_error", "connected_at", "updated_at"])
    return channel, connector


def _graph_url(edge, params):
    base = str(settings.WHATSAPP_GRAPH_BASE_URL or "").strip().rstrip("/")
    if not is_safe_public_https_url(base):
        raise ValueError("WHATSAPP_GRAPH_BASE_URL must be a public HTTPS URL.")
    version = settings.WHATSAPP_GRAPH_API_VERSION.strip("/")
    return f"{base}/{version}/{edge}?{parse.urlencode(params)}"
