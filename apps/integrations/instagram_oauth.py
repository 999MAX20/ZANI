import json
from uuid import uuid4
from urllib import parse, request as urllib_request

from django.conf import settings
from django.core import signing
from django.utils import timezone

from apps.bots.models import Bot, BotChannel
from apps.bots.lifecycle import ensure_bot_channel
from apps.core.production_rules import is_safe_public_https_url
from apps.integrations.bot_channel_credentials import get_bot_channel_connector, store_instagram_access_token
from apps.integrations.models import BusinessConnector
from apps.integrations.channel_boundary import current_channel_setup


INSTAGRAM_OAUTH_SCOPES = [
    "pages_show_list",
    "pages_read_engagement",
    "pages_manage_metadata",
    "pages_messaging",
    "instagram_basic",
    "instagram_manage_messages",
]


def build_instagram_oauth_url(*, business, user, redirect_uri, bot_channel=None):
    state = signing.dumps(
        {
            "business_id": business.id,
            "user_id": user.id,
            "redirect_uri": redirect_uri,
            "bot_channel_id": bot_channel.id if bot_channel else None,
            "ts": timezone.now().timestamp(),
        },
        salt="zani.instagram-oauth",
    )
    params = {
        "client_id": settings.META_APP_ID,
        "redirect_uri": redirect_uri,
        "state": state,
        "scope": ",".join(INSTAGRAM_OAUTH_SCOPES),
        "response_type": "code",
    }
    url = f"https://www.facebook.com/{settings.INSTAGRAM_GRAPH_API_VERSION}/dialog/oauth?{parse.urlencode(params)}"
    return url, state


def resolve_instagram_oauth_channel(*, business, state_payload):
    channel_id = state_payload.get("bot_channel_id")
    if channel_id:
        channel = BotChannel.objects.select_related("bot").filter(
            id=channel_id,
            bot__business=business,
            channel=BotChannel.Channels.INSTAGRAM,
        ).first()
        if channel is None:
            raise ValueError("The selected Instagram channel is no longer available.")
        return channel

    bot = Bot.objects.filter(business=business).order_by("id").first()
    if bot is None:
        bot = Bot.objects.create(business=business, name="Instagram bot", status=Bot.Statuses.DRAFT, default_language="ru", settings_json={})
    channel, _ = ensure_bot_channel(
        bot=bot,
        channel_type=BotChannel.Channels.INSTAGRAM,
    )
    return channel


def complete_instagram_oauth(*, business, user, code, state, redirect_uri, page_id=""):
    payload = signing.loads(state, salt="zani.instagram-oauth", max_age=60 * 30)
    if payload.get("business_id") != business.id or payload.get("user_id") != user.id:
        raise ValueError("Invalid Instagram OAuth state.")
    if payload.get("redirect_uri") != redirect_uri:
        raise ValueError("Instagram OAuth redirect_uri mismatch.")
    channel = resolve_instagram_oauth_channel(business=business, state_payload=payload)

    token_payload = exchange_code_for_instagram_access_token(code=code, redirect_uri=redirect_uri)
    user_token = token_payload.get("access_token")
    if not user_token:
        raise ValueError("Meta did not return an access token.")
    long_lived = exchange_for_long_lived_user_token(user_token) or user_token
    page = choose_instagram_page(fetch_instagram_pages(long_lived), page_id=page_id)
    ig_account = page.get("instagram_business_account") or {}
    ig_user_id = str(ig_account.get("id") or "")
    if not ig_user_id:
        raise ValueError("No Instagram Business account was found on the selected Facebook Page.")
    page_token = page.get("access_token") or long_lived

    with current_channel_setup(channel) as channel:
        config = dict(channel.config_json or {})
        config.update(
            {
                "provider_mode": "meta_graph",
                "instagram_user_id": ig_user_id,
                "access_token_configured": True,
                "page_id": str(page.get("id") or ""),
                "username": ig_account.get("username") or "",
                "auth_mode": "meta_oauth",
                "setup_revision": uuid4().hex,
                "connection_verified": True,
            }
        )
        channel.external_id = ig_user_id
        channel.status = BotChannel.Statuses.ACTIVE
        channel.config_json = config
        channel.save(update_fields=["external_id", "status", "config_json", "updated_at"])
        store_instagram_access_token(channel, page_token)

        connector = get_bot_channel_connector(channel, BusinessConnector.Providers.INSTAGRAM)
        safe_config = dict(connector.config_json or {})
        safe_config.update(
            {
                "bot_channel_id": channel.id,
                "provider_mode": "meta_graph",
                "instagram_user_id_configured": True,
                "access_token_configured": True,
                "page_id_configured": bool(page.get("id")),
                "auth_mode": "meta_oauth",
                "last_operation": "oauth_complete",
            }
        )
        connector.capability = BusinessConnector.Capabilities.COMMUNICATIONS
        connector.auth_type = BusinessConnector.AuthTypes.OAUTH
        connector.status = BusinessConnector.Statuses.CONNECTED
        connector.config_json = safe_config
        connector.last_error = ""
        connector.connected_at = connector.connected_at or timezone.now()
        connector.save(update_fields=["capability", "auth_type", "status", "config_json", "last_error", "connected_at", "updated_at"])
        return channel, connector


def exchange_code_for_instagram_access_token(*, code, redirect_uri):
    params = {
        "client_id": settings.META_APP_ID,
        "client_secret": settings.META_APP_SECRET,
        "redirect_uri": redirect_uri,
        "code": code,
    }
    return fetch_meta_json("oauth/access_token", params)


def exchange_for_long_lived_user_token(user_token):
    if not settings.META_APP_ID or not settings.META_APP_SECRET:
        return ""
    payload = fetch_meta_json(
        "oauth/access_token",
        {
            "grant_type": "fb_exchange_token",
            "client_id": settings.META_APP_ID,
            "client_secret": settings.META_APP_SECRET,
            "fb_exchange_token": user_token,
        },
    )
    return payload.get("access_token") or ""


def fetch_instagram_pages(access_token):
    return fetch_meta_json(
        "me/accounts",
        {
            "access_token": access_token,
            "fields": "id,name,access_token,instagram_business_account{id,username}",
            "limit": "100",
        },
    )


def choose_instagram_page(payload, page_id=""):
    pages = payload.get("data") or []
    if page_id:
        pages = [page for page in pages if str(page.get("id")) == str(page_id)]
    for page in pages:
        if (page.get("instagram_business_account") or {}).get("id"):
            return page
    raise ValueError("No Facebook Page with a linked Instagram Business account was found.")


def fetch_meta_json(path, params):
    base = str(settings.INSTAGRAM_GRAPH_BASE_URL or "").strip().rstrip("/")
    if not is_safe_public_https_url(base):
        raise ValueError("INSTAGRAM_GRAPH_BASE_URL must be a public HTTPS URL.")
    version = settings.INSTAGRAM_GRAPH_API_VERSION
    url = f"{base}/{version}/{path.lstrip('/')}?{parse.urlencode(params)}"
    request = urllib_request.Request(url, headers={"Accept": "application/json"}, method="GET")
    with urllib_request.urlopen(request, timeout=20) as response:
        return json.loads(response.read().decode("utf-8"))
