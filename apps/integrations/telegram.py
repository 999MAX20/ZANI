from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.automations.engine import run_automations_for_event
from apps.automations.models import AutomationRule
from apps.billing.models import UsageCounter
from apps.billing.usage import increment_usage
from apps.bots.inbox_service import register_bot_message
from apps.bots.models import Bot, BotChannel, BotConversation, BotMessage
from apps.integrations.models import IntegrationEventLog
from apps.integrations.providers import get_provider, parse_webhook, send_message, verify_webhook


TELEGRAM_SECRET_HEADER = "HTTP_X_TELEGRAM_BOT_API_SECRET_TOKEN"


def verify_telegram_secret(request):
    return verify_webhook(BotChannel.Channels.TELEGRAM, request)


def resolve_telegram_channel(provided_secret):
    candidates = (
        BotChannel.objects.select_related("bot", "bot__business")
        .filter(channel=BotChannel.Channels.TELEGRAM, status__in=[BotChannel.Statuses.DRAFT, BotChannel.Statuses.ACTIVE])
        .exclude(bot__status=Bot.Statuses.PAUSED)
    )
    for channel in candidates:
        channel_secret = channel.config_json.get("webhook_secret")
        if channel_secret and channel_secret == provided_secret:
            return channel

    if candidates.count() == 1 and not provided_secret:
        return candidates.first()

    raise ValidationError("Telegram bot channel was not resolved.")


def parse_inbound_update(update):
    parsed = parse_webhook(BotChannel.Channels.TELEGRAM, update)
    if parsed.get("unsupported"):
        raise ValidationError("Unsupported Telegram update payload.")
    if not parsed.get("chat_id"):
        raise ValidationError("Telegram chat id is missing.")
    return parsed


def save_telegram_inbound_message(update, provided_secret):
    channel = resolve_telegram_channel(provided_secret)
    parsed = parse_inbound_update(update)
    business = channel.bot.business

    conversation, created = BotConversation.objects.get_or_create(
        business=business,
        bot=channel.bot,
        channel=BotConversation.Channels.TELEGRAM,
        external_user_id=parsed["chat_id"],
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
        payload_json={
            "telegram_update": update,
            "telegram_chat_id": parsed["chat_id"],
            "telegram_sender_id": parsed["sender_id"],
            "telegram_username": parsed["username"],
        },
        status=BotMessage.Statuses.RECEIVED,
    )
    register_bot_message(message)
    IntegrationEventLog.objects.create(
        business=conversation.business,
        provider=BotChannel.Channels.TELEGRAM,
        channel=BotChannel.Channels.TELEGRAM,
        direction=IntegrationEventLog.Directions.INBOUND,
        payload_json={"update": update, "conversation_id": conversation.id, "message_id": message.id},
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


def send_telegram_message(channel, chat_id, text):
    return send_message(channel, chat_id, text)


def set_telegram_webhook(channel, webhook_url):
    return get_provider(BotChannel.Channels.TELEGRAM).set_webhook(channel, webhook_url)
