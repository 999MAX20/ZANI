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
from apps.integrations.providers import parse_webhook, send_message, verify_webhook
from apps.integrations.sanitization import sanitize_config
from apps.notifications.delivery import handle_appointment_followup_reply
from apps.outreach.consent import record_inbound_consent


def verify_whatsapp_secret(request):
    return verify_webhook(BotChannel.Channels.WHATSAPP, request)


def resolve_whatsapp_channel(provided_secret="", phone_number_id=""):
    candidates = (
        BotChannel.objects.select_related("bot", "bot__business")
        .filter(channel=BotChannel.Channels.WHATSAPP, status__in=[BotChannel.Statuses.DRAFT, BotChannel.Statuses.ACTIVE])
        .exclude(bot__status=Bot.Statuses.PAUSED)
    )
    if phone_number_id:
        channel = candidates.filter(config_json__phone_number_id=phone_number_id).first() or candidates.filter(external_id=phone_number_id).first()
        if channel:
            return channel

    for channel in candidates:
        channel_secret = (channel.config_json or {}).get("webhook_secret")
        if channel_secret and channel_secret == provided_secret:
            return channel

    if not provided_secret and not phone_number_id:
        raise PermissionDenied("WhatsApp webhook secret or phone number id is required.")

    raise ValidationError("WhatsApp channel was not resolved.")


def parse_inbound_message(payload, headers=None):
    parsed = parse_webhook(BotChannel.Channels.WHATSAPP, payload, headers=headers or {})
    if not parsed.get("sender_id"):
        raise ValidationError("WhatsApp sender id is missing.")
    if not parsed.get("text"):
        raise ValidationError("WhatsApp message text is missing.")
    return parsed


def save_whatsapp_inbound_message(payload, provided_secret="", headers=None):
    parsed = parse_inbound_message(payload, headers=headers)
    safe_payload = sanitize_config(payload)
    channel = resolve_whatsapp_channel(provided_secret, phone_number_id=parsed.get("phone_number_id", ""))
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
                provider=BotChannel.Channels.WHATSAPP,
                channel=BotChannel.Channels.WHATSAPP,
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
            "whatsapp_payload": safe_payload,
            "whatsapp_sender_id": parsed["sender_id"],
            "whatsapp_sender_name": parsed.get("sender_name", ""),
            "whatsapp_phone_number_id": parsed.get("phone_number_id", ""),
            "whatsapp_display_phone_number": parsed.get("display_phone_number", ""),
        },
        status=BotMessage.Statuses.RECEIVED,
    )
    register_bot_message(message)
    handle_appointment_followup_reply(
        business=conversation.business,
        channel=BotConversation.Channels.WHATSAPP,
        external_user_id=conversation.external_user_id,
        text=message.text,
    )
    maybe_run_auto_pipeline(conversation=conversation, message=message, channel=channel)
    record_inbound_consent(
        business=conversation.business,
        channel=BotConversation.Channels.WHATSAPP,
        external_user_id=conversation.external_user_id,
        text=message.text,
        conversation=conversation,
    )
    IntegrationEventLog.objects.create(
        business=conversation.business,
        provider=BotChannel.Channels.WHATSAPP,
        channel=BotChannel.Channels.WHATSAPP,
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


def send_whatsapp_message(channel, recipient_id, text):
    return send_message(channel, recipient_id, text)
