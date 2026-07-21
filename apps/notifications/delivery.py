from django.core.mail import send_mail
from django.db.models import F, Q
from django.utils import timezone

from apps.activities.services import create_activity_event
from apps.bots.models import BotChannel
from apps.integrations.providers import send_message
from apps.integrations.sanitization import sanitize_error_payload, sanitize_error_text
from apps.notifications.models import Notification
from apps.notifications.routing import MANAGER_ROLES, TECHNICAL_ROLES, create_role_notification
from apps.scheduling.models import Appointment
from apps.scheduling.services import cancel_appointment, confirm_appointment
from apps.tasks.models import Task


POSITIVE_CONFIRMATION_WORDS = {"да", "подтверждаю", "подтвердить", "в силе", "ок", "окей", "yes", "confirm"}
CANCEL_WORDS = {"нет", "отмена", "отменить", "не приду", "cancel"}
RESCHEDULE_WORDS = {"перенести", "перенос", "другое время", "другой день", "reschedule"}


def process_due_notifications(*, limit=100):
    now = timezone.now()
    notification_ids = list(
        Notification.objects.filter(
            Q(status=Notification.Statuses.PENDING, send_at__lte=now)
            | Q(status=Notification.Statuses.RETRY_SCHEDULED, next_retry_at__lte=now)
        )
        .order_by("send_at", "id")
        .values_list("id", flat=True)[:limit]
    )
    results = []
    for notification_id in notification_ids:
        notification = claim_notification(notification_id, now=now)
        if notification is not None:
            results.append(deliver_notification(notification, claimed=True))
    return results


def claim_notification(notification_id, *, now=None):
    now = now or timezone.now()
    claimed = (
        Notification.objects.filter(id=notification_id)
        .filter(
            Q(status=Notification.Statuses.PENDING, send_at__lte=now)
            | Q(status=Notification.Statuses.RETRY_SCHEDULED, next_retry_at__lte=now)
        )
        .update(
            status=Notification.Statuses.SENDING,
            locked_at=now,
            last_attempt_at=now,
            attempts=F("attempts") + 1,
            next_retry_at=None,
            last_error="",
            updated_at=now,
        )
    )
    if not claimed:
        return None
    return Notification.objects.select_related("business", "client", "appointment").get(id=notification_id)


def deliver_notification(notification, *, claimed=False):
    if not claimed:
        notification_id = notification.id
        notification = claim_notification(notification_id)
        if notification is None:
            current_status = Notification.objects.filter(id=notification_id).values_list("status", flat=True).first()
            return {"notification_id": notification_id, "status": "skipped", "reason": f"Notification is {current_status or 'missing'}."}
    if notification.status != Notification.Statuses.SENDING:
        return {"notification_id": notification.id, "status": "skipped", "reason": "Notification is not pending."}

    try:
        result = _deliver(notification)
    except Exception as exc:
        reason = sanitize_error_text(exc)
        status = _record_delivery_failure(notification, reason=reason, retryable=True)
        _write_delivery_activity(notification, status=status, result={"reason": reason})
        return {"notification_id": notification.id, "status": status, "reason": reason}

    if result.get("ok"):
        notification.status = Notification.Statuses.SENT
        notification.delivered_at = timezone.now()
        notification.failed_at = None
        notification.locked_at = None
        notification.last_error = ""
        notification.provider_reference = str(
            result.get("provider_reference") or result.get("message_id") or result.get("id") or ""
        )[:255]
        notification.save(
            update_fields=[
                "status", "delivered_at", "failed_at", "locked_at", "last_error",
                "provider_reference", "updated_at",
            ]
        )
        _write_delivery_activity(notification, status="sent", result=result)
        return {"notification_id": notification.id, "status": "sent", "result": result}

    safe_result = sanitize_error_payload(result)
    reason = sanitize_error_text(safe_result.get("reason") or safe_result.get("error") or "Delivery failed.")
    status = _record_delivery_failure(notification, reason=reason, retryable=_is_retryable_result(result))
    if status == Notification.Statuses.FAILED:
        _notify_delivery_failure(notification, safe_result)
    _write_delivery_activity(notification, status=status, result=safe_result)
    return {"notification_id": notification.id, "status": status, "result": safe_result}


