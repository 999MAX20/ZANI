from django.db.models import F
from django.utils import timezone

from apps.activities.models import ActivityEvent
from apps.activities.services import create_activity_event
from apps.activities.taxonomy import ActivityEvents
from apps.billing.models import UsageCounter
from apps.billing.entitlements import EntitlementMetrics, assert_entitlement_allows
from apps.billing.usage import increment_usage
from apps.bots.models import BotChannel, BotMessage
from apps.businesses.models import BusinessMember
from apps.integrations.sanitization import sanitize_error_payload, sanitize_error_text
from apps.integrations.providers import send_message
from apps.notifications.models import Notification


CHAT_NOTIFICATION_ROLES = {
    BusinessMember.Roles.ADMIN,
    BusinessMember.Roles.MANAGER,
    BusinessMember.Roles.OPERATOR,
    BusinessMember.Roles.SUPPORT,
    BusinessMember.Roles.STAFF,
}


def register_bot_message(message, actor=None):
    conversation = message.conversation
    assert_entitlement_allows(conversation.business, EntitlementMetrics.BOT_MESSAGES)
    timestamp = message.created_at or timezone.now()
    update_fields = ["last_message_at", "updated_at"]

    conversation.last_message_at = timestamp
    conversation.updated_at = timezone.now()

    if message.direction == BotMessage.Directions.INBOUND:
        conversation.last_inbound_at = timestamp
        conversation.unread_count = F("unread_count") + 1
        update_fields.extend(["last_inbound_at", "unread_count"])
    else:
        conversation.last_outbound_at = timestamp
        update_fields.append("last_outbound_at")

    conversation.save(update_fields=update_fields)
    conversation.refresh_from_db(fields=["unread_count"])
    increment_usage(conversation.business, UsageCounter.Metrics.BOT_MESSAGES)
    if message.direction == BotMessage.Directions.INBOUND:
        create_inbound_message_notifications(conversation, message)
        from apps.automations.engine import run_conversation_unread_automations

        run_conversation_unread_automations(conversation, message=message)
    if conversation.client_id or conversation.lead_id:
        create_activity_event(
            business=conversation.business,
            client=conversation.client,
            actor=_activity_actor(actor),
            event_type=ActivityEvents.MESSAGE_RECEIVED if message.direction == BotMessage.Directions.INBOUND else ActivityEvents.MESSAGE_SENT,
            instance=message,
            category=ActivityEvent.Categories.MESSAGE,
            source=conversation.channel,
            text=message.text[:240] or ("Получено сообщение" if message.direction == BotMessage.Directions.INBOUND else "Отправлено сообщение"),
            metadata={
                "event_type": ActivityEvents.MESSAGE_RECEIVED if message.direction == BotMessage.Directions.INBOUND else ActivityEvents.MESSAGE_SENT,
                "conversation_id": conversation.id,
                "lead_id": conversation.lead_id,
            },
        )
    return conversation


def create_inbound_message_notifications(conversation, message):
    recipients = _chat_notification_recipients(conversation)
    if not recipients:
        return []

    title = conversation.client.full_name if conversation.client_id else conversation.external_user_id or "Новый клиент"
    channel = conversation.get_channel_display() if hasattr(conversation, "get_channel_display") else conversation.channel
    text = message.text.strip() or "Новое входящее сообщение"
    preview = text[:140]
    now = timezone.now()
    notifications = [
        Notification(
            business=conversation.business,
            recipient=user,
            client=conversation.client,
            channel=Notification.Channels.SYSTEM,
            category=Notification.Categories.SALES,
            priority=Notification.Priorities.HIGH if conversation.handoff_required else Notification.Priorities.NORMAL,
            text=f"Новое сообщение в {channel}: {title} — {preview}",
            send_at=now,
            status=Notification.Statuses.PENDING,
            action_url=f"/app/conversations?conversation={conversation.id}",
            action_label="Открыть чат",
        )
        for user in recipients
    ]
    return Notification.objects.bulk_create(notifications)


