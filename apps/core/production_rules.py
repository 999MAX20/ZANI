from email.utils import parseaddr
import ipaddress
from typing import Iterable
from urllib.parse import urlparse, urlunparse

from django.conf import settings

from apps.core.security_config import has_strong_shared_secret


MAX_PRODUCTION_RATE_PER_MINUTE = {
    "auth_login": 10,
    "auth_refresh": 30,
    "auth_social": 20,
    "auth_signup": 10 / 60,
    "auth_password_reset": 5 / 60,
    "public_api": 120,
    "public_form": 60,
    "public_widget": 120,
    "integration_webhook": 300,
    "ai_assistant": 30,
}


def configured(value: object) -> bool:
    if value is None:
        return False
    if isinstance(value, str):
        return bool(value.strip())
    if isinstance(value, (list, tuple, set, dict)):
        return bool(value)
    return bool(value)


def database_engine() -> str:
    return settings.DATABASES["default"].get("ENGINE", "")


def database_sslmode() -> str:
    return str(settings.DATABASES["default"].get("OPTIONS", {}).get("sslmode", "")).lower()


def has_tls_postgres() -> bool:
    return "postgresql" in database_engine() and database_sslmode() in {"require", "verify-ca", "verify-full"}


def has_tls_redis_broker() -> bool:
    parsed = urlparse(str(settings.CELERY_BROKER_URL or ""))
    return parsed.scheme == "rediss" and bool(parsed.hostname)


def is_local_or_private_hostname(hostname: str) -> bool:
    hostname = str(hostname or "").strip().lower().rstrip(".")
    if not hostname or hostname in {"*", "localhost", "localhost.localdomain", "0.0.0.0"}:
        return True
    try:
        address = ipaddress.ip_address(hostname)
    except ValueError:
        return False
    return address.is_loopback or address.is_private or address.is_link_local or address.is_unspecified


def has_placeholder_host(hosts: Iterable[str]) -> bool:
    return any(is_local_or_private_hostname(host) for host in hosts or [])


def is_safe_https_origin(origin: str) -> bool:
    parsed = urlparse(str(origin or "").strip())
    if parsed.scheme != "https" or not parsed.hostname:
        return False
    if parsed.username or parsed.password or parsed.query or parsed.fragment:
        return False
    return not is_local_or_private_hostname(parsed.hostname)


def is_safe_public_https_url(value: str) -> bool:
    return is_safe_https_origin(value)


def redact_url_for_display(value: str) -> str:
    parsed = urlparse(str(value or "").strip())
    if not parsed.scheme or not parsed.netloc:
        return str(value or "").strip()
    try:
        port = parsed.port
    except ValueError:
        port = None
    netloc = parsed.hostname or ""
    if port:
        netloc = f"{netloc}:{port}"
    return urlunparse((parsed.scheme, netloc, parsed.path, "", "", ""))


def has_safe_https_origins(origins: Iterable[str]) -> bool:
    origins = list(origins or [])
    return bool(origins) and all(is_safe_https_origin(origin) for origin in origins)


def has_required_rate_limit_scopes() -> bool:
    rates = settings.REST_FRAMEWORK.get("DEFAULT_THROTTLE_RATES", {})
    return not unsafe_rate_limits(rates)


def has_private_object_storage() -> bool:
    if not settings.USE_S3:
        return False
    storage = getattr(settings, "STORAGES", {}).get("default", {})
    backend = str(storage.get("BACKEND", "")).lower()
    return all(
        [
            configured(getattr(settings, "AWS_STORAGE_BUCKET_NAME", "")),
            "s3" in backend,
            getattr(settings, "AWS_QUERYSTRING_AUTH", False) is True,
            getattr(settings, "AWS_DEFAULT_ACL", None) in {None, "private"},
        ]
    )


