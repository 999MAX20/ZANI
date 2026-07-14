from datetime import datetime

from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.automations.engine import run_automations_for_event
from apps.automations.models import AutomationRule
from apps.billing.models import UsageCounter
from apps.billing.usage import increment_usage
from apps.bots.models import Bot, BotChannel, BotConversation, BotMessage
from apps.conversations.auto_pipeline import maybe_run_auto_pipeline
from apps.integrations.crm_mapping import record_message_received_event
from apps.integrations.models import IntegrationEventLog
from apps.integrations.sanitization import sanitize_config
from apps.integrations.whatsapp_credentials import (
    get_whatsapp_access_token,
    get_whatsapp_connector,
    has_whatsapp_access_token,
    store_whatsapp_access_token,
)
from apps.notifications.delivery import handle_appointment_followup_reply
from apps.outreach.consent import record_inbound_consent


def verify_whatsapp_secret(request):
    from apps.integrations.providers.whatsapp import WhatsAppProvider

    return WhatsAppProvider().verify_webhook(request)


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
    from apps.integrations.providers.whatsapp import WhatsAppProvider

    parsed = WhatsAppProvider().parse_webhook(payload, headers=headers or {})
    if not parsed.get("sender_id"):
        raise ValidationError("WhatsApp sender id is missing.")
    if not parsed.get("text"):
        raise ValidationError("WhatsApp message text is missing.")
    return parsed


def process_whatsapp_statuses(payload, provided_secret=""):
    statuses = []
    phone_number_id = ""
    for entry in payload.get("entry") or []:
        for change in entry.get("changes") or []:
            value = change.get("value") or {}
            metadata = value.get("metadata") or {}
            phone_number_id = phone_number_id or str(metadata.get("phone_number_id") or "")
            statuses.extend(value.get("statuses") or [])
    if not statuses:
        return None

    channel = resolve_whatsapp_channel(provided_secret, phone_number_id=phone_number_id)
    business = channel.bot.business
    safe_payload = sanitize_config(payload)
    processed = 0
    for item in statuses:
        message_id = str(item.get("id") or "")
        status = str(item.get("status") or "")
        if not message_id:
            continue
        message = BotMessage.objects.filter(
            conversation__business=business,
            conversation__channel=BotConversation.Channels.WHATSAPP,
            direction=BotMessage.Directions.OUTBOUND,
            external_message_id=message_id,
        ).first()
        if not message:
            continue
        timestamp = _whatsapp_timestamp(item.get("timestamp"))
        update_fields = ["payload_json"]
        payload_json = dict(message.payload_json or {})
        payload_json["whatsapp_status"] = sanitize_config(item)
        message.payload_json = payload_json
        if status == "sent":
            message.status = BotMessage.Statuses.SENT
            message.sent_at = message.sent_at or timestamp
            update_fields.extend(["status", "sent_at"])
        elif status == "delivered":
            message.status = BotMessage.Statuses.SENT
            message.delivered_at = message.delivered_at or timestamp
            update_fields.extend(["status", "delivered_at"])
        elif status == "read":
            message.status = BotMessage.Statuses.SENT
            message.read_at = message.read_at or timestamp
            message.delivered_at = message.delivered_at or timestamp
            update_fields.extend(["status", "read_at", "delivered_at"])
        elif status == "failed":
            message.status = BotMessage.Statuses.FAILED
            message.error_text = _whatsapp_status_error(item)
            update_fields.extend(["status", "error_text"])
        message.save(update_fields=list(dict.fromkeys(update_fields)))
        processed += 1

    IntegrationEventLog.objects.create(
        business=business,
        provider=BotChannel.Channels.WHATSAPP,
        channel=BotChannel.Channels.WHATSAPP,
        direction=IntegrationEventLog.Directions.INBOUND,
        payload_json={"payload": safe_payload, "statuses": len(statuses), "processed": processed},
        status=IntegrationEventLog.Statuses.PROCESSED,
    )
    return {"processed": processed, "statuses": len(statuses)}


def _whatsapp_timestamp(value):
    try:
        if value:
            return datetime.fromtimestamp(int(value), tz=timezone.get_current_timezone())
    except (TypeError, ValueError, OSError):
        pass
    return timezone.now()


def _whatsapp_status_error(item):
    errors = item.get("errors") or []
    if not errors:
        return "WhatsApp delivery failed."
    error = errors[0]
    return str(error.get("title") or error.get("message") or error.get("code") or "WhatsApp delivery failed.")


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
    from apps.bots.inbox_service import register_bot_message

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
    record_message_received_event(conversation=conversation, message=message, provider=BotConversation.Channels.WHATSAPP)
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
    from apps.integrations.providers.whatsapp import WhatsAppProvider

    return WhatsAppProvider().send_message(channel, recipient_id, text)