def _chat_notification_recipients(conversation):
    if conversation.assigned_to_id:
        membership = BusinessMember.objects.filter(
            business=conversation.business,
            user=conversation.assigned_to,
            is_active=True,
            role__in=CHAT_NOTIFICATION_ROLES,
        ).select_related("user").first()
        return [membership.user] if membership else []

    memberships = (
        BusinessMember.objects.select_related("user")
        .filter(business=conversation.business, is_active=True, role__in=CHAT_NOTIFICATION_ROLES)
        .exclude(user_id=conversation.business.owner_id)
    )
    return [membership.user for membership in memberships]


def mark_conversation_read(conversation):
    conversation.unread_count = 0
    conversation.save(update_fields=["unread_count", "updated_at"])
    return conversation


def assign_conversation(conversation, user, *, actor=None):
    previous_assignee_id = conversation.assigned_to_id
    conversation.assigned_to = user
    conversation.save(update_fields=["assigned_to", "updated_at"])
    _write_conversation_activity(
        conversation,
        event_type="conversation_assigned",
        actor=actor,
        text="Conversation assigned.",
        metadata={"from_user_id": previous_assignee_id, "to_user_id": user.id if user else None},
    )
    return conversation


def handoff_conversation(conversation, reason="", *, actor=None):
    conversation.handoff_required = True
    conversation.handoff_reason = reason
    conversation.bot_enabled = False
    conversation.save(update_fields=["handoff_required", "handoff_reason", "bot_enabled", "updated_at"])
    _write_conversation_activity(
        conversation,
        event_type="conversation_handoff_requested",
        actor=actor,
        text="Conversation handed off to a manager.",
        metadata={"reason": reason, "bot_enabled": False},
    )
    return conversation


def mark_conversation_unread(conversation, *, actor=None):
    previous_unread_count = conversation.unread_count
    conversation.unread_count = max(conversation.unread_count, 1)
    conversation.save(update_fields=["unread_count", "updated_at"])
    _write_conversation_activity(
        conversation,
        event_type="conversation_marked_unread",
        actor=actor,
        text="Conversation marked unread.",
        metadata={"from_unread_count": previous_unread_count, "to_unread_count": conversation.unread_count},
    )
    from apps.automations.engine import run_conversation_unread_automations

    run_conversation_unread_automations(conversation)
    return conversation


def set_conversation_priority(conversation, priority, *, actor=None):
    previous_priority = conversation.priority
    conversation.priority = priority
    conversation.save(update_fields=["priority", "updated_at"])
    _write_conversation_activity(
        conversation,
        event_type="conversation_priority_changed",
        actor=actor,
        text="Conversation priority changed.",
        metadata={"from_priority": previous_priority, "to_priority": priority},
    )
    return conversation


def close_conversation(conversation, *, reason="", actor=None):
    previous_status = conversation.status
    conversation.status = conversation.Statuses.CLOSED
    conversation.close_reason = reason
    conversation.handoff_required = False
    conversation.bot_enabled = False
    conversation.save(update_fields=["status", "close_reason", "handoff_required", "bot_enabled", "updated_at"])
    BotMessage.objects.create(
        conversation=conversation,
        direction=BotMessage.Directions.OUTBOUND,
        sender_type=BotMessage.SenderTypes.SYSTEM,
        text="Conversation closed by manager.",
        status=BotMessage.Statuses.SENT,
    )
    _write_conversation_activity(
        conversation,
        event_type="conversation_closed",
        actor=actor,
        text="Conversation closed.",
        metadata={"from_status": previous_status, "to_status": conversation.status, "reason": reason},
    )
    return conversation


