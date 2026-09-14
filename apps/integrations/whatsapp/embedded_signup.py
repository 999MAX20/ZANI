import json
from uuid import uuid4
from urllib import parse, request as urllib_request
from urllib.error import URLError

from django.conf import settings
from django.core import signing
from django.utils import timezone

from apps.bots.models import Bot, BotChannel
from apps.bots.lifecycle import ensure_bot_channel
from apps.core.production_rules import is_safe_public_https_url
from apps.integrations.models import BusinessConnector
from apps.integrations.channel_boundary import current_channel_setup
from apps.integrations.whatsapp_credentials import get_whatsapp_connector, store_whatsapp_access_token


SIGNING_SALT = "zani.whatsapp.embedded-signup"


def build_embedded_signup_state(*, business, user, redirect_uri, bot_channel=None):
    return signing.dumps(
        {
            "business_id": business.id,
            "user_id": user.id,
            "redirect_uri": redirect_uri,
            "bot_channel_id": bot_channel.id if bot_channel else None,
            "iat": timezone.now().isoformat(),
        },
        salt=SIGNING_SALT,
    )


def load_embedded_signup_state(state, max_age=1800):
    return signing.loads(state, salt=SIGNING_SALT, max_age=max_age)


def build_embedded_signup_url(*, business, user, redirect_uri, bot_channel=None):
    state = build_embedded_signup_state(business=business, user=user, redirect_uri=redirect_uri, bot_channel=bot_channel)
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


def resolve_embedded_signup_channel(*, business, state_payload):
    channel_id = state_payload.get("bot_channel_id")
    if channel_id:
        channel = BotChannel.objects.select_related("bot").filter(
            id=channel_id,
            bot__business=business,
            channel=BotChannel.Channels.WHATSAPP,
        ).first()
        if channel is None:
            raise ValueError("The selected WhatsApp channel is no longer available.")
        return channel

    bot = Bot.objects.filter(business=business).order_by("id").first()
    if bot is None:
        bot = Bot.objects.create(business=business, name="WhatsApp bot", status=Bot.Statuses.DRAFT, default_language="ru", settings_json={})
    channel, _ = ensure_bot_channel(
        bot=bot,
        channel_type=BotChannel.Channels.WHATSAPP,
    )
    return channel


def complete_embedded_signup(*, business, user, code, state, redirect_uri, phone_number_id, waba_id="", display_phone_number=""):
    state_payload = load_embedded_signup_state(state)
    if state_payload["business_id"] != business.id or state_payload["user_id"] != user.id:
        raise ValueError("WhatsApp embedded signup state does not match the current user or business.")
    if state_payload.get("redirect_uri") != redirect_uri:
        raise ValueError("WhatsApp embedded signup redirect_uri mismatch.")
    channel = resolve_embedded_signup_channel(business=business, state_payload=state_payload)
    token_payload = exchange_code_for_access_token(code=code, redirect_uri=redirect_uri)
    access_token = token_payload.get("access_token", "")
    if not access_token:
        raise ValueError("Meta did not return an access token.")
    if not phone_number_id:
        raise ValueError("Meta session did not return a WhatsApp phone_number_id.")

    validate_signup_phone_number(access_token, phone_number_id)

    with current_channel_setup(channel) as channel:
        channel.status = BotChannel.Statuses.ACTIVE
        channel.external_id = phone_number_id
        channel.config_json = {
            "provider_mode": "meta_cloud",
            "phone_number_id": phone_number_id,
            "access_token_configured": True,
            "business_account_id": waba_id,
            "display_phone_number": display_phone_number,
            "embedded_signup": True,
            "setup_revision": uuid4().hex,
            "connection_verified": True,
        }
        channel.save(update_fields=["status", "external_id", "config_json", "updated_at"])
        store_whatsapp_access_token(channel, access_token)
        connector = get_whatsapp_connector(channel)
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


def validate_signup_phone_number(access_token, phone_number_id):
    url = _graph_url(parse.quote(phone_number_id, safe=""), {"fields": "id,display_phone_number"})
    request = urllib_request.Request(url, headers={"Authorization": f"Bearer {access_token}"}, method="GET")
    try:
        with urllib_request.urlopen(request, timeout=15) as response:
            payload = json.loads(response.read().decode("utf-8"))
        valid = isinstance(payload, dict) and str(payload.get("id")) == phone_number_id and bool(payload.get("display_phone_number"))
    except (URLError, ValueError, TypeError) as exc:
        raise ValueError("The selected WhatsApp phone number could not be verified.") from exc
    if not valid:
        raise ValueError("The selected WhatsApp phone number could not be verified.")


def _graph_url(edge, params):
    base = str(settings.WHATSAPP_GRAPH_BASE_URL or "").strip().rstrip("/")
    if not is_safe_public_https_url(base):
        raise ValueError("WHATSAPP_GRAPH_BASE_URL must be a public HTTPS URL.")
    version = settings.WHATSAPP_GRAPH_API_VERSION.strip("/")
    return f"{base}/{version}/{edge}?{parse.urlencode(params)}"
