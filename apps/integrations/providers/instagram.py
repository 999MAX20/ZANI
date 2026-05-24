from apps.integrations.models import IntegrationEventLog
from apps.integrations.providers.base import BaseChannelProvider


class BaseInstagramAdapter(BaseChannelProvider):
    provider = "instagram"
    adapter = "base"

    def parse_webhook(self, payload, headers=None):
        message = payload.get("message") or payload.get("text") or ""
        sender = payload.get("sender") or payload.get("from") or {}
        if isinstance(sender, dict):
            sender_id = str(sender.get("id") or sender.get("username") or "")
            username = sender.get("username") or ""
        else:
            sender_id = str(sender or "")
            username = payload.get("username") or ""
        return {
            "sender_id": sender_id,
            "username": username,
            "text": str(message),
            "payload": payload,
            "headers": headers or {},
        }


class InstagramMetaPlaceholderAdapter(BaseInstagramAdapter):
    adapter = "meta_placeholder"

    def send_message(self, channel, recipient_id, text, payload=None):
        self.log_event(
            business=channel.bot.business,
            channel=channel.channel,
            direction=IntegrationEventLog.Directions.OUTBOUND,
            payload={"recipient_id": recipient_id, "text": text, "adapter": self.adapter, **(payload or {})},
            status=IntegrationEventLog.Statuses.MOCKED,
        )
        return {
            "ok": True,
            "mock": True,
            "provider": self.provider,
            "adapter": self.adapter,
            "reason": "Instagram Meta provider is request-only for this pilot.",
        }
