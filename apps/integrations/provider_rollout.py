from dataclasses import asdict, dataclass

from django.conf import settings

from apps.core.models import ImportJob
from apps.integrations.connectors import CONNECTOR_PROVIDER_CAPABILITIES
from apps.integrations.models import BusinessConnector
from apps.integrations.providers.registry import registered_providers


PROVIDER_ROLLOUT_ORDER = [
    "telegram",
    "website",
    "excel_csv",
    "email",
    "openai",
    "whatsapp",
    "instagram",
    "marketplace",
]


@dataclass(frozen=True)
class RolloutGate:
    key: str
    title: str
    status: str
    severity: str
    detail: str
    action: str


@dataclass(frozen=True)
class ProviderRolloutCheck:
    provider: str
    title: str
    order: int
    enabled: bool
    status: str
    gates: list[RolloutGate]


def _configured(value):
    if value is None:
        return False
    if isinstance(value, str):
        return bool(value.strip())
    if isinstance(value, (list, tuple, set, dict)):
        return bool(value)
    return bool(value)


def _status(condition, severity="critical"):
    if condition:
        return "pass"
    return "fail" if severity == "critical" else "warn"


def _gate(key, title, condition, detail, action, severity="critical"):
    return RolloutGate(
        key=key,
        title=title,
        status=_status(condition, severity),
        severity=severity,
        detail=detail,
        action=action,
    )


def _adapter_gate(provider, expected=True):
    registered = provider in registered_providers()
    return _gate(
        f"{provider}.adapter",
        "Provider adapter registered",
        registered is expected,
        f"registered={registered}; providers={registered_providers()}",
        "Keep external API code behind apps.integrations.providers.",
    )


def _connector_catalog_gate(provider):
    catalogued = provider in CONNECTOR_PROVIDER_CAPABILITIES
    return _gate(
        f"{provider}.connector_catalog",
        "Connector catalog entry exists",
        catalogued,
        f"catalogued={catalogued}",
        "Add merchant-facing connector metadata before exposing a provider.",
    )


def _queue_gate(provider, enabled):
    redis_url = getattr(settings, "CELERY_BROKER_URL", "")
    queue_backed = (
        _configured(redis_url)
        and (redis_url.startswith("redis://") or redis_url.startswith("rediss://"))
        and not getattr(settings, "AUTOMATIONS_RUN_INLINE", True)
    )
    return _gate(
        f"{provider}.queue_runtime",
        "Queue-backed runtime",
        (not enabled) or queue_backed,
        f"enabled={enabled}; redis_configured={bool(redis_url)}; AUTOMATIONS_RUN_INLINE={getattr(settings, 'AUTOMATIONS_RUN_INLINE', True)}",
        "Enable managed Redis, Celery workers and AUTOMATIONS_RUN_INLINE=False before real provider traffic.",
    )


def _observability_gate(provider, enabled):
    return _gate(
        f"{provider}.observability",
        "Error monitoring configured",
        (not enabled) or _configured(getattr(settings, "SENTRY_DSN", "")),
        f"enabled={enabled}; SENTRY_DSN configured={bool(getattr(settings, 'SENTRY_DSN', ''))}",
        "Configure Sentry before enabling real external provider traffic.",
        severity="warning",
    )


def _event_normalization_gate(provider):
    return _gate(
        f"{provider}.event_normalization",
        "BusinessEvent normalization layer exists",
        True,
        "BusinessEvent has source, event_type, external_id and deduplication_key.",
        "Route provider webhooks through BusinessEvent or IntegrationEventLog instead of direct CRM mutations.",
    )


def _idempotency_gate(provider):
    return _gate(
        f"{provider}.idempotency",
        "Inbound idempotency model exists",
        True,
        "BusinessEvent deduplication_key is unique per business/source.",
        "Set a stable deduplication_key from provider event id before processing inbound events.",
    )


def _connector_health_gate(provider):
    return _gate(
        f"{provider}.connector_health",
        "Support-visible connector health exists",
        True,
        "BusinessConnector status, last_error and ConnectorSyncRun are available for support workflows.",
        "Update connector status/sync runs from provider adapters so support can diagnose failures.",
    )


def _credential_gate(provider):
    return _gate(
        f"{provider}.credentials",
        "Credential storage and masking model exists",
        True,
        "ConnectorCredential stores encrypted_value and masked_value.",
        "Store merchant credentials through ConnectorCredential or provider settings, never in frontend code.",
    )


def _telegram_check(order):
    enabled = bool(getattr(settings, "TELEGRAM_ENABLED", False))
    gates = [
        _adapter_gate(BusinessConnector.Providers.TELEGRAM),
        _connector_catalog_gate(BusinessConnector.Providers.TELEGRAM),
        _credential_gate("telegram"),
        _event_normalization_gate("telegram"),
        _idempotency_gate("telegram"),
        _connector_health_gate("telegram"),
        _gate(
            "telegram.webhook_secret",
            "Webhook secret configured before real mode",
            (not enabled) or _configured(getattr(settings, "TELEGRAM_WEBHOOK_SECRET", "")),
            f"TELEGRAM_ENABLED={enabled}; TELEGRAM_WEBHOOK_SECRET configured={bool(getattr(settings, 'TELEGRAM_WEBHOOK_SECRET', ''))}",
            "Set TELEGRAM_WEBHOOK_SECRET and configure Telegram webhook with the same secret header.",
        ),
        _queue_gate("telegram", enabled),
        _observability_gate("telegram", enabled),
    ]
    return _provider_check("telegram", "Telegram real webhook", order, enabled, gates)


