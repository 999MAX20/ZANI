import json
from urllib import request as urllib_request

from django.conf import settings
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.automations.engine import run_automations_for_event
from apps.automations.models import AutomationRule
from apps.bots.models import Bot, BotChannel, BotConversation, BotMessage


TELEGRAM_SECRET_HEADER = "HTTP_X_TELEGRAM_BOT_API_SECRET_TOKEN"


def verify_telegram_secret(request):
    expected_secret = settings.TELEGRAM_WEBHOOK_SECRET
    provided_secret = request.META.get(TELEGRAM_SECRET_HEADER, "")
    if expected_secret and provided_secret != expected_secret:
        raise PermissionDenied("Invalid Telegram webhook secret.")
    return provided_secret


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
    message = update.get("message") or update.get("edited_message")
    if not message:
        raise ValidationError("Unsupported Telegram update payload.")

    chat = message.get("chat") or {}
    sender = message.get("from") or {}
    chat_id = chat.get("id")
    text = message.get("text") or message.get("caption") or ""
    if not chat_id:
        raise ValidationError("Telegram chat id is missing.")

    return {
        "chat_id": str(chat_id),
        "sender_id": str(sender.get("id") or ""),
        "username": sender.get("username") or "",
        "text": text,
        "message": message,
    }


def save_telegram_inbound_message(update, provided_secret):
    channel = resolve_telegram_channel(provided_secret)
    parsed = parse_inbound_update(update)
    business = channel.bot.business

    conversation, _ = BotConversation.objects.get_or_create(
        business=business,
        bot=channel.bot,
        channel=BotConversation.Channels.TELEGRAM,
        external_user_id=parsed["chat_id"],
        defaults={"status": BotConversation.Statuses.OPEN},
    )
    conversation.updated_at = timezone.now()
    conversation.save(update_fields=["updated_at"])

    message = BotMessage.objects.create(
        conversation=conversation,
        direction=BotMessage.Directions.INBOUND,
        text=parsed["text"],
        payload_json={
            "telegram_update": update,
            "telegram_chat_id": parsed["chat_id"],
            "telegram_sender_id": parsed["sender_id"],
            "telegram_username": parsed["username"],
        },
        status=BotMessage.Statuses.RECEIVED,
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
    token = channel.config_json.get("bot_token", "")
    if not settings.TELEGRAM_ENABLED or not token:
        return {"ok": True, "mock": True, "reason": "Telegram disabled or bot token missing."}

    url = f"{settings.TELEGRAM_BASE_API_URL}/bot{token}/sendMessage"
    payload = json.dumps({"chat_id": chat_id, "text": text}).encode("utf-8")
    request = urllib_request.Request(url, data=payload, headers={"Content-Type": "application/json"}, method="POST")
    with urllib_request.urlopen(request, timeout=10) as response:
        return json.loads(response.read().decode("utf-8"))
