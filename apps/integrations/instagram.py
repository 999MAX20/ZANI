from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.automations.engine import run_automations_for_event
from apps.automations.models import AutomationRule
from apps.billing.models import UsageCounter
from apps.billing.usage import increment_usage
from apps.bots.inbox_service import register_bot_message
from apps.bots.models import Bot, BotChannel, BotConversation, BotMessage
from apps.conversations.auto_pipeline import maybe_run_auto_pipeline
from apps.integrations.crm_mapping import record_message_received_event
from apps.integrations.models import IntegrationEventLog
from apps.integrations.providers import parse_webhook, send_message, verify_webhook
from apps.integrations.sanitization import sanitize_config


def verify_instagram_secret(request):
    return verify_webhook(BotChannel.Channels.INSTAGRAM, request)


def resolve_instagram_channel(instagram_user_id=""):
    candidates = (
        BotChannel.objects.select_related("bot", "bot__business")
        .filter(channel=BotChannel.Channels.INSTAGRAM, status__in=[BotChannel.Statuses.DRAFT, BotChannel.Statuses.ACTIVE])
        .exclude(bot__status=Bot.Statuses.PAUSED)
    )
    if instagram_user_id:
        channel = candidates.filter(config_json__instagram_user_id=instagram_user_id).first() or candidates.filter(external_id=instagram_user_id).first()
        if channel:
            return channel

    raise ValidationError("Instagram channel was not resolved.")


def parse_inbound_message(payload, headers=None):
    parsed = parse_webhook(BotChannel.Channels.INSTAGRAM, payload, headers=headers or {})
    if not parsed.get("sender_id"):
        raise ValidationError("Instagram sender id is missing.")
    if not parsed.get("text"):
        raise ValidationError("Instagram message text is missing.")
    return parsed


def save_instagram_inbound_message(payload, headers=None):
    parsed = parse_inbound_message(payload, headers=headers)
    safe_payload = sanitize_config(payload)
    channel = resolve_instagram_channel(instagram_user_id=parsed.get("instagram_user_id", ""))
    business = channel.bot.business

    conversation, created = BotConversation.objects.get_or_create(
        business=business,
        bot=channel.bot,
        channel=BotConversation.Channels.INSTAGRAM,
        external_user_id=parsed["sender_id"],
        defaults={"status": BotConversation.Statuses.OPEN},
    )
    if created:
        increment_usage(business, UsageCounter.Metrics.CONVERSATIONS)
    conversation.updated_at = timezone.now()
    conversation.save(update_fields=["updated_at"])

    external_message_id = parsed.get("message_id", "")
    if external_message_id:
        existing_message = BotMessage.objects.filter(
            conversation=conversation,
            direction=BotMessage.Directions.INBOUND,
            external_message_id=external_message_id,
        ).first()
        if existing_message:
            IntegrationEventLog.objects.create(
                business=conversation.business,
                provider=BotChannel.Channels.INSTAGRAM,
                channel=BotChannel.Channels.INSTAGRAM,
                direction=IntegrationEventLog.Directions.INBOUND,
                payload_json={
                    "payload": safe_payload,
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
            "instagram_payload": safe_payload,
            "instagram_sender_id": parsed["sender_id"],
            "instagram_user_id": parsed.get("instagram_user_id", ""),
            "instagram_username": parsed.get("username", ""),
        },
        status=BotMessage.Statuses.RECEIVED,
    )
    register_bot_message(message)
    maybe_run_auto_pipeline(conversation=conversation, message=message, channel=channel)
    record_message_received_event(conversation=conversation, message=message, provider=BotConversation.Channels.INSTAGRAM)
    IntegrationEventLog.objects.create(
        business=conversation.business,
        provider=BotChannel.Channels.INSTAGRAM,
        channel=BotChannel.Channels.INSTAGRAM,
        direction=IntegrationEventLog.Directions.INBOUND,
        payload_json={"payload": safe_payload, "conversation_id": conversation.id, "message_id": message.id},
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


def send_instagram_message(channel, recipient_id, text):
    return send_message(channel, recipient_id, text)