def _record_delivery_failure(notification, *, reason, retryable):
    notification.last_error = reason
    notification.locked_at = None
    if retryable and notification.attempts < notification.max_attempts:
        delay_seconds = min(3600, 60 * (2 ** max(notification.attempts - 1, 0)))
        notification.status = Notification.Statuses.RETRY_SCHEDULED
        notification.next_retry_at = timezone.now() + timezone.timedelta(seconds=delay_seconds)
        notification.failed_at = None
    else:
        notification.status = Notification.Statuses.FAILED
        notification.next_retry_at = None
        notification.failed_at = timezone.now()
    notification.save(
        update_fields=["status", "last_error", "locked_at", "next_retry_at", "failed_at", "updated_at"]
    )
    return notification.status


def _is_retryable_result(result):
    if "retryable" in result:
        return bool(result["retryable"])
    status_code = result.get("status_code") or result.get("http_status")
    return status_code in {408, 425, 429, 500, 502, 503, 504}


def handle_appointment_followup_reply(*, business, channel, external_user_id, text):
    client = _client_from_channel(business=business, channel=channel, external_user_id=external_user_id)
    if client is None:
        return {"status": "skipped", "reason": "Client was not found for reply."}

    appointment = (
        Appointment.objects.select_related("business", "client", "lead", "service", "resource")
        .filter(
            business=business,
            client=client,
            start_at__gte=timezone.now(),
            status__in=[Appointment.Statuses.CREATED, Appointment.Statuses.CONFIRMED],
        )
        .order_by("start_at")
        .first()
    )
    if appointment is None:
        return {"status": "skipped", "reason": "Future appointment was not found."}

    normalized = _normalize_reply(text)
    if normalized in POSITIVE_CONFIRMATION_WORDS:
        if appointment.status != Appointment.Statuses.CONFIRMED:
            try:
                appointment = confirm_appointment(
                    appointment=appointment,
                    actor=None,
                    activity_metadata=_reply_lifecycle_metadata(channel=channel, text=text, action="confirm"),
                    activity_source=channel,
                )
            except ValueError as exc:
                return {"status": "skipped", "reason": str(exc), "appointment_id": appointment.id}
        _notify_manager_for_reply(appointment, f"Клиент подтвердил запись: {client.full_name}")
        return {"status": "confirmed", "appointment_id": appointment.id}

    if normalized in CANCEL_WORDS:
        try:
            appointment = cancel_appointment(
                appointment=appointment,
                actor=None,
                reason=_client_reply_cancellation_reason(channel=channel, text=text),
                activity_metadata=_reply_lifecycle_metadata(channel=channel, text=text, action="cancel"),
                activity_source=channel,
            )
        except ValueError as exc:
            return {"status": "skipped", "reason": str(exc), "appointment_id": appointment.id}
        _notify_manager_for_reply(appointment, f"Клиент отменил запись: {client.full_name}")
        return {"status": "cancelled", "appointment_id": appointment.id}

    if normalized in RESCHEDULE_WORDS:
        task = Task.objects.create(
            business=business,
            client=client,
            lead=appointment.lead,
            appointment=appointment,
            title=f"Перенести запись: {client.full_name}",
            description=f"Клиент попросил перенести запись. Ответ: {text}",
            priority=Task.Priorities.HIGH,
            due_at=timezone.now() + timezone.timedelta(minutes=30),
        )
        _notify_manager_for_reply(appointment, f"Клиент просит перенести запись: {client.full_name}", task=task)
        return {"status": "reschedule_requested", "appointment_id": appointment.id, "task_id": task.id}

    _notify_manager_for_reply(appointment, f"Неясный ответ по записи: {client.full_name} — {text}")
    return {"status": "needs_review", "appointment_id": appointment.id}


def _deliver(notification):
    if notification.channel == Notification.Channels.SYSTEM:
        return {"ok": True, "provider": "system"}
    if notification.channel == Notification.Channels.EMAIL:
        email = notification.client.email if notification.client_id else ""
        if not email:
            return {"ok": False, "reason": "Client email is missing."}
        sent = send_mail(
            subject="ZANI: напоминание о записи",
            message=notification.text,
            from_email=None,
            recipient_list=[email],
            fail_silently=False,
        )
        return {"ok": bool(sent), "provider": "email", "sent": sent}
    if notification.channel in {Notification.Channels.TELEGRAM, Notification.Channels.WHATSAPP}:
        channel = _active_bot_channel(notification.business, notification.channel)
        if channel is None:
            return {"ok": False, "reason": f"{notification.channel} channel is not connected."}
        recipient_id = _recipient_id(notification)
        if not recipient_id:
            return {"ok": False, "reason": "Client channel id is missing."}
        return send_message(channel, recipient_id, notification.text, payload=_delivery_payload(notification))
    if notification.channel == Notification.Channels.SMS:
        return {"ok": False, "reason": "SMS provider is not configured."}
    return {"ok": False, "reason": f"Unsupported channel: {notification.channel}."}