def reopen_conversation(conversation, *, actor=None):
    previous_status = conversation.status
    conversation.status = conversation.Statuses.OPEN
    conversation.close_reason = ""
    conversation.save(update_fields=["status", "close_reason", "updated_at"])
    BotMessage.objects.create(
        conversation=conversation,
        direction=BotMessage.Directions.OUTBOUND,
        sender_type=BotMessage.SenderTypes.SYSTEM,
        text="Conversation reopened.",
        status=BotMessage.Statuses.SENT,
    )
    _write_conversation_activity(
        conversation,
        event_type="conversation_reopened",
        actor=actor,
        text="Conversation reopened.",
        metadata={"from_status": previous_status, "to_status": conversation.status},
    )
    return conversation


def record_message_retry(conversation, *, original_message, retried_message, actor=None):
    _write_conversation_activity(
        conversation,
        event_type=ActivityEvents.MESSAGE_RETRIED,
        actor=actor,
        text="Outbound message retry requested.",
        metadata={
            "original_message_id": original_message.id,
            "retried_message_id": retried_message.id,
            "original_status": original_message.status,
        },
    )
    return conversation


def record_inbox_crm_activity(conversation, *, entity, event_type, actor=None, text="", metadata=None, category=None):
    create_activity_event(
        business=conversation.business,
        client=_activity_client(conversation, entity),
        actor=_activity_actor(actor),
        instance=entity,
        category=category,
        source="inbox",
        event_type=event_type,
        text=text,
        metadata={"event_type": event_type, "conversation_id": conversation.id, **(metadata or {})},
    )


def send_outbound_message(conversation, text, user, sender_type=BotMessage.SenderTypes.MANAGER):
    assert_entitlement_allows(conversation.business, EntitlementMetrics.BOT_MESSAGES)
    status = BotMessage.Statuses.QUEUED
    error_text = ""
    delivery_payload = {"delivery_mode": "provider_not_connected"}
    external_message_id = ""
    sent_at = None
    channel = BotChannel.objects.filter(bot=conversation.bot, channel=conversation.channel).first()
    if channel and conversation.external_user_id:
        try:
            result = send_message(channel, conversation.external_user_id, text)
        except Exception as exc:
            result = {"ok": False, "mock": False, "reason": sanitize_error_text(exc)}
        delivery_payload = {"delivery_mode": "provider", "provider_result": sanitize_error_payload(result)}
        if result.get("ok") and not result.get("mock"):
            status = BotMessage.Statuses.SENT
            external_message_id = result.get("provider_message_id") or ""
            sent_at = timezone.now()
        elif result.get("mock"):
            error_text = sanitize_error_text(result.get("reason") or "Provider is running in mock mode.")
        else:
            status = BotMessage.Statuses.FAILED
            error_text = sanitize_error_text(result.get("reason") or "Provider delivery failed.")
    elif not channel:
        error_text = "Channel provider is not connected."
    elif not conversation.external_user_id:
        error_text = "Conversation does not have an external recipient id."

    message = BotMessage.objects.create(
        conversation=conversation,
        direction=BotMessage.Directions.OUTBOUND,
        sender_type=sender_type,
        text=text,
        status=status,
        external_message_id=external_message_id,
        sent_at=sent_at,
        error_text=error_text,
        payload_json={
            "sent_by_user_id": user.id if user and user.is_authenticated else None,
            **delivery_payload,
        },
    )
    register_bot_message(message, actor=user)
    return message


def _write_conversation_activity(conversation, *, event_type, actor=None, text="", metadata=None):
    create_activity_event(
        business=conversation.business,
        client=conversation.client,
        actor=_activity_actor(actor),
        instance=conversation,
        category=ActivityEvent.Categories.MESSAGE,
        source="inbox",
        event_type=event_type,
        text=text,
        metadata={"event_type": event_type, "conversation_id": conversation.id, **(metadata or {})},
    )


def _activity_actor(actor):
    if actor and getattr(actor, "is_authenticated", False):
        return actor
    return None


def _activity_client(conversation, entity):
    if conversation.client_id:
        return conversation.client
    if entity is None:
        return None
    if entity.__class__.__name__ == "Client":
        return entity
    return getattr(entity, "client", None)
