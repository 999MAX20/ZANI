from django.conf import settings
from django.utils import timezone

from apps.automations.models import AutomationRun
from apps.ai_core.models import AIJob
from apps.bots.outbound_delivery import outbound_delivery_health
from apps.businesses.routing import routing_health
from apps.core.backup_readiness import run_backup_restore_readiness_check
from apps.core.models import ExportJob, SupportAccessGrant
from apps.core.production_audit import run_production_readiness_audit
from apps.integrations.models import BusinessConnector, ConnectorSyncRun, IntegrationEventLog, WebhookDeliveryLog
from apps.integrations.provider_rollout import run_provider_rollout_readiness_check
from apps.integrations.sanitization import sanitize_error_text
from apps.notifications.models import Notification


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
    retry_runs = AutomationRun.objects.filter(status=AutomationRun.Statuses.RETRY_SCHEDULED).count()
    failed_notifications = Notification.objects.filter(status=Notification.Statuses.FAILED).count()
    retry_notifications = Notification.objects.filter(status=Notification.Statuses.RETRY_SCHEDULED).count()
    due_notifications = Notification.objects.filter(
        status=Notification.Statuses.PENDING,
        send_at__lte=timezone.now(),
    ).count()
    failed_ai_jobs = AIJob.objects.filter(status=AIJob.Statuses.FAILED).count()
    retry_ai_jobs = AIJob.objects.filter(status=AIJob.Statuses.RETRY_SCHEDULED).count()
    pending_export_jobs = ExportJob.objects.filter(status=ExportJob.Statuses.PENDING).count()
    running_export_jobs = ExportJob.objects.filter(status=ExportJob.Statuses.RUNNING).count()
    failed_export_jobs = ExportJob.objects.filter(status=ExportJob.Statuses.FAILED).count()
    stale_export_jobs = ExportJob.objects.filter(
        status=ExportJob.Statuses.RUNNING,
        started_at__lt=timezone.now() - timezone.timedelta(seconds=getattr(settings, "EXPORT_STALE_SECONDS", 900)),
    ).count()
    failed_syncs = ConnectorSyncRun.objects.filter(status=ConnectorSyncRun.Statuses.FAILED).count()
    failed_webhooks = WebhookDeliveryLog.objects.filter(status=WebhookDeliveryLog.Statuses.FAILED).count()
    outbound_messages = outbound_delivery_health()
    routing = routing_health()
    outbound_critical = outbound_messages["failed"] + outbound_messages["stale_delivering"]
    outbound_warning = (
        outbound_messages["queued"]
        + outbound_messages["retry_scheduled"]
        + outbound_messages["due_retry"]
    )
    return {
        "broker_configured": broker_url.startswith("redis://") or broker_url.startswith("rediss://"),
        "automation_inline": getattr(settings, "AUTOMATIONS_RUN_INLINE", True),
        "default_queue": getattr(settings, "CELERY_TASK_DEFAULT_QUEUE", "default"),
        "queues": queues,
        "automation_runs": {
            "pending": pending_runs,
            "running": running_runs,
            "failed": failed_runs,
            "retry_scheduled": retry_runs,
        },
        "notifications": {
            "due": due_notifications,
            "retry_scheduled": retry_notifications,
            "failed": failed_notifications,
        },
        "ai_jobs": {"retry_scheduled": retry_ai_jobs, "failed": failed_ai_jobs},
        "export_jobs": {
            "pending": pending_export_jobs,
            "running": running_export_jobs,
            "stale": stale_export_jobs,
            "failed": failed_export_jobs,
        },
        "failed_connector_syncs": failed_syncs,
        "failed_webhook_deliveries": failed_webhooks,
        "outbound_messages": outbound_messages,
        "routing": routing,
        "status": _status_from_failures(
            failed_runs
            + failed_notifications
            + failed_ai_jobs
            + failed_export_jobs
            + stale_export_jobs
            + failed_syncs
            + failed_webhooks
            + outbound_critical,
            retry_runs
            + retry_notifications
            + retry_ai_jobs
            + pending_export_jobs
            + due_notifications
            + outbound_warning,
        ),
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
