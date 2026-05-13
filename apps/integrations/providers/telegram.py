import json
from urllib import request as urllib_request

from django.conf import settings
from rest_framework.exceptions import PermissionDenied

from apps.integrations.models import IntegrationEventLog
from apps.integrations.providers.base import BaseChannelProvider


TELEGRAM_SECRET_HEADER = "HTTP_X_TELEGRAM_BOT_API_SECRET_TOKEN"


class TelegramProvider(BaseChannelProvider):
    provider = "telegram"

    def verify_webhook(self, request):
        expected_secret = settings.TELEGRAM_WEBHOOK_SECRET
        provided_secret = request.META.get(TELEGRAM_SECRET_HEADER, "")
        if expected_secret and provided_secret != expected_secret:
            raise PermissionDenied("Invalid Telegram webhook secret.")
        return provided_secret

    def parse_webhook(self, payload, headers=None):
        message = payload.get("message") or payload.get("edited_message")
        if not message:
            return {"unsupported": True, "payload": payload}
        chat = message.get("chat") or {}
        sender = message.get("from") or {}
        return {
            "chat_id": str(chat.get("id") or ""),
            "sender_id": str(sender.get("id") or ""),
            "username": sender.get("username") or "",
            "text": message.get("text") or message.get("caption") or "",
            "message": message,
        }

    def send_message(self, channel, recipient_id, text, payload=None):
        business = channel.bot.business
        token = channel.config_json.get("bot_token", "")
        event_payload = {"recipient_id": recipient_id, "text": text, **(payload or {})}
        if not settings.TELEGRAM_ENABLED or not token:
            self.log_event(
                business=business,
                channel=channel.channel,
                direction=IntegrationEventLog.Directions.OUTBOUND,
                payload=event_payload,
                status=IntegrationEventLog.Statuses.MOCKED,
            )
            return {"ok": True, "mock": True, "reason": "Telegram disabled or bot token missing."}

        url = f"{settings.TELEGRAM_BASE_API_URL}/bot{token}/sendMessage"
        request = urllib_request.Request(
            url,
            data=json.dumps({"chat_id": recipient_id, "text": text}).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib_request.urlopen(request, timeout=10) as response:
                result = json.loads(response.read().decode("utf-8"))
            self.log_event(
                business=business,
                channel=channel.channel,
                direction=IntegrationEventLog.Directions.OUTBOUND,
                payload={**event_payload, "provider_response": result},
                status=IntegrationEventLog.Statuses.SENT,
            )
            return result
        except Exception as exc:
            self.log_event(
                business=business,
                channel=channel.channel,
                direction=IntegrationEventLog.Directions.OUTBOUND,
                payload=event_payload,
                status=IntegrationEventLog.Statuses.FAILED,
                error=str(exc),
            )
            raise

    def set_webhook(self, channel, webhook_url):
        business = channel.bot.business
        token = channel.config_json.get("bot_token", "")
        safe_payload = {"webhook_url": webhook_url, "token_configured": bool(token)}
        if not settings.TELEGRAM_ENABLED or not token:
            self.log_event(
                business=business,
                channel=channel.channel,
                direction=IntegrationEventLog.Directions.OUTBOUND,
                payload=safe_payload,
                status=IntegrationEventLog.Statuses.MOCKED,
            )
            return {"ok": True, "mock": True, "reason": "Telegram disabled or bot token missing."}

        url = f"{settings.TELEGRAM_BASE_API_URL}/bot{token}/setWebhook"
        request = urllib_request.Request(
            url,
            data=json.dumps({"url": webhook_url}).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib_request.urlopen(request, timeout=10) as response:
                result = json.loads(response.read().decode("utf-8"))
            self.log_event(
                business=business,
                channel=channel.channel,
                direction=IntegrationEventLog.Directions.OUTBOUND,
                payload={**safe_payload, "provider_response": result},
                status=IntegrationEventLog.Statuses.SENT,
            )
            return result
        except Exception as exc:
            self.log_event(
                business=business,
                channel=channel.channel,
                direction=IntegrationEventLog.Directions.OUTBOUND,
                payload=safe_payload,
                status=IntegrationEventLog.Statuses.FAILED,
                error=str(exc),
            )
            raise
