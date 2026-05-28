import json
from urllib import parse, request as urllib_request

from django.conf import settings
from django.core import signing
from django.utils import timezone

from apps.bots.models import Bot, BotChannel
from apps.integrations.models import BusinessConnector


INSTAGRAM_OAUTH_SCOPES = [
    "pages_show_list",
    "pages_read_engagement",
    "pages_manage_metadata",
    "pages_messaging",
    "instagram_basic",
    "instagram_manage_messages",
]


def build_instagram_oauth_url(*, business, user, redirect_uri):
    state = signing.dumps(
        {
            "business_id": business.id,
            "user_id": user.id,
            "redirect_uri": redirect_uri,
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


def complete_instagram_oauth(*, business, user, code, state, redirect_uri, page_id=""):
    payload = signing.loads(state, salt="zani.instagram-oauth", max_age=60 * 30)
    if payload.get("business_id") != business.id or payload.get("user_id") != user.id:
        raise ValueError("Invalid Instagram OAuth state.")
    if payload.get("redirect_uri") != redirect_uri:
        raise ValueError("Instagram OAuth redirect_uri mismatch.")

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

    bot = Bot.objects.filter(business=business).order_by("id").first()
    if bot is None:
        bot = Bot.objects.create(business=business, name="Instagram bot", status=Bot.Statuses.ACTIVE, default_language="ru", settings_json={})
    channel, _ = BotChannel.objects.get_or_create(
        bot=bot,
        channel=BotChannel.Channels.INSTAGRAM,
        defaults={"status": BotChannel.Statuses.ACTIVE, "external_id": ig_user_id, "config_json": {}},
    )
    config = dict(channel.config_json or {})
    config.update(
        {
            "provider_mode": "meta_graph",
            "instagram_user_id": ig_user_id,
            "access_token": page_token,
            "page_id": str(page.get("id") or ""),
            "username": ig_account.get("username") or "",
            "auth_mode": "meta_oauth",
        }
    )
    channel.external_id = ig_user_id
    channel.status = BotChannel.Statuses.ACTIVE
    channel.config_json = config
    channel.save(update_fields=["external_id", "status", "config_json", "updated_at"])

    connector, _ = BusinessConnector.objects.get_or_create(
        business=business,
        provider=BusinessConnector.Providers.INSTAGRAM,
        name="Instagram",
        defaults={
            "capability": BusinessConnector.Capabilities.COMMUNICATIONS,
            "auth_type": BusinessConnector.AuthTypes.OAUTH,
            "status": BusinessConnector.Statuses.CONNECTED,
            "created_by": user,
        },
    )
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
    base = settings.INSTAGRAM_GRAPH_BASE_URL.rstrip("/")
    version = settings.INSTAGRAM_GRAPH_API_VERSION
    url = f"{base}/{version}/{path.lstrip('/')}?{parse.urlencode(params)}"
    request = urllib_request.Request(url, headers={"Accept": "application/json"}, method="GET")
    with urllib_request.urlopen(request, timeout=20) as response:
        return json.loads(response.read().decode("utf-8"))
