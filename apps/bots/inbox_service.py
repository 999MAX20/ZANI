from django.db.models import F
from django.utils import timezone

from apps.activities.models import ActivityEvent
from apps.activities.services import create_activity_event
from apps.billing.models import UsageCounter
from apps.billing.usage import increment_usage
from apps.bots.models import BotChannel, BotMessage
from apps.integrations.providers import send_message


def register_bot_message(message):
    conversation = message.conversation
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
    status = BotMessage.Statuses.QUEUED
    delivery_payload = {"delivery_mode": "provider_not_connected"}
    channel = BotChannel.objects.filter(bot=conversation.bot, channel=conversation.channel).first()
    if channel and conversation.external_user_id:
        result = send_message(channel, conversation.external_user_id, text)
        delivery_payload = {"delivery_mode": "provider", "provider_result": result}
        if result.get("ok") and not result.get("mock"):
            status = BotMessage.Statuses.SENT

    message = BotMessage.objects.create(
        conversation=conversation,
        direction=BotMessage.Directions.OUTBOUND,
        sender_type=sender_type,
        text=text,
        status=status,
        payload_json={
            "sent_by_user_id": user.id if user and user.is_authenticated else None,
            **delivery_payload,
        },
    )
    register_bot_message(message)
    return message
