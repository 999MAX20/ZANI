import hashlib
import json

from django.conf import settings
from django.db import IntegrityError, transaction
from django.db.models import F, Min, Q
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.billing.entitlements import EntitlementMetrics, assert_entitlement_allows
from apps.bots.models import BotChannel, BotMessage
from apps.integrations.providers import send_message
from apps.integrations.sanitization import sanitize_error_payload, sanitize_error_text


CLAIMABLE_STATUSES = {
    BotMessage.Statuses.QUEUED,
    BotMessage.Statuses.RETRY_SCHEDULED,
}
ACTIVE_DELIVERY_STATUSES = CLAIMABLE_STATUSES | {BotMessage.Statuses.DELIVERING}
PERMANENT_FAILURE_MARKERS = (
    "disabled",
    "missing",
    "not connected",
    "external recipient",
    "credentials",
    "require a recent inbound",
    "approved template",
    "invalid recipient",
    "unauthorized",
    "forbidden",
)


def _normalize_idempotency_key(value):
    return str(value or "").strip()[:128]


def _request_hash(*, conversation_id, text, sender_type):
    payload = json.dumps(
        {
            "conversation_id": conversation_id,
            "sender_type": sender_type,
            "text": text,
        },
        sort_keys=True,
        ensure_ascii=False,
        separators=(",", ":"),
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _max_attempts():
    return max(1, getattr(settings, "OUTBOUND_DELIVERY_MAX_ATTEMPTS", 5))


def create_outbound_message(
    conversation,
    *,
    text,
    user,
    sender_type=BotMessage.SenderTypes.MANAGER,
    idempotency_key="",
):
    assert_entitlement_allows(conversation.business, EntitlementMetrics.BOT_MESSAGES)
    normalized_key = _normalize_idempotency_key(idempotency_key)
    request_hash = _request_hash(
        conversation_id=conversation.id,
        text=text,
        sender_type=sender_type,
    )

    if normalized_key:
        existing = BotMessage.objects.filter(
            conversation=conversation,
            delivery_idempotency_key=normalized_key,
        ).first()
        if existing:
            _assert_matching_request(existing, request_hash)
            return existing

    from apps.bots.inbox_service import register_bot_message

    try:
        with transaction.atomic():
            message = BotMessage.objects.create(
                conversation=conversation,
                direction=BotMessage.Directions.OUTBOUND,
                sender_type=sender_type,
                text=text,
                status=BotMessage.Statuses.QUEUED,
                delivery_max_attempts=_max_attempts(),
                delivery_idempotency_key=normalized_key,
                delivery_request_hash=request_hash,
                payload_json={
                    "sent_by_user_id": user.id if user and user.is_authenticated else None,
                    "delivery_mode": "outbox",
                },
            )
            register_bot_message(message, actor=user)
    except IntegrityError:
        if not normalized_key:
            raise
        message = BotMessage.objects.get(
            conversation=conversation,
            delivery_idempotency_key=normalized_key,
        )
        _assert_matching_request(message, request_hash)
        return message

    schedule_outbound_delivery(message)
    message.refresh_from_db()
    return message


def _assert_matching_request(message, request_hash):
    if message.delivery_request_hash != request_hash:
        raise ValidationError(
            {"idempotency_key": "This idempotency key was already used with different message data."}
        )


def schedule_outbound_delivery(message):
    if message.status not in CLAIMABLE_STATUSES:
        return message
    if getattr(settings, "OUTBOUND_MESSAGES_RUN_INLINE", True):
        return deliver_outbound_message(message.id)

    from apps.bots.tasks import process_outbound_message_task

    transaction.on_commit(lambda: process_outbound_message_task.delay(message.id))
    return message


def claim_outbound_message(message_id, *, now=None):
    now = now or timezone.now()
    due = Q(status=BotMessage.Statuses.QUEUED) | Q(
        status=BotMessage.Statuses.RETRY_SCHEDULED,
        delivery_next_retry_at__lte=now,
    )
    claimed = (
        BotMessage.objects.filter(
            Q(id=message_id),
            due,
            direction=BotMessage.Directions.OUTBOUND,
        )
        .update(
            status=BotMessage.Statuses.DELIVERING,
            delivery_attempts=F("delivery_attempts") + 1,
            delivery_locked_at=now,
            delivery_next_retry_at=None,
        )
    )
    if not claimed:
        return None
    return BotMessage.objects.select_related(
        "conversation",
        "conversation__business",
        "conversation__bot",
    ).get(id=message_id)


def deliver_outbound_message(message_id):
    message = claim_outbound_message(message_id)
    if message is None:
        return BotMessage.objects.filter(id=message_id).first()

    conversation = message.conversation
    channel = BotChannel.objects.filter(
        bot=conversation.bot,
        channel=conversation.channel,
    ).first()
    if channel is None:
        return _finish_delivery(
            message,
            result={"ok": False, "reason": "Channel provider is not connected.", "retryable": False},
        )
    if not conversation.external_user_id:
        return _finish_delivery(
            message,
            result={
                "ok": False,
                "reason": "Conversation does not have an external recipient id.",
                "retryable": False,
            },
        )

    try:
        result = send_message(
            channel,
            conversation.external_user_id,
            message.text,
            payload={"zani_message_id": message.id},
        )
    except Exception as exc:
        result = {
            "ok": False,
            "reason": sanitize_error_text(exc),
            "retryable": True,
        }
    return _finish_delivery(message, result=result)


def _finish_delivery(message, *, result):
    now = timezone.now()
    safe_result = sanitize_error_payload(result or {})
    payload = {
        **(message.payload_json or {}),
        "delivery_mode": "provider",
        "provider_result": safe_result,
    }
    update_fields = [
        "payload_json",
        "status",
        "error_text",
        "external_message_id",
        "sent_at",
        "delivery_next_retry_at",
        "delivery_locked_at",
    ]
    message.payload_json = payload
    message.delivery_locked_at = None
    message.delivery_next_retry_at = None

    if result.get("ok") and not result.get("mock"):
        message.status = BotMessage.Statuses.SENT
        message.error_text = ""
        message.external_message_id = _provider_message_id(result)
        message.sent_at = now
    else:
        reason = sanitize_error_text(
            result.get("reason")
            or ("Provider is running in mock mode." if result.get("mock") else "Provider delivery failed.")
        )
        message.error_text = reason
        retryable = _is_retryable(result, reason)
        if retryable and message.delivery_attempts < message.delivery_max_attempts:
            message.status = BotMessage.Statuses.RETRY_SCHEDULED
            message.delivery_next_retry_at = now + timezone.timedelta(
                seconds=_retry_delay_seconds(message.delivery_attempts)
            )
        else:
            message.status = BotMessage.Statuses.FAILED

    message.save(update_fields=update_fields)
    return message


def _provider_message_id(result):
    value = result.get("provider_message_id")
    if value:
        return str(value)
    nested = result.get("result")
    if isinstance(nested, dict) and nested.get("message_id"):
        return str(nested["message_id"])
    return ""


def _is_retryable(result, reason):
    if result.get("mock"):
        return False
    if "retryable" in result:
        return bool(result["retryable"])
    lowered = reason.lower()
    return not any(marker in lowered for marker in PERMANENT_FAILURE_MARKERS)


def _retry_delay_seconds(attempt):
    base = max(1, getattr(settings, "OUTBOUND_DELIVERY_RETRY_BASE_SECONDS", 30))
    maximum = max(base, getattr(settings, "OUTBOUND_DELIVERY_RETRY_MAX_SECONDS", 3600))
    return min(maximum, base * (2 ** max(0, attempt - 1)))


def retry_outbound_message(message, *, actor=None, idempotency_key=""):
    normalized_key = _normalize_idempotency_key(idempotency_key)
    message.refresh_from_db()

    if normalized_key and message.delivery_last_retry_key == normalized_key:
        return message, False
    if message.status in ACTIVE_DELIVERY_STATUSES:
        raise ValidationError({"message_id": "Message delivery is already scheduled."})
    if message.status == BotMessage.Statuses.SENT:
        raise ValidationError({"message_id": "Sent messages do not need retry."})
    if message.direction != BotMessage.Directions.OUTBOUND:
        raise ValidationError({"message_id": "Only outbound messages can be retried."})
    if message.sender_type == BotMessage.SenderTypes.SYSTEM:
        raise ValidationError({"message_id": "System messages cannot be retried."})

    payload = {
        **(message.payload_json or {}),
        "retry_of_message_id": message.id,
        "manual_retry_count": int((message.payload_json or {}).get("manual_retry_count") or 0) + 1,
        "retried_by_user_id": actor.id if actor and actor.is_authenticated else None,
    }
    updated = BotMessage.objects.filter(id=message.id, status=message.status).update(
        status=BotMessage.Statuses.QUEUED,
        error_text="",
        delivery_attempts=0,
        delivery_next_retry_at=None,
        delivery_locked_at=None,
        delivery_last_retry_key=normalized_key,
        payload_json=payload,
    )
    if not updated:
        message.refresh_from_db()
        if normalized_key and message.delivery_last_retry_key == normalized_key:
            return message, False
        if message.status in ACTIVE_DELIVERY_STATUSES:
            raise ValidationError({"message_id": "Message delivery is already scheduled."})
        if message.status == BotMessage.Statuses.SENT:
            raise ValidationError({"message_id": "Sent messages do not need retry."})
        raise ValidationError({"message_id": "Message state changed. Refresh and retry."})
    message.refresh_from_db()
    schedule_outbound_delivery(message)
    message.refresh_from_db()
    return message, True


def recover_stale_outbound_messages(*, now=None):
    now = now or timezone.now()
    stale_before = now - timezone.timedelta(
        seconds=max(60, getattr(settings, "OUTBOUND_DELIVERY_STALE_LOCK_SECONDS", 900))
    )
    base = BotMessage.objects.filter(
        direction=BotMessage.Directions.OUTBOUND,
        status=BotMessage.Statuses.DELIVERING,
        delivery_locked_at__lt=stale_before,
    )
    failed = base.filter(delivery_attempts__gte=F("delivery_max_attempts")).update(
        status=BotMessage.Statuses.FAILED,
        delivery_next_retry_at=None,
        delivery_locked_at=None,
        error_text="Delivery worker lock expired at the attempt limit.",
    )
    retried = base.filter(delivery_attempts__lt=F("delivery_max_attempts")).update(
        status=BotMessage.Statuses.RETRY_SCHEDULED,
        delivery_next_retry_at=now,
        delivery_locked_at=None,
        error_text="Delivery worker lock expired; retry scheduled.",
    )
    return {"retry_scheduled": retried, "failed": failed}


def process_due_outbound_messages(*, limit=100):
    if limit <= 0:
        return []
    now = timezone.now()
    recover_stale_outbound_messages(now=now)
    message_ids = list(
        BotMessage.objects.filter(
            Q(status=BotMessage.Statuses.QUEUED)
            | Q(
                status=BotMessage.Statuses.RETRY_SCHEDULED,
                delivery_next_retry_at__lte=now,
            ),
            direction=BotMessage.Directions.OUTBOUND,
        )
        .order_by("delivery_next_retry_at", "created_at", "id")
        .values_list("id", flat=True)[: min(limit, 500)]
    )
    return [deliver_outbound_message(message_id) for message_id in message_ids]


def outbound_delivery_health():
    now = timezone.now()
    stale_before = now - timezone.timedelta(
        seconds=max(60, getattr(settings, "OUTBOUND_DELIVERY_STALE_LOCK_SECONDS", 900))
    )
    queryset = BotMessage.objects.filter(direction=BotMessage.Directions.OUTBOUND)
    pending_queryset = queryset.filter(status__in=CLAIMABLE_STATUSES)
    due_retry_queryset = queryset.filter(
        status=BotMessage.Statuses.RETRY_SCHEDULED,
        delivery_next_retry_at__lte=now,
    )
    oldest_pending_at = pending_queryset.aggregate(value=Min("created_at"))["value"]
    oldest_due_retry_at = due_retry_queryset.aggregate(value=Min("delivery_next_retry_at"))["value"]
    return {
        "queued": queryset.filter(status=BotMessage.Statuses.QUEUED).count(),
        "retry_scheduled": queryset.filter(status=BotMessage.Statuses.RETRY_SCHEDULED).count(),
        "due_retry": due_retry_queryset.count(),
        "delivering": queryset.filter(status=BotMessage.Statuses.DELIVERING).count(),
        "stale_delivering": queryset.filter(
            status=BotMessage.Statuses.DELIVERING,
            delivery_locked_at__lt=stale_before,
        ).count(),
        "failed": queryset.filter(status=BotMessage.Statuses.FAILED).count(),
        "oldest_pending_age_seconds": _age_seconds(oldest_pending_at, now),
        "oldest_due_retry_age_seconds": _age_seconds(oldest_due_retry_at, now),
    }


def _age_seconds(value, now):
    if value is None:
        return 0
    return max(0, int((now - value).total_seconds()))
