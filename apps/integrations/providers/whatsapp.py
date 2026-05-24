from django.conf import settings
from rest_framework.exceptions import PermissionDenied

from apps.integrations.models import IntegrationEventLog
from apps.integrations.providers.base import BaseChannelProvider


WHATSAPP_SECRET_HEADER = "HTTP_X_ZANI_WHATSAPP_SECRET"


class BaseWhatsAppAdapter(BaseChannelProvider):
    provider = "whatsapp"
    adapter = "base"

    def verify_webhook(self, request):
        expected_secret = getattr(settings, "WHATSAPP_WEBHOOK_SECRET", "")
        provided_secret = request.META.get(WHATSAPP_SECRET_HEADER, "")
        if expected_secret and provided_secret != expected_secret:
            raise PermissionDenied("Invalid WhatsApp webhook secret.")
        return provided_secret

    def parse_webhook(self, payload, headers=None):
        message = payload.get("message") or payload.get("text") or payload.get("body") or ""
        contact = payload.get("contact") or payload.get("from") or {}
        if isinstance(contact, dict):
            sender_id = str(contact.get("id") or contact.get("phone") or contact.get("wa_id") or "")
            sender_name = contact.get("name") or contact.get("profile_name") or ""
        else:
            sender_id = str(contact or payload.get("phone") or payload.get("sender_id") or "")
            sender_name = payload.get("sender_name") or ""

        return {
            "sender_id": sender_id,
            "sender_name": sender_name,
            "message_id": str(payload.get("message_id") or payload.get("id") or ""),
            "text": str(message),
            "payload": payload,
            "headers": headers or {},
        }


class WhatsAppMetaPlaceholderAdapter(BaseWhatsAppAdapter):
    adapter = "meta_cloud_placeholder"

    def send_message(self, channel, recipient_id, text, payload=None):
        return {"ok": False, "mock": False, "provider": self.provider, "adapter": self.adapter, "reason": "Meta Cloud API is not enabled for this pilot."}


class WhatsAppTwilioPlaceholderAdapter(BaseWhatsAppAdapter):
    adapter = "twilio_placeholder"

    def send_message(self, channel, recipient_id, text, payload=None):
        return {"ok": False, "mock": False, "provider": self.provider, "adapter": self.adapter, "reason": "Twilio WhatsApp provider is not enabled for this pilot."}


class WhatsAppDialog360PlaceholderAdapter(BaseWhatsAppAdapter):
    adapter = "360dialog_placeholder"

    def send_message(self, channel, recipient_id, text, payload=None):
        return {"ok": False, "mock": False, "provider": self.provider, "adapter": self.adapter, "reason": "360dialog provider is not enabled for this pilot."}


class WhatsAppQrPilotPlaceholderAdapter(BaseWhatsAppAdapter):
    adapter = "qr_pilot_placeholder"

    def send_message(self, channel, recipient_id, text, payload=None):
        return {"ok": True, "mock": True, "provider": self.provider, "adapter": self.adapter, "reason": "QR pilot is request-only and handled manually."}


class WhatsAppProvider(BaseWhatsAppAdapter):
    adapter = "mock"

    def send_message(self, channel, recipient_id, text, payload=None):
        business = channel.bot.business
        config = channel.config_json or {}
        mode = config.get("provider_mode") or "mock"
        event_payload = {
            "recipient_id": recipient_id,
            "text": text,
            "mode": mode,
            "phone_number_id_configured": bool(config.get("phone_number_id") or channel.external_id),
            **(payload or {}),
        }
        if mode == "disabled":
            self.log_event(
                business=business,
                channel=channel.channel,
                direction=IntegrationEventLog.Directions.OUTBOUND,
                payload=event_payload,
                status=IntegrationEventLog.Statuses.FAILED,
                error="WhatsApp channel is disabled.",
            )
            return {"ok": False, "mock": False, "provider": self.provider, "reason": "WhatsApp channel is disabled."}

        self.log_event(
            business=business,
            channel=channel.channel,
            direction=IntegrationEventLog.Directions.OUTBOUND,
            payload=event_payload,
            status=IntegrationEventLog.Statuses.MOCKED,
        )
        return {"ok": True, "mock": True, "provider": self.provider, "reason": "WhatsApp mock mode. No paid provider configured."}
