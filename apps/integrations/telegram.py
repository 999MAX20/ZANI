from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.automations.engine import run_automations_for_event
from apps.automations.models import AutomationRule
from apps.billing.models import UsageCounter
from apps.billing.usage import increment_usage
from apps.bots.inbox_service import register_bot_message
from apps.bots.models import Bot, BotChannel, BotConversation, BotMessage
from apps.conversations.auto_pipeline import maybe_run_auto_pipeline
from apps.integrations.models import IntegrationEventLog
from apps.integrations.crm_mapping import record_message_received_event
from apps.integrations.providers import get_provider, parse_webhook, send_message, verify_webhook
from apps.notifications.delivery import handle_appointment_followup_reply
from apps.outreach.consent import record_inbound_consent
from apps.integrations.sanitization import sanitize_config


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

    if not provided_secret:
        raise PermissionDenied("Telegram webhook secret is required.")

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
    safe_update = sanitize_config(update)
    business = channel.bot.business
    external_message_id = parsed.get("message_id") or str(update.get("update_id") or "")

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

    if external_message_id:
        existing_message = BotMessage.objects.filter(
            conversation=conversation,
            direction=BotMessage.Directions.INBOUND,
            external_message_id=external_message_id,
        ).first()
        if existing_message:
            IntegrationEventLog.objects.create(
                business=conversation.business,
                provider=BotChannel.Channels.TELEGRAM,
                channel=BotChannel.Channels.TELEGRAM,
                direction=IntegrationEventLog.Directions.INBOUND,
                payload_json={
                    "update": safe_update,
                    "conversation_id": conversation.id,
                    "message_id": existing_message.id,
                    "duplicate": True,
                },
                status=IntegrationEventLog.Statuses.PROCESSED,
            )
            return conversation, existing_message

    message = BotMessage.objects.create(
        conversation=conversation,
        direction=BotMessage.Directions.INBOUND,
        sender_type=BotMessage.SenderTypes.CLIENT,
        text=parsed["text"],
        external_message_id=external_message_id,
        payload_json={
            "telegram_update": safe_update,
            "telegram_chat_id": parsed["chat_id"],
            "telegram_sender_id": parsed["sender_id"],
            "telegram_username": parsed["username"],
            "telegram_message_id": external_message_id,
        },
        status=BotMessage.Statuses.RECEIVED,
    )
    register_bot_message(message)
    handle_appointment_followup_reply(
        business=conversation.business,
        channel=BotConversation.Channels.TELEGRAM,
        external_user_id=conversation.external_user_id,
        text=message.text,
    )
    maybe_run_auto_pipeline(conversation=conversation, message=message, channel=channel)
    record_inbound_consent(
        business=conversation.business,
        channel=BotConversation.Channels.TELEGRAM,
        external_user_id=conversation.external_user_id,
        text=message.text,
        conversation=conversation,
    )
    record_message_received_event(conversation=conversation, message=message, provider=BotConversation.Channels.TELEGRAM)
    IntegrationEventLog.objects.create(
        business=conversation.business,
        provider=BotChannel.Channels.TELEGRAM,
        channel=BotChannel.Channels.TELEGRAM,
        direction=IntegrationEventLog.Directions.INBOUND,
        payload_json={"update": safe_update, "conversation_id": conversation.id, "message_id": message.id},
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


def validate_telegram_token(channel):
    return get_provider(BotChannel.Channels.TELEGRAM).validate_token(channel)


def sync_telegram_updates(channel, limit=20):
    config = dict(channel.config_json or {})
    last_update_id = config.get("last_update_id")
    offset = int(last_update_id) + 1 if last_update_id is not None else None
    result = get_provider(BotChannel.Channels.TELEGRAM).get_updates(channel, offset=offset, limit=limit)
    if not result.get("ok"):
        return {"ok": False, "processed": 0, "updates_count": 0, "reason": result.get("reason") or result.get("description", "")}

    processed = 0
    updates = result.get("result") or []
    webhook_secret = config.get("webhook_secret", "")
    for update in updates:
        update_id = update.get("update_id")
        if update_id is not None:
            config["last_update_id"] = max(int(config.get("last_update_id") or update_id), int(update_id))
        conversation, message = save_telegram_inbound_message(update, webhook_secret)
        if conversation and message:
            processed += 1

    channel.config_json = config
    channel.save(update_fields=["config_json", "updated_at"])
    return {"ok": True, "processed": processed, "updates_count": len(updates)}
