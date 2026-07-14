from django.conf import settings
from django.utils import timezone

from apps.automations.models import AutomationRun
from apps.core.backup_readiness import run_backup_restore_readiness_check
from apps.core.models import SupportAccessGrant
from apps.core.production_audit import run_production_readiness_audit
from apps.integrations.models import BusinessConnector, ConnectorSyncRun, IntegrationEventLog, WebhookDeliveryLog
from apps.integrations.provider_rollout import run_provider_rollout_readiness_check
from apps.integrations.sanitization import sanitize_error_text


def _status_from_failures(critical_count, warning_count=0):
    if critical_count:
        return "critical"
    if warning_count:
        return "warning"
    return "healthy"


def _setting_enabled(value):
    return bool(value)


def _latest_automation_failures(limit=8):
    return [
        {
            "id": run.id,
            "business_id": run.business_id,
            "business_name": run.business.name,
            "trigger_type": run.trigger_type,
            "entity_type": run.entity_type,
            "entity_id": run.entity_id,
            "status": run.status,
            "attempts": run.attempts,
            "max_attempts": run.max_attempts,
            "error": sanitize_error_text(run.error),
            "created_at": run.created_at,
        }
        for run in AutomationRun.objects.filter(status=AutomationRun.Statuses.FAILED).select_related("business")[:limit]
    ]


def _latest_integration_failures(limit=8):
    return [
        {
            "id": log.id,
            "business_id": log.business_id,
            "business_name": log.business.name if log.business else "",
            "provider": log.provider,
            "channel": log.channel,
            "direction": log.direction,
            "status": log.status,
            "error": sanitize_error_text(log.error),
            "created_at": log.created_at,
        }
        for log in IntegrationEventLog.objects.filter(status=IntegrationEventLog.Statuses.FAILED).select_related("business")[:limit]
    ]


def _latest_failed_webhooks(limit=8):
    return [
        {
            "id": delivery.id,
            "business_id": delivery.business_id,
            "business_name": delivery.business.name,
            "endpoint_name": delivery.endpoint.name,
            "event_type": delivery.event_type,
            "status": delivery.status,
            "attempts": delivery.attempts,
            "error": sanitize_error_text(delivery.error),
            "created_at": delivery.created_at,
        }
        for delivery in WebhookDeliveryLog.objects.filter(status=WebhookDeliveryLog.Statuses.FAILED).select_related("business", "endpoint")[:limit]
    ]


def _connector_queue(limit=10):
    queryset = (
        BusinessConnector.objects.filter(
            status__in=[
                BusinessConnector.Statuses.NEEDS_ATTENTION,
                BusinessConnector.Statuses.FAILED,
                BusinessConnector.Statuses.EXPIRED_CREDENTIALS,
            ]
        )
        .select_related("business", "created_by")
        .order_by("status", "-updated_at")
    )
    return [
        {
            "id": connector.id,
            "business_id": connector.business_id,
            "business_name": connector.business.name,
            "provider": connector.provider,
            "name": connector.name,
            "status": connector.status,
            "last_error": sanitize_error_text(connector.last_error),
            "updated_at": connector.updated_at,
            "created_by_email": connector.created_by.email if connector.created_by else None,
        }
        for connector in queryset[:limit]
    ]


def _queue_summary():
    broker_url = getattr(settings, "CELERY_BROKER_URL", "")
    routes = getattr(settings, "CELERY_TASK_ROUTES", {})
    queues = sorted({route.get("queue") for route in routes.values() if route.get("queue")})
    failed_runs = AutomationRun.objects.filter(status=AutomationRun.Statuses.FAILED).count()
    pending_runs = AutomationRun.objects.filter(status=AutomationRun.Statuses.PENDING).count()
    running_runs = AutomationRun.objects.filter(status=AutomationRun.Statuses.RUNNING).count()
    failed_syncs = ConnectorSyncRun.objects.filter(status=ConnectorSyncRun.Statuses.FAILED).count()
    failed_webhooks = WebhookDeliveryLog.objects.filter(status=WebhookDeliveryLog.Statuses.FAILED).count()
    return {
        "broker_configured": broker_url.startswith("redis://") or broker_url.startswith("rediss://"),
        "automation_inline": getattr(settings, "AUTOMATIONS_RUN_INLINE", True),
        "default_queue": getattr(settings, "CELERY_TASK_DEFAULT_QUEUE", "default"),
        "queues": queues,
        "automation_runs": {
            "pending": pending_runs,
            "running": running_runs,
            "failed": failed_runs,
        },
        "failed_connector_syncs": failed_syncs,
        "failed_webhook_deliveries": failed_webhooks,
        "status": _status_from_failures(failed_runs + failed_syncs + failed_webhooks),
    }


def platform_operations_health():
    production = run_production_readiness_audit()
    backup = run_backup_restore_readiness_check()
    providers = run_provider_rollout_readiness_check()
    queue = _queue_summary()
    active_support_grants = SupportAccessGrant.objects.filter(is_active=True, expires_at__gt=timezone.now()).count()
    connector_queue = _connector_queue()

    critical_count = (
        production["summary"]["fail"]
        + backup["summary"]["paid_beta_blockers"]
        + providers["summary"]["blocked"]
        + (1 if queue["status"] == "critical" else 0)
    )
    warning_count = production["summary"]["warn"] + providers["summary"]["warning"]

    return {
        "environment": getattr(settings, "ENVIRONMENT", "unknown"),
        "release": getattr(settings, "RELEASE", "unknown"),
        "generated_at": timezone.now(),
        "status": _status_from_failures(critical_count, warning_count),
        "summary": {
            "critical": critical_count,
            "warning": warning_count,
            "active_support_grants": active_support_grants,
            "connector_requests": len(connector_queue),
        },
        "runtime": {
            "queue": queue,
            "production_readiness": {
                "summary": production["summary"],
                "failed_items": [item for item in production["items"] if item["status"] == "fail"][:8],
                "warning_items": [item for item in production["items"] if item["status"] == "warn"][:8],
            },
            "backup_readiness": {
                "summary": backup["summary"],
                "failed_items": [item for item in backup["items"] if item["status"] == "fail"][:8],
            },
            "provider_rollout": providers,
        },
        "work_queue": {
            "connector_requests": connector_queue,
            "failed_automation_runs": _latest_automation_failures(),
            "failed_integration_events": _latest_integration_failures(),
            "failed_webhook_deliveries": _latest_failed_webhooks(),
        },
    }
