from dataclasses import asdict, dataclass
from email.utils import parseaddr

from django.conf import settings

from apps.core.backup_readiness import run_backup_restore_readiness_check
from apps.core.operations_health import platform_operations_health
from apps.core.production_audit import run_production_readiness_audit
from apps.integrations.provider_rollout import run_provider_rollout_readiness_check


@dataclass(frozen=True)
class PaidBetaGateItem:
    key: str
    title: str
    status: str
    detail: str
    action: str


def _item(key, title, condition, detail, action):
    return PaidBetaGateItem(
        key=key,
        title=title,
        status="pass" if condition else "fail",
        detail=detail,
        action=action,
    )


def _required_bool(name):
    return bool(getattr(settings, name, False))


def _has_transactional_email():
    _, email_address = parseaddr(str(getattr(settings, "DEFAULT_FROM_EMAIL", "") or ""))
    email_domain = email_address.rsplit("@", 1)[-1].lower() if "@" in email_address else ""
    return all(
        [
            bool(str(getattr(settings, "EMAIL_HOST", "")).strip()),
            bool(email_address),
            email_domain not in {"", "localhost", "local", "test.local", "zani.local", "example.com"},
            bool(getattr(settings, "EMAIL_USE_TLS", False)) or bool(getattr(settings, "EMAIL_USE_SSL", False)),
        ]
    )


def _has_sentry_observability():
    from urllib.parse import urlparse

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


def run_paid_beta_gate_check():
    production = run_production_readiness_audit()
    backup = run_backup_restore_readiness_check()
    provider_rollout = run_provider_rollout_readiness_check()
    operations = platform_operations_health()

    production_failures = production["summary"]["fail"]
    backup_blockers = backup["summary"]["paid_beta_blockers"]
    provider_blockers = provider_rollout["summary"]["blocked"]

    items = [
        _item(
            "smoke.staging",
            "Staging smoke is green",
            _required_bool("PAID_BETA_STAGING_SMOKE_GREEN"),
            f"PAID_BETA_STAGING_SMOKE_GREEN={settings.PAID_BETA_STAGING_SMOKE_GREEN}",
            "Run the deployed staging smoke checklist and set PAID_BETA_STAGING_SMOKE_GREEN=True only after it passes.",
        ),
        _item(
            "smoke.browser_e2e",
            "Browser E2E is green",
            _required_bool("PAID_BETA_BROWSER_E2E_GREEN"),
            f"PAID_BETA_BROWSER_E2E_GREEN={settings.PAID_BETA_BROWSER_E2E_GREEN}",
            "Run frontend Playwright E2E against staging and set PAID_BETA_BROWSER_E2E_GREEN=True only after it passes.",
        ),
        _item(
            "readiness.production",
            "Production readiness has no critical failures",
            production_failures == 0,
            f"production_readiness_failures={production_failures}",
            "Run production_readiness_audit --fail-on-critical and fix all critical items.",
        ),
        _item(
            "runtime.redis_celery",
            "TLS Redis/Celery runtime is enabled",
            not settings.AUTOMATIONS_RUN_INLINE
            and str(settings.CELERY_BROKER_URL).startswith("rediss://"),
            f"broker={settings.CELERY_BROKER_URL}; AUTOMATIONS_RUN_INLINE={settings.AUTOMATIONS_RUN_INLINE}",
            "Use managed Redis over TLS and running Celery workers before paid beta.",
        ),
        _item(
            "storage.object_storage",
            "Object storage is enabled",
            bool(settings.USE_S3),
            f"USE_S3={settings.USE_S3}",
            "Use private S3-compatible storage for merchant files before paid beta.",
        ),
        _item(
            "observability.sentry",
            "Sentry observability is enabled",
            _has_sentry_observability(),
            "SENTRY_DSN configured={dsn}; RELEASE={release}; traces_sample_rate={sample_rate}".format(
                dsn=bool(settings.SENTRY_DSN),
                release=settings.RELEASE,
                sample_rate=settings.SENTRY_TRACES_SAMPLE_RATE,
            ),
            "Configure HTTPS Sentry or equivalent monitoring with a deploy release id before paid beta.",
        ),
        _item(
            "email.transactional",
            "Secure transactional email is enabled",
            _has_transactional_email(),
            "EMAIL_HOST configured={host}; DEFAULT_FROM_EMAIL={from_email}; tls={tls}; ssl={ssl}".format(
                host=bool(settings.EMAIL_HOST),
                from_email=settings.DEFAULT_FROM_EMAIL,
                tls=getattr(settings, "EMAIL_USE_TLS", False),
                ssl=getattr(settings, "EMAIL_USE_SSL", False),
            ),
            "Configure transactional SMTP with TLS/SSL, use a verified non-local sender domain and run email_runtime_smoke.",
        ),
        _item(
            "backup.restore_drill",
            "Backup/restore drill is documented and done",
            backup_blockers == 0 and _required_bool("PAID_BETA_BACKUP_RESTORE_DRILL_DONE"),
            f"backup_paid_beta_blockers={backup_blockers}; PAID_BETA_BACKUP_RESTORE_DRILL_DONE={settings.PAID_BETA_BACKUP_RESTORE_DRILL_DONE}",
            "Complete a restore drill and set PAID_BETA_BACKUP_RESTORE_DRILL_DONE=True.",
        ),
        _item(
            "support.grants",
            "Support access grant flow is tested",
            settings.SUPPORT_REQUIRES_GRANT and _required_bool("PAID_BETA_SUPPORT_GRANT_FLOW_TESTED"),
            f"SUPPORT_REQUIRES_GRANT={settings.SUPPORT_REQUIRES_GRANT}; PAID_BETA_SUPPORT_GRANT_FLOW_TESTED={settings.PAID_BETA_SUPPORT_GRANT_FLOW_TESTED}",
            "Test support grant creation/expiry/audit and set PAID_BETA_SUPPORT_GRANT_FLOW_TESTED=True.",
        ),
        _item(
            "support.operations_health",
            "Platform operations health is not critical",
            operations["status"] != "critical",
            f"operations_status={operations['status']}; critical={operations['summary']['critical']}; warning={operations['summary']['warning']}",
            "Open /platform/operations or run platform_operations_health_check and resolve critical runtime/support blockers.",
        ),
        _item(
            "providers.rollback",
            "No real provider is enabled without rollback path",
            provider_blockers == 0,
            f"provider_rollout_blockers={provider_blockers}",
            "Run provider_rollout_readiness_check --fail-on-blockers before enabling any real provider traffic.",
        ),
    ]
    summary = {
        "pass": sum(1 for item in items if item.status == "pass"),
        "fail": sum(1 for item in items if item.status == "fail"),
    }
    return {
        "environment": settings.ENVIRONMENT,
        "release": settings.RELEASE,
        "allowed": summary["fail"] == 0,
        "summary": summary,
        "items": [asdict(item) for item in items],
    }
