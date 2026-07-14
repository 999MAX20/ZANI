import json
from urllib import parse as urllib_parse
from urllib import request as urllib_request

from django.conf import settings
from rest_framework.exceptions import PermissionDenied

from apps.core.production_rules import is_local_or_private_hostname
from apps.core.security_config import has_strong_shared_secret
from apps.integrations.models import IntegrationEventLog
from apps.integrations.providers.base import BaseChannelProvider


TELEGRAM_SECRET_HEADER = "HTTP_X_TELEGRAM_BOT_API_SECRET_TOKEN"


class TelegramProvider(BaseChannelProvider):
    provider = "telegram"

    def _safe_base_api_url(self):
        base_url = str(settings.TELEGRAM_BASE_API_URL or "").strip().rstrip("/")
        parsed = urllib_parse.urlparse(base_url)
        if parsed.scheme != "https" or not parsed.hostname:
            return "", "Telegram base API URL must be an absolute HTTPS URL."
        if parsed.username or parsed.password or parsed.fragment:
            return "", "Telegram base API URL must not include credentials or a fragment."
        if is_local_or_private_hostname(parsed.hostname):
            return "", "Telegram base API URL must use a public hostname."
        return base_url, ""

    def _unsafe_base_api_result(self, business, channel, direction, payload):
        _, reason = self._safe_base_api_url()
        self.log_event(
            business=business,
            channel=channel.channel,
            direction=direction,
            payload=payload,
            status=IntegrationEventLog.Statuses.FAILED,
            error=reason,
        )
        return {"ok": False, "reason": reason}

    def _safe_webhook_url(self, webhook_url):
        parsed = urllib_parse.urlparse(str(webhook_url or "").strip())
        if parsed.scheme != "https" or not parsed.hostname:
            return False, "Telegram webhook URL must be an absolute HTTPS URL."
        if parsed.username or parsed.password or parsed.fragment:
            return False, "Telegram webhook URL must not include credentials or a fragment."
        if is_local_or_private_hostname(parsed.hostname):
            return False, "Telegram webhook URL must use a public hostname."
        return True, ""

    def verify_webhook(self, request):
        expected_secret = settings.TELEGRAM_WEBHOOK_SECRET
        provided_secret = request.META.get(TELEGRAM_SECRET_HEADER, "")
        if expected_secret and has_strong_shared_secret(expected_secret) and provided_secret == expected_secret:
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

        base_url, _ = self._safe_base_api_url()
        if not base_url:
            return self._unsafe_base_api_result(business, channel, IntegrationEventLog.Directions.OUTBOUND, event_payload)

        url = f"{base_url}/bot{token}/sendMessage"
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

        base_url, _ = self._safe_base_api_url()
        if not base_url:
            result = self._unsafe_base_api_result(business, channel, IntegrationEventLog.Directions.OUTBOUND, safe_payload)
            result["token_configured"] = True
            return result

        url = f"{base_url}/bot{token}/getMe"
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

        base_url, _ = self._safe_base_api_url()
        if not base_url:
            result = self._unsafe_base_api_result(business, channel, IntegrationEventLog.Directions.INBOUND, safe_payload)
            result["result"] = []
            return result

        params = {"limit": max(1, min(int(limit or 20), 100))}
        if offset is not None:
            params["offset"] = int(offset)
        url = f"{base_url}/bot{token}/getUpdates?{urllib_parse.urlencode(params)}"
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
        if not has_strong_shared_secret(webhook_secret):
            self.log_event(
                business=business,
                channel=channel.channel,
                direction=IntegrationEventLog.Directions.OUTBOUND,
                payload=safe_payload,
                status=IntegrationEventLog.Statuses.FAILED,
                error="Telegram webhook secret is too weak.",
            )
            return {"ok": False, "reason": "Telegram webhook secret is too weak."}

        base_url, _ = self._safe_base_api_url()
        if not base_url:
            return self._unsafe_base_api_result(business, channel, IntegrationEventLog.Directions.OUTBOUND, safe_payload)
        webhook_url_safe, reason = self._safe_webhook_url(webhook_url)
        if not webhook_url_safe:
            self.log_event(
                business=business,
                channel=channel.channel,
                direction=IntegrationEventLog.Directions.OUTBOUND,
                payload=safe_payload,
                status=IntegrationEventLog.Statuses.FAILED,
                error=reason,
            )
            return {"ok": False, "reason": reason}

        url = f"{base_url}/bot{token}/setWebhook"
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