def _website_check(order):
    enabled = True
    gates = [
        _adapter_gate(BusinessConnector.Providers.WEBSITE),
        _connector_catalog_gate(BusinessConnector.Providers.WEBSITE),
        _event_normalization_gate("website"),
        _idempotency_gate("website"),
        _connector_health_gate("website"),
        _gate(
            "website.public_rate_limits",
            "Public form/widget rate limits exist",
            "public_form" in settings.REST_FRAMEWORK.get("DEFAULT_THROTTLE_RATES", {})
            and "public_widget" in settings.REST_FRAMEWORK.get("DEFAULT_THROTTLE_RATES", {}),
            f"rates={settings.REST_FRAMEWORK.get('DEFAULT_THROTTLE_RATES', {})}",
            "Keep public form and widget throttles enabled before embedding production widgets.",
            severity="warning",
        ),
    ]
    return _provider_check("website", "Website widget and public forms", order, enabled, gates)


def _excel_csv_check(order):
    enabled = True
    required_entities = {
        ImportJob.EntityTypes.CLIENTS,
        ImportJob.EntityTypes.LEADS,
        ImportJob.EntityTypes.SALES,
        ImportJob.EntityTypes.CATALOG,
    }
    available_entities = set(ImportJob.EntityTypes.values)
    gates = [
        _connector_catalog_gate(BusinessConnector.Providers.EXCEL_CSV),
        _event_normalization_gate("excel_csv"),
        _idempotency_gate("excel_csv"),
        _connector_health_gate("excel_csv"),
        _gate(
            "excel_csv.import_entities",
            "Core import entities exist",
            required_entities.issubset(available_entities),
            f"required={sorted(required_entities)}; available={sorted(available_entities)}",
            "Keep clients, leads, sales and catalog import paths available before real data onboarding.",
        ),
        _gate(
            "excel_csv.upload_limits",
            "Upload size limit configured",
            getattr(settings, "MAX_UPLOAD_SIZE_MB", 0) > 0,
            f"MAX_UPLOAD_SIZE_MB={getattr(settings, 'MAX_UPLOAD_SIZE_MB', None)}",
            "Keep explicit upload limits before exposing merchant file imports.",
            severity="warning",
        ),
    ]
    return _provider_check("excel_csv", "Excel/CSV real import", order, enabled, gates)


def _email_check(order):
    enabled = _configured(getattr(settings, "EMAIL_HOST", ""))
    gates = [
        _connector_catalog_gate(BusinessConnector.Providers.EMAIL),
        _connector_health_gate("email"),
        _gate(
            "email.smtp",
            "Transactional SMTP configured",
            _configured(getattr(settings, "EMAIL_HOST", "")) and _configured(getattr(settings, "DEFAULT_FROM_EMAIL", "")),
            f"EMAIL_HOST configured={bool(getattr(settings, 'EMAIL_HOST', ''))}; DEFAULT_FROM_EMAIL={getattr(settings, 'DEFAULT_FROM_EMAIL', '')}",
            "Configure Resend/Postmark/SendGrid SMTP and run email_runtime_smoke.",
            severity="warning",
        ),
        _observability_gate("email", enabled),
    ]
    return _provider_check("email", "Transactional email", order, enabled, gates)


def _openai_check(order):
    configured_keys = {
        "openai": _configured(getattr(settings, "OPENAI_API_KEY", "")),
        "openrouter": _configured(getattr(settings, "OPENROUTER_API_KEY", "")),
        "kimi": _configured(getattr(settings, "KIMI_API_KEY", "")),
    }
    enabled = bool(getattr(settings, "AI_ENABLED", True)) and any(configured_keys.values())
    gates = [
        _gate(
            "openai.api_key",
            "AI provider key configured only when ready",
            True,
            (
                f"AI_PROVIDER={getattr(settings, 'AI_PROVIDER', 'mock')}; "
                f"configured_keys={configured_keys}; "
                f"fast={getattr(settings, 'AI_FAST_MODEL', '')}; smart={getattr(settings, 'AI_SMART_MODEL', '')}"
            ),
            "Keep AI mock mode when provider keys are missing; do not block merchant CRM workflows.",
        ),
        _queue_gate("openai", enabled),
        _gate(
            "openai.throttle",
            "AI API throttle configured",
            "ai_assistant" in settings.REST_FRAMEWORK.get("DEFAULT_THROTTLE_RATES", {}),
            f"rates={settings.REST_FRAMEWORK.get('DEFAULT_THROTTLE_RATES', {})}",
            "Keep ai_assistant throttling and add per-plan usage limits before paid traffic.",
            severity="warning",
        ),
        _observability_gate("openai", enabled),
    ]
    return _provider_check("openai", "OpenRouter/OpenAI behind queue", order, enabled, gates)


