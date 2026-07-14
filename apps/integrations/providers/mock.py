from apps.integrations.models import IntegrationEventLog
from apps.integrations.providers.base import BaseChannelProvider


class MockChannelProvider(BaseChannelProvider):
    provider = "mock"

    def __init__(self, provider):
        self.provider = provider

    def send_message(self, channel, recipient_id, text, payload=None):
        self.log_event(
            business=getattr(channel.bot, "business", None),
            channel=getattr(channel, "channel", ""),
            direction=IntegrationEventLog.Directions.OUTBOUND,
            payload={"recipient_id": recipient_id, "text": text, **(payload or {})},
            status=IntegrationEventLog.Statuses.MOCKED,
        )
        return {"ok": True, "mock": True, "provider": self.provider}

    def parse_webhook(self, payload, headers=None):
        return {"payload": payload, "headers": headers or {}, "mock": True}
