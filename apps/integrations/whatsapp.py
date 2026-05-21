from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.automations.engine import run_automations_for_event
from apps.automations.models import AutomationRule
from apps.billing.models import UsageCounter
from apps.billing.usage import increment_usage
from apps.bots.inbox_service import register_bot_message
from apps.bots.models import Bot, BotChannel, BotConversation, BotMessage
from apps.integrations.models import IntegrationEventLog
from apps.integrations.providers import parse_webhook, send_message, verify_webhook


def verify_whatsapp_secret(request):
    return verify_webhook(BotChannel.Channels.WHATSAPP, request)


def resolve_whatsapp_channel(provided_secret):
    candidates = (
        BotChannel.objects.select_related("bot", "bot__business")
        .filter(channel=BotChannel.Channels.WHATSAPP, status__in=[BotChannel.Statuses.DRAFT, BotChannel.Statuses.ACTIVE])
        .exclude(bot__status=Bot.Statuses.PAUSED)
    )
    for channel in candidates:
        channel_secret = (channel.config_json or {}).get("webhook_secret")
        if channel_secret and channel_secret == provided_secret:
            return channel

    if candidates.count() == 1 and not provided_secret:
        return candidates.first()

    raise ValidationError("WhatsApp channel was not resolved.")


def parse_inbound_message(payload, headers=None):
    parsed = parse_webhook(BotChannel.Channels.WHATSAPP, payload, headers=headers or {})
    if not parsed.get("sender_id"):
        raise ValidationError("WhatsApp sender id is missing.")
    if not parsed.get("text"):
        raise ValidationError("WhatsApp message text is missing.")
    return parsed


def save_whatsapp_inbound_message(payload, provided_secret, headers=None):
    channel = resolve_whatsapp_channel(provided_secret)
    parsed = parse_inbound_message(payload, headers=headers)
    business = channel.bot.business

    conversation, created = BotConversation.objects.get_or_create(
        business=business,
        bot=channel.bot,
        channel=BotConversation.Channels.WHATSAPP,
        external_user_id=parsed["sender_id"],
        defaults={"status": BotConversation.Statuses.OPEN},
    )
    if created:
        increment_usage(business, UsageCounter.Metrics.CONVERSATIONS)
    conversation.updated_at = timezone.now()
    conversation.save(update_fields=["updated_at"])

    message = BotMessage.objects.create(
        conversation=conversation,
        direction=BotMessage.Directions.INBOUND,
        sender_type=BotMessage.SenderTypes.CLIENT,
        text=parsed["text"],
        external_message_id=parsed.get("message_id", ""),
        payload_json={
            "whatsapp_payload": payload,
            "whatsapp_sender_id": parsed["sender_id"],
            "whatsapp_sender_name": parsed.get("sender_name", ""),
        },
        status=BotMessage.Statuses.RECEIVED,
    )
    register_bot_message(message)
    IntegrationEventLog.objects.create(
        business=conversation.business,
        provider=BotChannel.Channels.WHATSAPP,
        channel=BotChannel.Channels.WHATSAPP,
        direction=IntegrationEventLog.Directions.INBOUND,
        payload_json={"payload": payload, "conversation_id": conversation.id, "message_id": message.id},
        status=IntegrationEventLog.Statuses.PROCESSED,
    )
    run_automations_for_event(
        business=conversation.business,
        trigger_type=AutomationRule.TriggerTypes.BOT_MESSAGE_RECEIVED,
        entity=conversation,
        payload={
            "trigger_type": AutomationRule.TriggerTypes.BOT_MESSAGE_RECEIVED,
            "conversation_id": conversation.id,
            "message_id": message.id,
            "text": message.text,
        },
    )
    return conversation, message


def send_whatsapp_message(channel, recipient_id, text):
    return send_message(channel, recipient_id, text)