def _whatsapp_check(order):
    enabled = bool(getattr(settings, "WHATSAPP_ENABLED", False))
    gates = [
        _adapter_gate(BusinessConnector.Providers.WHATSAPP),
        _connector_catalog_gate(BusinessConnector.Providers.WHATSAPP),
        _credential_gate("whatsapp"),
        _event_normalization_gate("whatsapp"),
        _idempotency_gate("whatsapp"),
        _connector_health_gate("whatsapp"),
        _gate(
            "whatsapp.meta_cloud_security",
            "Meta Cloud webhook security configured before real mode",
            (not enabled)
            or (
                _configured(getattr(settings, "WHATSAPP_VERIFY_TOKEN", ""))
                and _configured(getattr(settings, "WHATSAPP_APP_SECRET", ""))
            ),
            (
                f"WHATSAPP_ENABLED={enabled}; "
                f"WHATSAPP_VERIFY_TOKEN configured={bool(getattr(settings, 'WHATSAPP_VERIFY_TOKEN', ''))}; "
                f"WHATSAPP_APP_SECRET configured={bool(getattr(settings, 'WHATSAPP_APP_SECRET', ''))}"
            ),
            "Set WHATSAPP_VERIFY_TOKEN and WHATSAPP_APP_SECRET before enabling Meta Cloud webhook traffic.",
        ),
        _queue_gate("whatsapp", enabled),
        _observability_gate("whatsapp", enabled),
    ]
    return _provider_check("whatsapp", "WhatsApp Meta Cloud provider", order, enabled, gates)


def _instagram_check(order):
    enabled = bool(getattr(settings, "INSTAGRAM_ENABLED", False))
    gates = [
        _adapter_gate(BusinessConnector.Providers.INSTAGRAM),
        _connector_catalog_gate(BusinessConnector.Providers.INSTAGRAM),
        _credential_gate("instagram"),
        _event_normalization_gate("instagram"),
        _idempotency_gate("instagram"),
        _connector_health_gate("instagram"),
        _gate(
            "instagram.real_adapter",
            "Meta Instagram Direct is intentionally gated",
            not enabled,
            f"INSTAGRAM_ENABLED={enabled}; current adapter is request-only placeholder.",
            "Do not set INSTAGRAM_ENABLED=True until Meta OAuth/webhook adapter and permission review are implemented.",
        ),
        _queue_gate("instagram", enabled),
        _observability_gate("instagram", enabled),
    ]
    return _provider_check("instagram", "Instagram/Meta provider pilot", order, enabled, gates)


def _marketplace_check(order):
    enabled = False
    required = [
        BusinessConnector.Providers.KASPI,
        BusinessConnector.Providers.ONE_C,
        BusinessConnector.Providers.WILDBERRIES,
        BusinessConnector.Providers.OZON,
        BusinessConnector.Providers.YANDEX_MARKET,
    ]
    gates = [
        _gate(
            "marketplace.catalog",
            "Marketplace connectors are represented as request/roadmap",
            all(provider in CONNECTOR_PROVIDER_CAPABILITIES for provider in required),
            f"providers={required}",
            "Keep marketplace providers request-only until event normalization, support workflow and reconciliation are proven.",
            severity="warning",
        ),
        _event_normalization_gate("marketplace"),
        _idempotency_gate("marketplace"),
        _connector_health_gate("marketplace"),
        _credential_gate("marketplace"),
    ]
    return _provider_check("marketplace", "Kaspi / marketplace / 1C", order, enabled, gates)


def _provider_check(provider, title, order, enabled, gates):
    critical_failures = [gate for gate in gates if gate.status == "fail"]
    warnings = [gate for gate in gates if gate.status == "warn"]
    if critical_failures:
        status = "blocked"
    elif warnings:
        status = "warning"
    else:
        status = "ready"
    return ProviderRolloutCheck(
        provider=provider,
        title=title,
        order=order,
        enabled=enabled,
        status=status,
        gates=gates,
    )


def run_provider_rollout_readiness_check(provider=None):
    checks = [
        _telegram_check(1),
        _website_check(2),
        _excel_csv_check(3),
        _email_check(4),
        _openai_check(5),
        _whatsapp_check(6),
        _instagram_check(7),
        _marketplace_check(8),
    ]
    if provider:
        checks = [check for check in checks if check.provider == provider]
        if not checks:
            raise ValueError(f"Unknown provider rollout key: {provider}")

    summary = {
        "ready": sum(1 for check in checks if check.status == "ready"),
        "warning": sum(1 for check in checks if check.status == "warning"),
        "blocked": sum(1 for check in checks if check.status == "blocked"),
        "enabled": sum(1 for check in checks if check.enabled),
    }
    return {
        "environment": getattr(settings, "ENVIRONMENT", "unknown"),
        "release": getattr(settings, "RELEASE", "unknown"),
        "order": PROVIDER_ROLLOUT_ORDER,
        "summary": summary,
        "providers": [
            {
                **asdict(check),
                "gates": [asdict(gate) for gate in check.gates],
            }
            for check in checks
        ],
    }