def _delivery_payload(notification):
    payload = {"notification_id": notification.id, "appointment_id": notification.appointment_id}
    if notification.category != Notification.Categories.OUTREACH:
        return payload

    recipient = notification.outreach_recipients.select_related("campaign").first()
    if not recipient:
        return payload

    campaign = recipient.campaign
    payload.update(
        {
            "outreach_campaign_id": campaign.id,
            "outreach_recipient_id": recipient.id,
            "campaign_type": campaign.campaign_type,
            "whatsapp_template_name": campaign.whatsapp_template_name,
            "whatsapp_template_language": campaign.whatsapp_template_language,
            "whatsapp_template_status": campaign.whatsapp_template_status,
            "template_parameters": _template_parameters(notification),
        }
    )
    return payload


def _template_parameters(notification):
    if not notification.client_id:
        return []
    return [notification.client.full_name or notification.client.phone or ""]


def _active_bot_channel(business, channel):
    return (
        BotChannel.objects.select_related("bot")
        .filter(bot__business=business, channel=channel, status=BotChannel.Statuses.ACTIVE)
        .exclude(bot__status="paused")
        .order_by("-updated_at")
        .first()
    )


def _recipient_id(notification):
    if not notification.client_id:
        return ""
    if notification.channel == Notification.Channels.TELEGRAM:
        return notification.client.telegram_id
    if notification.channel == Notification.Channels.WHATSAPP:
        return notification.client.whatsapp_id or notification.client.phone
    return ""


def _client_from_channel(*, business, channel, external_user_id):
    from apps.clients.models import Client

    if channel == Notification.Channels.TELEGRAM:
        return Client.objects.filter(business=business, telegram_id=external_user_id, is_archived=False).first()
    if channel == Notification.Channels.WHATSAPP:
        return Client.objects.filter(business=business, whatsapp_id=external_user_id, is_archived=False).first() or Client.objects.filter(
            business=business,
            phone=external_user_id,
            is_archived=False,
        ).first()
    return None


def _normalize_reply(text):
    return " ".join((text or "").strip().lower().split())


def _reply_lifecycle_metadata(*, channel, text, action):
    return {
        "source": "client_reply",
        "channel": channel,
        "reply": text,
        "reply_action": action,
    }


def _client_reply_cancellation_reason(*, channel, text):
    return f"Client reply via {channel}: {(text or '').strip()}"


def _notify_manager_for_reply(appointment, text, *, task=None):
    preferred_user = appointment.lead.responsible_user if appointment.lead_id and appointment.lead.responsible_user_id else None
    notifications = create_role_notification(
        business=appointment.business,
        client=appointment.client,
        appointment=appointment,
        category=Notification.Categories.SALES,
        priority=Notification.Priorities.HIGH,
        text=text,
        action_url=f"/app/tasks?task={task.id}" if task else f"/app/calendar?appointment={appointment.id}",
        action_label="Открыть",
        preferred_user=preferred_user,
        roles=MANAGER_ROLES,
    )
    return notifications[0] if notifications else None


def _notify_delivery_failure(notification, result):
    create_role_notification(
        business=notification.business,
        client=notification.client,
        appointment=notification.appointment,
        category=Notification.Categories.SYSTEM,
        priority=Notification.Priorities.HIGH,
        text=f"Не удалось отправить уведомление клиенту: {result.get('reason') or result}",
        action_url=f"/app/calendar?appointment={notification.appointment_id}" if notification.appointment_id else "/app/settings",
        action_label="Проверить",
        roles=TECHNICAL_ROLES,
    )


def _write_delivery_activity(notification, *, status, result):
    create_activity_event(
        business=notification.business,
        client=notification.client,
        instance=notification.appointment or notification,
        event_type=f"notification_{status}",
        category="notification",
        source=notification.channel,
        text=f"Notification {status}: {notification.action_label or notification.channel}",
        metadata={"notification_id": notification.id, "result": result},
    )
