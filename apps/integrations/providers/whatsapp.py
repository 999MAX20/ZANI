import hashlib
import hmac
import json
from urllib import request as urllib_request

from django.conf import settings
from rest_framework.exceptions import PermissionDenied

from apps.core.production_rules import is_safe_public_https_url
from apps.integrations.models import IntegrationEventLog
from apps.integrations.providers.base import BaseChannelProvider


WHATSAPP_SECRET_HEADER = "HTTP_X_ZANI_WHATSAPP_SECRET"
META_SIGNATURE_HEADER = "HTTP_X_HUB_SIGNATURE_256"


class BaseWhatsAppAdapter(BaseChannelProvider):
    provider = "whatsapp"
    adapter = "base"

    def verify_webhook(self, request):
        expected_secret = getattr(settings, "WHATSAPP_WEBHOOK_SECRET", "")
        provided_secret = request.META.get(WHATSAPP_SECRET_HEADER, "")
        if expected_secret and provided_secret != expected_secret:
            raise PermissionDenied("Invalid WhatsApp webhook secret.")
        app_secret = getattr(settings, "WHATSAPP_APP_SECRET", "")
        signature = request.META.get(META_SIGNATURE_HEADER, "")
        if app_secret and signature:
            expected_signature = "sha256=" + hmac.new(
                app_secret.encode("utf-8"),
                request.body,
                hashlib.sha256,
            ).hexdigest()
            if not hmac.compare_digest(signature, expected_signature):
                raise PermissionDenied("Invalid WhatsApp webhook signature.")
        elif app_secret and not provided_secret:
            raise PermissionDenied("Missing WhatsApp webhook signature.")
        return provided_secret

    def parse_webhook(self, payload, headers=None):
        meta_message = self._parse_meta_cloud_payload(payload)
        if meta_message:
            return meta_message

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

    def _parse_meta_cloud_payload(self, payload):
        entries = payload.get("entry") or []
        for entry in entries:
            for change in entry.get("changes") or []:
                value = change.get("value") or {}
                messages = value.get("messages") or []
                if not messages:
                    continue
                message = messages[0]
                contacts = value.get("contacts") or []
                contact = contacts[0] if contacts else {}
                metadata = value.get("metadata") or {}
                text = ""
                if message.get("type") == "text":
                    text = (message.get("text") or {}).get("body") or ""
                elif message.get("button"):
                    text = (message.get("button") or {}).get("text") or ""
                elif message.get("interactive"):
                    interactive = message.get("interactive") or {}
                    text = (
                        (interactive.get("button_reply") or {}).get("title")
                        or (interactive.get("list_reply") or {}).get("title")
                        or ""
                    )
                return {
                    "sender_id": str(message.get("from") or ""),
                    "sender_name": (contact.get("profile") or {}).get("name") or "",
                    "message_id": str(message.get("id") or ""),
                    "text": text,
                    "phone_number_id": str(metadata.get("phone_number_id") or ""),
                    "display_phone_number": metadata.get("display_phone_number") or "",
                    "payload": payload,
                    "headers": {},
                }
        return None


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
    adapter = "meta_cloud"

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
        if mode == "meta_cloud" and settings.WHATSAPP_ENABLED:
            return self._send_meta_cloud_message(channel, recipient_id, text, payload=payload)

        self.log_event(
            business=business,
            channel=channel.channel,
            direction=IntegrationEventLog.Directions.OUTBOUND,
            payload=event_payload,
            status=IntegrationEventLog.Statuses.MOCKED,
        )
        return {"ok": True, "mock": True, "provider": self.provider, "reason": "WhatsApp mock mode. No paid provider configured."}

    def _send_meta_cloud_message(self, channel, recipient_id, text, payload=None):
        business = channel.bot.business
        config = channel.config_json or {}
        access_token = config.get("access_token", "")
        phone_number_id = config.get("phone_number_id") or channel.external_id
        event_payload = {
            "recipient_id": recipient_id,
            "text": text,
            "mode": "meta_cloud",
            "phone_number_id_configured": bool(phone_number_id),
            "access_token_configured": bool(access_token),
            **(payload or {}),
        }
        if not access_token or not phone_number_id:
            self.log_event(
                business=business,
                channel=channel.channel,
                direction=IntegrationEventLog.Directions.OUTBOUND,
                payload=event_payload,
                status=IntegrationEventLog.Statuses.FAILED,
                error="WhatsApp Meta Cloud credentials are missing.",
            )
            return {"ok": False, "mock": False, "provider": self.provider, "reason": "WhatsApp Meta Cloud credentials are missing."}

        try:
            message_payload = self._meta_cloud_message_payload(recipient_id, text, payload=payload)
            url = self._graph_url(phone_number_id, "messages")
            request = urllib_request.Request(
                url,
                data=json.dumps(message_payload).encode("utf-8"),
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json",
                },
                method="POST",
            )
            with urllib_request.urlopen(request, timeout=15) as response:
                result = json.loads(response.read().decode("utf-8"))
            self.log_event(
                business=business,
                channel=channel.channel,
                direction=IntegrationEventLog.Directions.OUTBOUND,
                payload={**event_payload, "provider_response": result},
                status=IntegrationEventLog.Statuses.SENT,
            )
            return {"ok": True, "mock": False, "provider": self.provider, "result": result}
        except Exception as exc:
            self.log_event(
                business=business,
                channel=channel.channel,
                direction=IntegrationEventLog.Directions.OUTBOUND,
                payload=event_payload,
                status=IntegrationEventLog.Statuses.FAILED,
                error=str(exc),
            )
            return {"ok": False, "mock": False, "provider": self.provider, "reason": str(exc)}

    def _meta_cloud_message_payload(self, recipient_id, text, payload=None):
        payload = payload or {}
        template_name = payload.get("whatsapp_template_name")
        if template_name:
            language_code = payload.get("whatsapp_template_language") or "ru"
            template = {
                "name": template_name,
                "language": {"code": language_code},
            }
            parameters = [value for value in (payload.get("template_parameters") or []) if value]
            if parameters:
                template["components"] = [
                    {
                        "type": "body",
                        "parameters": [{"type": "text", "text": str(value)} for value in parameters],
                    }
                ]
            return {
                "messaging_product": "whatsapp",
                "to": recipient_id,
                "type": "template",
                "template": template,
            }
        return {
            "messaging_product": "whatsapp",
            "to": recipient_id,
            "type": "text",
            "text": {"body": text},
        }

    def validate_credentials(self, channel):
        business = channel.bot.business
        config = channel.config_json or {}
        access_token = config.get("access_token", "")
        phone_number_id = config.get("phone_number_id") or channel.external_id
        safe_payload = {
            "mode": config.get("provider_mode") or "mock",
            "phone_number_id_configured": bool(phone_number_id),
            "access_token_configured": bool(access_token),
        }
        if not access_token or not phone_number_id:
            return {"ok": False, "mock": False, "reason": "WhatsApp Meta Cloud credentials are missing."}
        if not settings.WHATSAPP_ENABLED:
            self.log_event(
                business=business,
                channel=channel.channel,
                direction=IntegrationEventLog.Directions.OUTBOUND,
                payload=safe_payload,
                status=IntegrationEventLog.Statuses.MOCKED,
            )
            return {"ok": True, "mock": True, "reason": "WhatsApp disabled; credentials are stored for production activation."}

        try:
            request = urllib_request.Request(
                self._graph_url(phone_number_id),
                headers={"Authorization": f"Bearer {access_token}"},
                method="GET",
            )
            with urllib_request.urlopen(request, timeout=15) as response:
                result = json.loads(response.read().decode("utf-8"))
            self.log_event(
                business=business,
                channel=channel.channel,
                direction=IntegrationEventLog.Directions.OUTBOUND,
                payload={**safe_payload, "provider_response": result},
                status=IntegrationEventLog.Statuses.SENT,
            )
            return {"ok": True, "mock": False, "phone_number": result}
        except Exception as exc:
            self.log_event(
                business=business,
                channel=channel.channel,
                direction=IntegrationEventLog.Directions.OUTBOUND,
                payload=safe_payload,
                status=IntegrationEventLog.Statuses.FAILED,
                error=str(exc),
            )
            return {"ok": False, "mock": False, "reason": str(exc)}

    def _graph_url(self, phone_number_id, edge=""):
        base = str(getattr(settings, "WHATSAPP_GRAPH_BASE_URL", "https://graph.facebook.com") or "").strip().rstrip("/")
        if not is_safe_public_https_url(base):
            raise ValueError("WHATSAPP_GRAPH_BASE_URL must be a public HTTPS URL.")
        version = getattr(settings, "WHATSAPP_GRAPH_API_VERSION", "v25.0").strip("/")
        suffix = f"/{edge.strip('/')}" if edge else ""
        return f"{base}/{version}/{phone_number_id}{suffix}"
