from django.conf import settings
from django.db import DatabaseError
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
    limit = _bounded_limit(limit)
    return [
        {
            "id": run.id,
            "business_id": run.business_id,
            "trigger_type": run.trigger_type,
            "entity_type": run.entity_type,
            "entity_id": run.entity_id,
            "status": run.status,
            "attempts": run.attempts,
            "max_attempts": run.max_attempts,
            "created_at": run.created_at,
        }
        for run in AutomationRun.objects.filter(status=AutomationRun.Statuses.FAILED)[:limit]
    ]


def _latest_integration_failures(limit=8):
    limit = _bounded_limit(limit)
    return [
        {
            "id": log.id,
            "business_id": log.business_id,
            "provider": log.provider,
            "channel": log.channel,
            "direction": log.direction,
            "status": log.status,
            "created_at": log.created_at,
        }
        for log in IntegrationEventLog.objects.filter(status=IntegrationEventLog.Statuses.FAILED)[:limit]
    ]


def _latest_failed_webhooks(limit=8):
    limit = _bounded_limit(limit)
    return [
        {
            "id": delivery.id,
            "business_id": delivery.business_id,
            "endpoint_id": delivery.endpoint_id,
            "event_type": delivery.event_type,
            "status": delivery.status,
            "attempts": delivery.attempts,
            "created_at": delivery.created_at,
        }
        for delivery in WebhookDeliveryLog.objects.filter(status=WebhookDeliveryLog.Statuses.FAILED)[:limit]
    ]


def _connector_queue(limit=10):
    limit = _bounded_limit(limit)
    queryset = (
        BusinessConnector.objects.filter(
            status__in=[
                BusinessConnector.Statuses.NEEDS_ATTENTION,
                BusinessConnector.Statuses.FAILED,
                BusinessConnector.Statuses.EXPIRED_CREDENTIALS,
            ]
        )
        .order_by("status", "-updated_at")
    )
    return [
        {
            "id": connector.id,
            "business_id": connector.business_id,
            "provider": connector.provider,
            "status": connector.status,
            "updated_at": connector.updated_at,
        }
        for connector in queryset[:limit]
    ]


def _bounded_limit(limit):
    return max(0, min(int(limit), 20))


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
    routing_critical = 1 if routing["status"] == "critical" else 0
    routing_warning = 1 if routing["status"] == "warning" else 0
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
            + outbound_critical
            + routing_critical,
            retry_runs
            + retry_notifications
            + retry_ai_jobs
            + pending_export_jobs
            + due_notifications
            + outbound_warning
            + routing_warning,
        ),
    }


def _database_status(*, available, error=None):
    if available:
        return {
            "available": True,
            "code": "ok",
            "detail": "Database queries completed.",
        }
    return {
        "available": False,
        "code": "database_unavailable",
        "detail": "Database is unavailable or its schema is not ready.",
        "error_type": error.__class__.__name__ if error is not None else "DatabaseError",
    }


def _unavailable_queue_summary():
    broker_url = getattr(settings, "CELERY_BROKER_URL", "")
    routes = getattr(settings, "CELERY_TASK_ROUTES", {})
    queues = sorted({route.get("queue") for route in routes.values() if route.get("queue")})
    return {
        "broker_configured": broker_url.startswith("redis://") or broker_url.startswith("rediss://"),
        "automation_inline": getattr(settings, "AUTOMATIONS_RUN_INLINE", True),
        "default_queue": getattr(settings, "CELERY_TASK_DEFAULT_QUEUE", "default"),
        "queues": queues,
        "automation_runs": {"pending": 0, "running": 0, "failed": 0, "retry_scheduled": 0},
        "notifications": {"due": 0, "retry_scheduled": 0, "failed": 0},
        "ai_jobs": {"retry_scheduled": 0, "failed": 0},
        "export_jobs": {"pending": 0, "running": 0, "stale": 0, "failed": 0},
        "failed_connector_syncs": 0,
        "failed_webhook_deliveries": 0,
        "outbound_messages": {
            "available": False,
            "queued": 0,
            "retry_scheduled": 0,
            "due_retry": 0,
            "delivering": 0,
            "stale_delivering": 0,
            "failed": 0,
            "oldest_pending_age_seconds": 0,
            "oldest_due_retry_age_seconds": 0,
        },
        "routing": {
            "available": False,
            "active_policies": 0,
            "automatic_policies": 0,
            "unassigned": {},
            "automatic_unassigned": {},
            "active_sla_attention": 0,
            "stale_sla_attention": 0,
            "oldest_active_sla_age_seconds": 0,
            "status": "critical",
        },
        "status": "critical",
    }


def platform_operations_health():
    production = run_production_readiness_audit()
    backup = run_backup_restore_readiness_check()
    providers = run_provider_rollout_readiness_check()
    try:
        queue = _queue_summary()
        active_support_grants = SupportAccessGrant.objects.filter(is_active=True, expires_at__gt=timezone.now()).count()
        connector_queue = _connector_queue()
        work_queue = {
            "connector_requests": connector_queue,
            "failed_automation_runs": _latest_automation_failures(),
            "failed_integration_events": _latest_integration_failures(),
            "failed_webhook_deliveries": _latest_failed_webhooks(),
        }
        database = _database_status(available=True)
    except DatabaseError as exc:
        queue = _unavailable_queue_summary()
        active_support_grants = 0
        connector_queue = []
        work_queue = {
            "connector_requests": [],
            "failed_automation_runs": [],
            "failed_integration_events": [],
            "failed_webhook_deliveries": [],
        }
        database = _database_status(available=False, error=exc)

    critical_count = (
        production["summary"]["fail"]
        + backup["summary"]["paid_beta_blockers"]
        + providers["summary"]["blocked"]
        + (1 if queue["status"] == "critical" and database["available"] else 0)
        + (0 if database["available"] else 1)
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
            "database_available": database["available"],
        },
        "runtime": {
            "database": database,
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
        "work_queue": work_queue,
    }
