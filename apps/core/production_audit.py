from dataclasses import asdict, dataclass
from typing import Iterable

from django.conf import settings


@dataclass(frozen=True)
class ProductionAuditItem:
    key: str
    title: str
    status: str
    severity: str
    detail: str
    action: str


def _status(condition: bool, severity: str = "critical") -> str:
    if condition:
        return "pass"
    return "fail" if severity == "critical" else "warn"


def _item(key: str, title: str, condition: bool, detail: str, action: str, severity: str = "critical") -> ProductionAuditItem:
    return ProductionAuditItem(
        key=key,
        title=title,
        status=_status(condition, severity),
        severity=severity,
        detail=detail,
        action=action,
    )


def _database_engine() -> str:
    return settings.DATABASES["default"].get("ENGINE", "")


def _is_sqlite() -> bool:
    return _database_engine().endswith("sqlite3")


def _configured(value: object) -> bool:
    if value is None:
        return False
    if isinstance(value, str):
        return bool(value.strip())
    if isinstance(value, (list, tuple, set, dict)):
        return bool(value)
    return bool(value)


def _has_placeholder_host(hosts: Iterable[str]) -> bool:
    return any(host in {"*", "localhost", "127.0.0.1", "0.0.0.0"} for host in hosts)


def _has_required_rate_limit_scopes() -> bool:
    rates = settings.REST_FRAMEWORK.get("DEFAULT_THROTTLE_RATES", {})
    required_scopes = {
        "auth_login",
        "auth_refresh",
        "public_api",
        "public_form",
        "public_widget",
        "integration_webhook",
        "ai_assistant",
    }
    return required_scopes.issubset(set(rates.keys())) and all(bool(rates.get(scope)) for scope in required_scopes)


def run_production_readiness_audit() -> dict:
    items = [
        _item(
            "environment.debug",
            "DEBUG disabled",
            not settings.DEBUG,
            f"DEBUG={settings.DEBUG}",
            "Set DEBUG=False outside local development.",
        ),
        _item(
            "environment.secret_key",
            "Strong SECRET_KEY",
            settings.SECRET_KEY not in {"change-me-in-production", "change-me-use-32-plus-random-characters"} and len(settings.SECRET_KEY) >= 32,
            f"SECRET_KEY length={len(settings.SECRET_KEY)}",
            "Use a unique 32+ byte random secret from env.",
        ),
        _item(
            "environment.hosts",
            "Restricted ALLOWED_HOSTS",
            bool(settings.ALLOWED_HOSTS) and not _has_placeholder_host(settings.ALLOWED_HOSTS),
            f"ALLOWED_HOSTS={settings.ALLOWED_HOSTS}",
            "Set only production API hostnames.",
        ),
        _item(
            "environment.cors",
            "Frontend origins configured",
            _configured(settings.CORS_ALLOWED_ORIGINS) and _configured(settings.CSRF_TRUSTED_ORIGINS),
            f"CORS={settings.CORS_ALLOWED_ORIGINS}; CSRF={settings.CSRF_TRUSTED_ORIGINS}",
            "Set CORS_ALLOWED_ORIGINS and CSRF_TRUSTED_ORIGINS to HTTPS app origins.",
        ),
        _item(
            "security.https",
            "HTTPS security flags enabled",
            settings.SECURE_SSL_REDIRECT and settings.SESSION_COOKIE_SECURE and settings.CSRF_COOKIE_SECURE and settings.SECURE_HSTS_SECONDS >= 31536000,
            f"SSL_REDIRECT={settings.SECURE_SSL_REDIRECT}; SESSION_SECURE={settings.SESSION_COOKIE_SECURE}; CSRF_SECURE={settings.CSRF_COOKIE_SECURE}; HSTS={settings.SECURE_HSTS_SECONDS}",
            "Enable SSL redirect, secure cookies and HSTS behind a trusted proxy.",
        ),
        _item(
            "security.support_access",
            "Support access requires grants",
            settings.SUPPORT_REQUIRES_GRANT,
            f"SUPPORT_REQUIRES_GRANT={settings.SUPPORT_REQUIRES_GRANT}",
            "Set SUPPORT_REQUIRES_GRANT=True before support users can access merchant data.",
        ),
        _item(
            "database.managed_postgres",
            "Managed PostgreSQL configured",
            not _is_sqlite(),
            f"DATABASE_ENGINE={_database_engine()}",
            "Use managed PostgreSQL with PITR/backups for staging and production.",
        ),
        _item(
            "database.connection_pooling",
            "Database connection reuse configured",
            int(settings.DATABASES["default"].get("CONN_MAX_AGE") or 0) >= 30,
            f"CONN_MAX_AGE={settings.DATABASES['default'].get('CONN_MAX_AGE')}",
            "Keep DB_CONN_MAX_AGE around 60 seconds behind a pooler/proxy.",
            severity="warning",
        ),
        _item(
            "queue.redis",
            "Redis broker configured",
            _configured(settings.CELERY_BROKER_URL) and "redis://" in settings.CELERY_BROKER_URL,
            f"CELERY_BROKER_URL={settings.CELERY_BROKER_URL}",
            "Use managed Redis for Celery broker/result backend.",
        ),
        _item(
            "queue.automation_async",
            "Automation runtime is queue-backed",
            not settings.AUTOMATIONS_RUN_INLINE,
            f"AUTOMATIONS_RUN_INLINE={settings.AUTOMATIONS_RUN_INLINE}",
            "Set AUTOMATIONS_RUN_INLINE=False and run Celery workers in production.",
        ),
        _item(
            "storage.object_storage",
            "Object storage enabled",
            bool(settings.USE_S3),
            f"USE_S3={settings.USE_S3}",
            "Use S3-compatible private object storage for merchant files.",
        ),
        _item(
            "observability.sentry",
            "Sentry configured",
            _configured(settings.SENTRY_DSN),
            f"SENTRY_DSN configured={bool(settings.SENTRY_DSN)}",
            "Configure Sentry or equivalent error monitoring.",
        ),
        _item(
            "email.transactional",
            "Transactional email configured",
            _configured(settings.EMAIL_HOST) and _configured(settings.DEFAULT_FROM_EMAIL),
            f"EMAIL_HOST configured={bool(settings.EMAIL_HOST)}; DEFAULT_FROM_EMAIL={settings.DEFAULT_FROM_EMAIL}",
            "Configure SMTP/transactional email before invitations, resets and alerts.",
            severity="warning",
        ),
        _item(
            "api.rate_limits",
            "API rate limits configured",
            _has_required_rate_limit_scopes(),
            f"THROTTLE_RATES={settings.REST_FRAMEWORK.get('DEFAULT_THROTTLE_RATES')}",
            "Keep auth, public API, public form/widget, integration webhook and AI throttles enabled.",
            severity="warning",
        ),
    ]

    summary = {
        "pass": sum(1 for item in items if item.status == "pass"),
        "warn": sum(1 for item in items if item.status == "warn"),
        "fail": sum(1 for item in items if item.status == "fail"),
    }
    return {
        "environment": settings.ENVIRONMENT,
        "release": settings.RELEASE,
        "summary": summary,
        "items": [asdict(item) for item in items],
    }
