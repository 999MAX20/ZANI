from dataclasses import asdict, dataclass

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
            "Redis/Celery runtime is enabled",
            not settings.AUTOMATIONS_RUN_INLINE
            and str(settings.CELERY_BROKER_URL).startswith(("redis://", "rediss://")),
            f"broker={settings.CELERY_BROKER_URL}; AUTOMATIONS_RUN_INLINE={settings.AUTOMATIONS_RUN_INLINE}",
            "Use managed Redis and running Celery workers before paid beta.",
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
            "Sentry is enabled",
            bool(settings.SENTRY_DSN),
            f"SENTRY_DSN configured={bool(settings.SENTRY_DSN)}",
            "Configure Sentry or equivalent error monitoring before paid beta.",
        ),
        _item(
            "email.transactional",
            "Transactional email is enabled",
            bool(settings.EMAIL_HOST) and bool(settings.DEFAULT_FROM_EMAIL),
            f"EMAIL_HOST configured={bool(settings.EMAIL_HOST)}; DEFAULT_FROM_EMAIL={settings.DEFAULT_FROM_EMAIL}",
            "Configure transactional SMTP and run email_runtime_smoke.",
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
