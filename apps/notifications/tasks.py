from celery import shared_task

from apps.activities.services import create_activity_event
from apps.integrations.sanitization import sanitize_error_payload, sanitize_error_text
from apps.mobile.push import deliver_mobile_push_notification
from apps.notifications.models import Notification


MAX_MOBILE_PUSH_RETRIES = 3


@shared_task(bind=True, name="notifications.deliver_mobile_push", queue="notifications", max_retries=MAX_MOBILE_PUSH_RETRIES)
def deliver_mobile_push_notification_task(self, notification_id):
    notification = Notification.objects.select_related("business", "recipient", "client", "appointment").filter(id=notification_id).first()
    if notification is None:
        return {"notification_id": notification_id, "status": "missing"}
    if notification.status == Notification.Statuses.CANCELLED:
        return {"notification_id": notification_id, "status": "skipped", "reason": "Notification is cancelled."}

    result = deliver_mobile_push_notification(notification)
    safe_result = sanitize_error_payload(result)
    _write_mobile_push_activity(notification, result=safe_result, attempt=self.request.retries)

    if _should_retry(result) and self.request.retries < MAX_MOBILE_PUSH_RETRIES:
        reason = sanitize_error_text(result.get("reason") or result.get("status") or "Mobile push delivery failed.")
        raise self.retry(exc=RuntimeError(reason), countdown=_retry_delay(self.request.retries))

    return {"notification_id": notification.id, **safe_result}


def _should_retry(result):
    return not result.get("ok") and result.get("status") in {"failed", "partial_failed"}


def _retry_delay(retries):
    return min(300, 2 ** retries * 15)


def _write_mobile_push_activity(notification, *, result, attempt):
    status = result.get("status") or "unknown"
    create_activity_event(
        business=notification.business,
        client=notification.client,
        instance=notification.appointment or notification,
        event_type=f"mobile_push_{status}",
        category="notification",
        source="mobile_push",
        text=f"Mobile push {status}: {notification.action_label or notification.category}",
        metadata={"notification_id": notification.id, "attempt": attempt, "result": result},
    )