def has_transactional_email() -> bool:
    _, email_address = parseaddr(str(getattr(settings, "DEFAULT_FROM_EMAIL", "") or ""))
    email_domain = email_address.rsplit("@", 1)[-1].lower() if "@" in email_address else ""
    return all(
        [
            configured(getattr(settings, "EMAIL_HOST", "")),
            configured(email_address),
            email_domain not in {"", "localhost", "local", "test.local", "zani.local", "example.com"},
            bool(getattr(settings, "EMAIL_USE_TLS", False)) or bool(getattr(settings, "EMAIL_USE_SSL", False)),
        ]
    )


def has_sentry_observability() -> bool:
    parsed = urlparse(str(getattr(settings, "SENTRY_DSN", "") or ""))
    release = str(getattr(settings, "RELEASE", "") or "").strip().lower()
    sample_rate = getattr(settings, "SENTRY_TRACES_SAMPLE_RATE", None)
    try:
        sample_rate = float(sample_rate)
    except (TypeError, ValueError):
        return False
    return all(
        [
            parsed.scheme == "https",
            bool(parsed.hostname),
            release not in {"", "local", "test", "development"},
            0 <= sample_rate <= 0.2,
        ]
    )


def has_safe_telegram_runtime() -> bool:
    if not getattr(settings, "TELEGRAM_ENABLED", False):
        return True
    return has_strong_shared_secret(getattr(settings, "TELEGRAM_WEBHOOK_SECRET", "")) and is_safe_public_https_url(
        getattr(settings, "TELEGRAM_BASE_API_URL", "")
    )


def has_safe_whatsapp_runtime() -> bool:
    if not getattr(settings, "WHATSAPP_ENABLED", False):
        return True
    return all(
        [
            has_strong_shared_secret(getattr(settings, "WHATSAPP_VERIFY_TOKEN", "")),
            has_strong_shared_secret(getattr(settings, "WHATSAPP_APP_SECRET", "")),
            is_safe_public_https_url(getattr(settings, "WHATSAPP_GRAPH_BASE_URL", "")),
        ]
    )


def has_safe_instagram_runtime() -> bool:
    if not getattr(settings, "INSTAGRAM_ENABLED", False):
        return True
    app_secret = getattr(settings, "INSTAGRAM_APP_SECRET", "") or getattr(settings, "META_APP_SECRET", "")
    return all(
        [
            has_strong_shared_secret(getattr(settings, "INSTAGRAM_VERIFY_TOKEN", "")),
            has_strong_shared_secret(app_secret),
            is_safe_public_https_url(getattr(settings, "INSTAGRAM_GRAPH_BASE_URL", "")),
        ]
    )


def has_https_security() -> bool:
    return all(
        [
            settings.SECURE_SSL_REDIRECT,
            settings.SESSION_COOKIE_SECURE,
            settings.CSRF_COOKIE_SECURE,
            settings.SECURE_HSTS_SECONDS >= 31536000,
            settings.SECURE_HSTS_INCLUDE_SUBDOMAINS,
            settings.SECURE_HSTS_PRELOAD,
            settings.SECURE_PROXY_SSL_HEADER == ("HTTP_X_FORWARDED_PROTO", "https"),
        ]
    )


def unsafe_rate_limits(rates: dict) -> list[str]:
    unsafe = []
    for scope, max_per_minute in MAX_PRODUCTION_RATE_PER_MINUTE.items():
        configured_rate = rates.get(scope)
        rate_per_minute = rate_to_per_minute(configured_rate)
        if rate_per_minute is None or rate_per_minute > max_per_minute:
            unsafe.append(scope)
    return unsafe


def rate_to_per_minute(rate: str | None) -> float | None:
    if not rate or "/" not in rate:
        return None
    amount, period = rate.split("/", 1)
    try:
        amount = float(amount)
    except ValueError:
        return None
    period = period.lower()
    if period in {"s", "sec", "second"}:
        return amount * 60
    if period in {"m", "min", "minute"}:
        return amount
    if period in {"h", "hour"}:
        return amount / 60
    if period in {"d", "day"}:
        return amount / 1440
    return None
