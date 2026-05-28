from django.conf import settings
from django.core.checks import Warning, register

from apps.core.production_rules import has_https_security as _has_https_security
from apps.core.production_rules import has_placeholder_host as _has_placeholder_host
from apps.core.production_rules import has_private_object_storage as _has_private_object_storage
from apps.core.production_rules import has_safe_https_origins as _has_safe_https_origins
from apps.core.production_rules import has_sentry_observability as _has_sentry_observability
from apps.core.production_rules import has_tls_postgres as _has_tls_postgres
from apps.core.production_rules import has_tls_redis_broker as _has_tls_redis_broker
from apps.core.production_rules import has_transactional_email as _has_transactional_email
from apps.core.production_rules import unsafe_rate_limits as _unsafe_rate_limits
from apps.core.security_config import has_strong_secret_key


@register()
def production_settings_check(app_configs, **kwargs):
    if settings.ENVIRONMENT not in {"production", "staging"}:
        return []

    warnings = []

    if settings.DEBUG:
        warnings.append(
            Warning(
                "DEBUG is enabled outside local development.",
                hint="Set DEBUG=False for staging and production.",
                id="zani.W001",
            )
        )

    if not has_strong_secret_key(settings.SECRET_KEY):
        warnings.append(
            Warning(
                "SECRET_KEY is too weak or uses a placeholder value.",
                hint="Use a unique high-entropy 32+ byte random secret in environment variables.",
                id="zani.W002",
            )
        )

    if not settings.ALLOWED_HOSTS or _has_placeholder_host(settings.ALLOWED_HOSTS):
        warnings.append(
            Warning(
                "ALLOWED_HOSTS is not restricted.",
                hint="Set ALLOWED_HOSTS to public staging/production API hostnames only.",
                id="zani.W003",
            )
        )

    if not _has_safe_https_origins(settings.CORS_ALLOWED_ORIGINS):
        warnings.append(
            Warning(
                "CORS_ALLOWED_ORIGINS is not production safe.",
                hint="Set CORS_ALLOWED_ORIGINS to public HTTPS frontend origins only; remove localhost, private IP and http origins.",
                id="zani.W004",
            )
        )

    if not _has_safe_https_origins(settings.CSRF_TRUSTED_ORIGINS):
        warnings.append(
            Warning(
                "CSRF_TRUSTED_ORIGINS is not production safe.",
                hint="Set CSRF_TRUSTED_ORIGINS to public HTTPS frontend/API origins only; remove localhost, private IP and http origins.",
                id="zani.W005",
            )
        )

    if not _has_sentry_observability():
        warnings.append(
            Warning(
                "Sentry observability is not production safe.",
                hint="Configure an HTTPS Sentry DSN or equivalent monitor, set a deploy release id, and keep traces sample rate bounded.",
                id="zani.W006",
            )
        )

    if not _has_https_security():
        warnings.append(
            Warning(
                "HTTPS security flags are not fully enabled.",
                hint="Enable SSL redirect, secure cookies, production HSTS and SECURE_PROXY_SSL_HEADER behind a trusted proxy.",
                id="zani.W007",
            )
        )

    if not settings.SUPPORT_REQUIRES_GRANT:
        warnings.append(
            Warning(
                "Support access does not require explicit grants.",
                hint="Set SUPPORT_REQUIRES_GRANT=True before support users can access merchant data.",
                id="zani.W008",
            )
        )

    if not _has_tls_postgres():
        warnings.append(
            Warning(
                "TLS PostgreSQL is not configured outside local development.",
                hint="Use managed PostgreSQL with backups/PITR and sslmode=require or stronger for staging and production.",
                id="zani.W009",
            )
        )

    if not _has_tls_redis_broker():
        warnings.append(
            Warning(
                "Celery is not configured with a TLS Redis broker.",
                hint="Use managed Redis over TLS (rediss://) and run Celery workers for staging and production.",
                id="zani.W010",
            )
        )

    if settings.AUTOMATIONS_RUN_INLINE:
        warnings.append(
            Warning(
                "Automations run inline instead of through the queue.",
                hint="Set AUTOMATIONS_RUN_INLINE=False and run Celery workers in production.",
                id="zani.W011",
            )
        )

    if not _has_private_object_storage():
        warnings.append(
            Warning(
                "Private object storage is not fully configured.",
                hint="Use S3-compatible private object storage with a bucket, django-storages S3 backend and signed private URLs.",
                id="zani.W012",
            )
        )

    unsafe_rates = _unsafe_rate_limits(settings.REST_FRAMEWORK.get("DEFAULT_THROTTLE_RATES", {}))
    if unsafe_rates:
        warnings.append(
            Warning(
                "API rate limits are too permissive for production.",
                hint=f"Lower these throttle scopes before production traffic: {', '.join(unsafe_rates)}.",
                id="zani.W013",
            )
        )

    if not _has_transactional_email():
        warnings.append(
            Warning(
                "Secure transactional email is not fully configured.",
                hint="Configure a real SMTP/transactional provider, TLS/SSL transport and a verified non-local sender domain.",
                id="zani.W014",
            )
        )

    return warnings
