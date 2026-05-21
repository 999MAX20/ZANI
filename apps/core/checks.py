from django.conf import settings
from django.core.checks import Warning, register


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

    if settings.SECRET_KEY in {"change-me-in-production", "change-me-use-32-plus-random-characters"} or len(settings.SECRET_KEY) < 32:
        warnings.append(
            Warning(
                "SECRET_KEY is too short or uses a placeholder value.",
                hint="Use a random 32+ byte secret in environment variables.",
                id="zani.W002",
            )
        )

    if not settings.ALLOWED_HOSTS or settings.ALLOWED_HOSTS == ["*"]:
        warnings.append(
            Warning(
                "ALLOWED_HOSTS is not restricted.",
                hint="Set ALLOWED_HOSTS to production API hostnames.",
                id="zani.W003",
            )
        )

    if not settings.CORS_ALLOWED_ORIGINS:
        warnings.append(
            Warning(
                "CORS_ALLOWED_ORIGINS is empty.",
                hint="Set CORS_ALLOWED_ORIGINS to the frontend origin.",
                id="zani.W004",
            )
        )

    if not settings.CSRF_TRUSTED_ORIGINS:
        warnings.append(
            Warning(
                "CSRF_TRUSTED_ORIGINS is empty.",
                hint="Set CSRF_TRUSTED_ORIGINS to the frontend origin.",
                id="zani.W005",
            )
        )

    if not settings.SENTRY_DSN:
        warnings.append(
            Warning(
                "SENTRY_DSN is not configured.",
                hint="Configure error tracking before production traffic.",
                id="zani.W006",
            )
        )

    return warnings
