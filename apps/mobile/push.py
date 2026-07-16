import json
from urllib import request as urllib_request

from django.conf import settings

from apps.integrations.connectors import decrypt_credential_value
from apps.integrations.sanitization import sanitize_error_text
from apps.mobile.models import MobilePushToken
from apps.mobile.observability import record_mobile_event
from apps.notifications.models import Notification, NotificationPreference


EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
MAX_PUSH_BATCH_SIZE = 100


def build_mobile_push_messages(notification, *, max_tokens=MAX_PUSH_BATCH_SIZE):
    tokens = _target_push_tokens(notification)[:max_tokens]
    messages = []
    for token in tokens:
        raw_token = _decrypt_push_token(token)
        if not raw_token:
            continue
        messages.append(
            {
                "to": raw_token,
                "sound": "default",
                "title": _push_title(notification),
                "body": _push_body(notification, user=token.user),
                "data": {
                    "notification_id": notification.id,
                    "business_id": notification.business_id,
                    "category": notification.category,
                    "priority": notification.priority,
                    "action_url": notification.action_url,
                },
            }
        )
    return messages


def deliver_mobile_push_notification(notification, *, dry_run=None):
    if dry_run is None:
        dry_run = not getattr(settings, "MOBILE_PUSH_DELIVERY_ENABLED", False)
    messages = build_mobile_push_messages(notification)
    if not messages:
        result = {"ok": False, "provider": "expo", "status": "skipped", "reason": "No active mobile push tokens."}
        _record_push_result(notification, result)
        return result
    if dry_run:
        result = {"ok": True, "provider": "expo", "status": "planned", "count": len(messages)}
        _record_push_result(notification, result)
        return result
    try:
        result = _send_expo_messages(messages)
    except Exception as exc:
        result = {"ok": False, "provider": "expo", "status": "failed", "reason": sanitize_error_text(exc)}
    _record_push_result(notification, result)
    return result


def _target_push_tokens(notification):
    queryset = (
        MobilePushToken.objects.select_related("device")
        .filter(
            business=notification.business,
            is_active=True,
            revoked_at__isnull=True,
            device__revoked_at__isnull=True,
        )
        .exclude(encrypted_token="")
        .order_by("-last_seen_at", "-updated_at", "-id")
    )
    if notification.recipient_id:
        queryset = queryset.filter(user=notification.recipient)
    tokens = list(queryset)
    if notification.priority in {Notification.Priorities.HIGH, Notification.Priorities.URGENT}:
        return tokens
    disabled_user_ids = set(
        NotificationPreference.objects.filter(
            business=notification.business,
            user_id__in=[token.user_id for token in tokens],
            category=notification.category,
            push_enabled=False,
        ).values_list("user_id", flat=True)
    )
    return [token for token in tokens if token.user_id not in disabled_user_ids]


def _decrypt_push_token(token):
    try:
        return decrypt_credential_value(token.encrypted_token)
    except Exception:
        token.revoke("push_token_decrypt_failed")
        return ""


def _push_title(notification):
    if notification.priority == Notification.Priorities.URGENT:
        return "Zani: urgent action"
    if notification.category == Notification.Categories.TASKS:
        return "Zani: task update"
    if notification.category == Notification.Categories.SALES:
        return "Zani: new sales update"
    return "Zani notification"


def _push_body(notification, *, user):
    preference = NotificationPreference.objects.filter(
        business=notification.business,
        user=user,
        category=notification.category,
    ).first()
    if preference and preference.privacy_mode == NotificationPreference.PrivacyModes.FULL and notification.text:
        return _compact_push_text(notification.text)
    if notification.priority in {Notification.Priorities.HIGH, Notification.Priorities.URGENT}:
        return "Open Zani to review."
    return "Open Zani for the latest update."


def _compact_push_text(text):
    text = " ".join(str(text or "").split())
    if len(text) <= 120:
        return text
    return f"{text[:117]}..."


def _record_push_result(notification, result):
    record_mobile_event(
        "push_delivery",
        business_id=notification.business_id,
        endpoint="notifications.deliver_mobile_push",
        status=result.get("status") or "unknown",
        metadata={
            "notification_id": notification.id,
            "provider": result.get("provider"),
            "count": result.get("count", 0),
            "errors": result.get("errors", 0),
            "ok": result.get("ok", False),
        },
    )


def _send_expo_messages(messages):
    url = getattr(settings, "MOBILE_EXPO_PUSH_URL", EXPO_PUSH_URL)
    payload = json.dumps(messages).encode("utf-8")
    request = urllib_request.Request(
        url,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        method="POST",
    )
    with urllib_request.urlopen(request, timeout=10) as response:
        raw_body = response.read().decode("utf-8")
    body = json.loads(raw_body or "{}")
    errors = [item for item in body.get("data", []) if item.get("status") == "error"]
    return {
        "ok": not errors,
        "provider": "expo",
        "status": "sent" if not errors else "partial_failed",
        "count": len(messages),
        "errors": len(errors),
    }
