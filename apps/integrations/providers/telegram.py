import json
from urllib import parse as urllib_parse
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
        if expected_secret and provided_secret == expected_secret:
            return provided_secret
        if provided_secret and self._is_channel_secret(provided_secret):
            return provided_secret
        if expected_secret:
            raise PermissionDenied("Invalid Telegram webhook secret.")
        return provided_secret

    def _is_channel_secret(self, provided_secret):
        from apps.bots.models import Bot, BotChannel

        return BotChannel.objects.filter(
            channel=BotChannel.Channels.TELEGRAM,
            status__in=[BotChannel.Statuses.DRAFT, BotChannel.Statuses.ACTIVE],
            bot__status__in=[Bot.Statuses.DRAFT, Bot.Statuses.ACTIVE],
            config_json__webhook_secret=provided_secret,
        ).exists()

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
            "message_id": str(message.get("message_id") or ""),
            "text": message.get("text") or message.get("caption") or "",
            "message": message,
        }

    def send_message(self, channel, recipient_id, text, payload=None):
        business = channel.bot.business
        token = channel.config_json.get("bot_token", "")
        event_payload = {"recipient_id": recipient_id, "text": text, **(payload or {})}
        if not settings.TELEGRAM_ENABLED:
            self.log_event(
                business=business,
                channel=channel.channel,
                direction=IntegrationEventLog.Directions.OUTBOUND,
                payload=event_payload,
                status=IntegrationEventLog.Statuses.FAILED,
                error="Telegram integration is disabled.",
            )
            return {"ok": False, "reason": "Telegram integration is disabled."}
        if not token:
            self.log_event(
                business=business,
                channel=channel.channel,
                direction=IntegrationEventLog.Directions.OUTBOUND,
                payload=event_payload,
                status=IntegrationEventLog.Statuses.FAILED,
                error="Telegram bot token is missing.",
            )
            return {"ok": False, "reason": "Telegram bot token is missing."}

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

    def validate_token(self, channel):
        business = channel.bot.business
        token = channel.config_json.get("bot_token", "")
        safe_payload = {"token_configured": bool(token)}
        if not token:
            return {
                "ok": False,
                "reason": "Telegram bot token is missing.",
                "token_configured": False,
            }
        if not settings.TELEGRAM_ENABLED:
            self.log_event(
                business=business,
                channel=channel.channel,
                direction=IntegrationEventLog.Directions.OUTBOUND,
                payload=safe_payload,
                status=IntegrationEventLog.Statuses.FAILED,
                error="Telegram integration is disabled.",
            )
            return {
                "ok": False,
                "reason": "Telegram integration is disabled.",
                "token_configured": True,
            }

        url = f"{settings.TELEGRAM_BASE_API_URL}/bot{token}/getMe"
        request = urllib_request.Request(url, method="GET")
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
            return {
                "ok": bool(result.get("ok")),
                "token_configured": True,
                "bot": result.get("result") or {},
            }
        except Exception as exc:
            self.log_event(
                business=business,
                channel=channel.channel,
                direction=IntegrationEventLog.Directions.OUTBOUND,
                payload=safe_payload,
                status=IntegrationEventLog.Statuses.FAILED,
                error=str(exc),
            )
            return {"ok": False, "reason": str(exc), "token_configured": True}

    def get_updates(self, channel, *, offset=None, limit=20):
        business = channel.bot.business
        token = channel.config_json.get("bot_token", "")
        safe_payload = {"token_configured": bool(token), "offset": offset, "limit": limit}
        if not settings.TELEGRAM_ENABLED:
            self.log_event(
                business=business,
                channel=channel.channel,
                direction=IntegrationEventLog.Directions.INBOUND,
                payload=safe_payload,
                status=IntegrationEventLog.Statuses.FAILED,
                error="Telegram integration is disabled.",
            )
            return {"ok": False, "result": [], "reason": "Telegram integration is disabled."}
        if not token:
            self.log_event(
                business=business,
                channel=channel.channel,
                direction=IntegrationEventLog.Directions.INBOUND,
                payload=safe_payload,
                status=IntegrationEventLog.Statuses.FAILED,
                error="Telegram bot token is missing.",
            )
            return {"ok": False, "result": [], "reason": "Telegram bot token is missing."}

        params = {"limit": max(1, min(int(limit or 20), 100))}
        if offset is not None:
            params["offset"] = int(offset)
        url = f"{settings.TELEGRAM_BASE_API_URL}/bot{token}/getUpdates?{urllib_parse.urlencode(params)}"
        request = urllib_request.Request(url, method="GET")
        try:
            with urllib_request.urlopen(request, timeout=10) as response:
                result = json.loads(response.read().decode("utf-8"))
            self.log_event(
                business=business,
                channel=channel.channel,
                direction=IntegrationEventLog.Directions.INBOUND,
                payload={**safe_payload, "updates_count": len(result.get("result") or [])},
                status=IntegrationEventLog.Statuses.SENT if result.get("ok") else IntegrationEventLog.Statuses.FAILED,
                error="" if result.get("ok") else str(result.get("description") or ""),
            )
            return result
        except Exception as exc:
            self.log_event(
                business=business,
                channel=channel.channel,
                direction=IntegrationEventLog.Directions.INBOUND,
                payload=safe_payload,
                status=IntegrationEventLog.Statuses.FAILED,
                error=str(exc),
            )
            return {"ok": False, "result": [], "reason": str(exc)}

    def set_webhook(self, channel, webhook_url):
        business = channel.bot.business
        token = channel.config_json.get("bot_token", "")
        webhook_secret = channel.config_json.get("webhook_secret", "")
        safe_payload = {
            "webhook_url": webhook_url,
            "token_configured": bool(token),
            "webhook_secret_configured": bool(webhook_secret),
        }
        if not settings.TELEGRAM_ENABLED:
            self.log_event(
                business=business,
                channel=channel.channel,
                direction=IntegrationEventLog.Directions.OUTBOUND,
                payload=safe_payload,
                status=IntegrationEventLog.Statuses.FAILED,
                error="Telegram integration is disabled.",
            )
            return {"ok": False, "reason": "Telegram integration is disabled."}
        if not token:
            self.log_event(
                business=business,
                channel=channel.channel,
                direction=IntegrationEventLog.Directions.OUTBOUND,
                payload=safe_payload,
                status=IntegrationEventLog.Statuses.FAILED,
                error="Telegram bot token is missing.",
            )
            return {"ok": False, "reason": "Telegram bot token is missing."}
        if not webhook_secret:
            self.log_event(
                business=business,
                channel=channel.channel,
                direction=IntegrationEventLog.Directions.OUTBOUND,
                payload=safe_payload,
                status=IntegrationEventLog.Statuses.FAILED,
                error="Telegram webhook secret is missing.",
            )
            return {"ok": False, "reason": "Telegram webhook secret is missing."}

        url = f"{settings.TELEGRAM_BASE_API_URL}/bot{token}/setWebhook"
        request = urllib_request.Request(
            url,
            data=json.dumps({"url": webhook_url, "secret_token": webhook_secret}).encode("utf-8"),
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
