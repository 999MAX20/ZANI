from apps.integrations.models import IntegrationEventLog


class BaseChannelProvider:
    provider = "base"

    def send_message(self, channel, recipient_id, text, payload=None):
        raise NotImplementedError

    def parse_webhook(self, payload, headers=None):
        return payload

    def verify_webhook(self, request):
        return True

    def log_event(self, *, business=None, channel="", direction, payload=None, status, error=""):
        return IntegrationEventLog.objects.create(
            business=business,
            provider=self.provider,
            channel=channel,
            direction=direction,
            payload_json=payload or {},
            status=status,
            error=error,
        )
