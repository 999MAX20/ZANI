from django.db.models import F
from django.utils import timezone

from apps.activities.models import ActivityEvent
from apps.activities.services import create_activity_event
from apps.billing.models import UsageCounter
from apps.billing.entitlements import EntitlementMetrics, assert_entitlement_allows
from apps.billing.usage import increment_usage
from apps.bots.models import BotChannel, BotMessage
from apps.businesses.models import BusinessMember
from apps.integrations.providers import send_message
from apps.notifications.models import Notification


CHAT_NOTIFICATION_ROLES = {
    BusinessMember.Roles.ADMIN,
    BusinessMember.Roles.MANAGER,
    BusinessMember.Roles.OPERATOR,
    BusinessMember.Roles.SUPPORT,
    BusinessMember.Roles.STAFF,
}


def register_bot_message(message):
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
    if conversation.client_id or conversation.lead_id:
        create_activity_event(
            business=conversation.business,
            client=conversation.client,
            event_type="message_received" if message.direction == BotMessage.Directions.INBOUND else "message_sent",
            instance=message,
            category=ActivityEvent.Categories.MESSAGE,
            source=conversation.channel,
            text=message.text[:240] or ("Получено сообщение" if message.direction == BotMessage.Directions.INBOUND else "Отправлено сообщение"),
            metadata={"conversation_id": conversation.id, "lead_id": conversation.lead_id},
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
            action_url=f"/dashboard/conversations?conversation={conversation.id}",
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


def assign_conversation(conversation, user):
    conversation.assigned_to = user
    conversation.save(update_fields=["assigned_to", "updated_at"])
    return conversation


def handoff_conversation(conversation, reason=""):
    conversation.handoff_required = True
    conversation.handoff_reason = reason
    conversation.bot_enabled = False
    conversation.save(update_fields=["handoff_required", "handoff_reason", "bot_enabled", "updated_at"])
    return conversation


def send_outbound_message(conversation, text, user, sender_type=BotMessage.SenderTypes.MANAGER):
    assert_entitlement_allows(conversation.business, EntitlementMetrics.BOT_MESSAGES)
    status = BotMessage.Statuses.QUEUED
    error_text = ""
    delivery_payload = {"delivery_mode": "provider_not_connected"}
    channel = BotChannel.objects.filter(bot=conversation.bot, channel=conversation.channel).first()
    if channel and conversation.external_user_id:
        try:
            result = send_message(channel, conversation.external_user_id, text)
        except Exception as exc:
            result = {"ok": False, "mock": False, "reason": str(exc)}
        delivery_payload = {"delivery_mode": "provider", "provider_result": result}
        if result.get("ok") and not result.get("mock"):
            status = BotMessage.Statuses.SENT
        elif result.get("mock"):
            error_text = result.get("reason") or "Provider is running in mock mode."
        else:
            status = BotMessage.Statuses.FAILED
            error_text = result.get("reason") or "Provider delivery failed."
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
        error_text=error_text,
        payload_json={
            "sent_by_user_id": user.id if user and user.is_authenticated else None,
            **delivery_payload,
        },
    )
    register_bot_message(message)
    return message
