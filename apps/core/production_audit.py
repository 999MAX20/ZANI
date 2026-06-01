from dataclasses import asdict, dataclass

from django.conf import settings

from apps.core.production_rules import database_engine as _database_engine
from apps.core.production_rules import database_sslmode as _database_sslmode
from apps.core.production_rules import has_https_security as _has_https_security
from apps.core.production_rules import has_placeholder_host as _has_placeholder_host
from apps.core.production_rules import has_private_object_storage as _has_private_object_storage
from apps.core.production_rules import has_required_rate_limit_scopes as _has_required_rate_limit_scopes
from apps.core.production_rules import has_safe_instagram_runtime as _has_safe_instagram_runtime
from apps.core.production_rules import has_safe_https_origins as _has_safe_https_origins
from apps.core.production_rules import has_safe_telegram_runtime as _has_safe_telegram_runtime
from apps.core.production_rules import has_safe_whatsapp_runtime as _has_safe_whatsapp_runtime
from apps.core.production_rules import has_sentry_observability as _has_sentry_observability
from apps.core.production_rules import has_tls_postgres as _has_tls_postgres
from apps.core.production_rules import has_tls_redis_broker as _has_tls_redis_broker
from apps.core.production_rules import has_transactional_email as _has_transactional_email
from apps.core.security_config import has_strong_secret_key, secret_key_strength_detail, shared_secret_strength_detail


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
            has_strong_secret_key(settings.SECRET_KEY),
            secret_key_strength_detail(settings.SECRET_KEY),
            "Use a unique high-entropy 32+ byte random secret from env.",
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
            "Production HTTPS origins configured",
            _has_safe_https_origins(settings.CORS_ALLOWED_ORIGINS) and _has_safe_https_origins(settings.CSRF_TRUSTED_ORIGINS),
            f"CORS={settings.CORS_ALLOWED_ORIGINS}; CSRF={settings.CSRF_TRUSTED_ORIGINS}",
            "Set CORS_ALLOWED_ORIGINS and CSRF_TRUSTED_ORIGINS to public HTTPS app/API origins only; remove localhost, private IP and http origins.",
        ),
        _item(
            "security.https",
            "HTTPS security flags enabled",
            _has_https_security(),
            "SSL_REDIRECT={ssl_redirect}; SESSION_SECURE={session_secure}; CSRF_SECURE={csrf_secure}; HSTS={hsts}; HSTS_SUBDOMAINS={hsts_subdomains}; HSTS_PRELOAD={hsts_preload}; PROXY_SSL_HEADER={proxy_header}".format(
                ssl_redirect=settings.SECURE_SSL_REDIRECT,
                session_secure=settings.SESSION_COOKIE_SECURE,
                csrf_secure=settings.CSRF_COOKIE_SECURE,
                hsts=settings.SECURE_HSTS_SECONDS,
                hsts_subdomains=settings.SECURE_HSTS_INCLUDE_SUBDOMAINS,
                hsts_preload=settings.SECURE_HSTS_PRELOAD,
                proxy_header=settings.SECURE_PROXY_SSL_HEADER,
            ),
            "Enable SSL redirect, secure cookies, production HSTS and SECURE_PROXY_SSL_HEADER behind a trusted proxy.",
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
            "TLS PostgreSQL configured",
            _has_tls_postgres(),
            f"DATABASE_ENGINE={_database_engine()}; sslmode={_database_sslmode() or 'unset'}",
            "Use managed PostgreSQL with PITR/backups and sslmode=require or stronger for staging and production.",
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
            "TLS Redis broker configured",
            _has_tls_redis_broker(),
            f"CELERY_BROKER_URL={settings.CELERY_BROKER_URL}",
            "Use managed Redis over TLS (rediss://) for Celery broker/result backend.",
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
            "Private object storage configured",
            _has_private_object_storage(),
            "USE_S3={use_s3}; bucket_configured={bucket}; signed_urls={signed_urls}; acl={acl}; backend={backend}".format(
                use_s3=settings.USE_S3,
                bucket=bool(getattr(settings, "AWS_STORAGE_BUCKET_NAME", "")),
                signed_urls=getattr(settings, "AWS_QUERYSTRING_AUTH", None),
                acl=getattr(settings, "AWS_DEFAULT_ACL", None),
                backend=getattr(settings, "STORAGES", {}).get("default", {}).get("BACKEND", ""),
            ),
            "Use S3-compatible private object storage with a bucket, django-storages S3 backend and signed private URLs.",
        ),
        _item(
            "observability.sentry",
            "Sentry observability configured",
            _has_sentry_observability(),
            "SENTRY_DSN configured={dsn}; RELEASE={release}; traces_sample_rate={sample_rate}".format(
                dsn=bool(settings.SENTRY_DSN),
                release=settings.RELEASE,
                sample_rate=settings.SENTRY_TRACES_SAMPLE_RATE,
            ),
            "Configure an HTTPS Sentry DSN or equivalent monitor, set a deploy release id, and keep traces sample rate bounded.",
        ),
        _item(
            "email.transactional",
            "Secure transactional email configured",
            _has_transactional_email(),
            "EMAIL_HOST configured={host}; DEFAULT_FROM_EMAIL={from_email}; tls={tls}; ssl={ssl}".format(
                host=bool(settings.EMAIL_HOST),
                from_email=settings.DEFAULT_FROM_EMAIL,
                tls=getattr(settings, "EMAIL_USE_TLS", False),
                ssl=getattr(settings, "EMAIL_USE_SSL", False),
            ),
            "Configure a real SMTP/transactional provider, TLS/SSL transport and a verified non-local sender domain.",
            severity="warning",
        ),
        _item(
            "api.rate_limits",
            "API rate limits configured",
            _has_required_rate_limit_scopes(),
            f"THROTTLE_RATES={settings.REST_FRAMEWORK.get('DEFAULT_THROTTLE_RATES')}",
            "Keep auth, public API, public form/widget, integration webhook and AI throttles enabled and bounded.",
        ),
        _item(
            "integrations.telegram",
            "Telegram production guardrails configured",
            _has_safe_telegram_runtime(),
            "TELEGRAM_ENABLED={enabled}; TELEGRAM_BASE_API_URL={base_url}; {secret_detail}".format(
                enabled=getattr(settings, "TELEGRAM_ENABLED", False),
                base_url=getattr(settings, "TELEGRAM_BASE_API_URL", ""),
                secret_detail=shared_secret_strength_detail(getattr(settings, "TELEGRAM_WEBHOOK_SECRET", ""), "TELEGRAM_WEBHOOK_SECRET"),
            ),
            "Keep Telegram disabled or set a strong webhook secret and public HTTPS Telegram API base URL before real traffic.",
        ),
        _item(
            "integrations.whatsapp",
            "WhatsApp production guardrails configured",
            _has_safe_whatsapp_runtime(),
            "WHATSAPP_ENABLED={enabled}; WHATSAPP_GRAPH_BASE_URL={graph_url}; {verify_detail}; {secret_detail}".format(
                enabled=getattr(settings, "WHATSAPP_ENABLED", False),
                graph_url=getattr(settings, "WHATSAPP_GRAPH_BASE_URL", ""),
                verify_detail=shared_secret_strength_detail(getattr(settings, "WHATSAPP_VERIFY_TOKEN", ""), "WHATSAPP_VERIFY_TOKEN"),
                secret_detail=shared_secret_strength_detail(getattr(settings, "WHATSAPP_APP_SECRET", ""), "WHATSAPP_APP_SECRET"),
            ),
            "Keep WhatsApp disabled or set strong Meta webhook secrets and public HTTPS Graph API URL before real traffic.",
        ),
        _item(
            "integrations.instagram",
            "Instagram production guardrails configured",
            _has_safe_instagram_runtime(),
            "INSTAGRAM_ENABLED={enabled}; INSTAGRAM_GRAPH_BASE_URL={graph_url}; {verify_detail}; {secret_detail}".format(
                enabled=getattr(settings, "INSTAGRAM_ENABLED", False),
                graph_url=getattr(settings, "INSTAGRAM_GRAPH_BASE_URL", ""),
                verify_detail=shared_secret_strength_detail(getattr(settings, "INSTAGRAM_VERIFY_TOKEN", ""), "INSTAGRAM_VERIFY_TOKEN"),
                secret_detail=shared_secret_strength_detail(
                    getattr(settings, "INSTAGRAM_APP_SECRET", "") or getattr(settings, "META_APP_SECRET", ""),
                    "INSTAGRAM_APP_SECRET/META_APP_SECRET",
                ),
            ),
            "Keep Instagram disabled or set strong Meta webhook secrets and public HTTPS Graph API URL before real traffic.",
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
