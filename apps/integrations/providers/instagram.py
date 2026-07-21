import hashlib
import hmac
import json
from urllib import request as urllib_request

from django.conf import settings
from rest_framework.exceptions import PermissionDenied

from apps.core.production_rules import is_safe_public_https_url
from apps.integrations.bot_channel_credentials import get_instagram_access_token
from apps.integrations.models import IntegrationEventLog
from apps.integrations.providers.base import BaseChannelProvider


META_SIGNATURE_HEADER = "HTTP_X_HUB_SIGNATURE_256"


class BaseInstagramAdapter(BaseChannelProvider):
    provider = "instagram"
    adapter = "base"

    def verify_webhook(self, request):
        app_secret = getattr(settings, "INSTAGRAM_APP_SECRET", "") or getattr(settings, "META_APP_SECRET", "")
        signature = request.META.get(META_SIGNATURE_HEADER, "")
        if app_secret:
            if not signature:
                raise PermissionDenied("Missing Instagram webhook signature.")
            expected_signature = "sha256=" + hmac.new(
                app_secret.encode("utf-8"),
                request.body,
                hashlib.sha256,
            ).hexdigest()
            if not hmac.compare_digest(signature, expected_signature):
                raise PermissionDenied("Invalid Instagram webhook signature.")
        return ""

    def parse_webhook(self, payload, headers=None):
        meta_message = self._parse_meta_messaging_payload(payload)
        if meta_message:
            return meta_message

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

    def _parse_meta_messaging_payload(self, payload):
        for entry in payload.get("entry") or []:
            ig_user_id = str(entry.get("id") or "")
            for messaging in entry.get("messaging") or []:
                sender = messaging.get("sender") or {}
                recipient = messaging.get("recipient") or {}
                message = messaging.get("message") or {}
                postback = messaging.get("postback") or {}
                text = message.get("text") or postback.get("title") or postback.get("payload") or ""
                return {
                    "sender_id": str(sender.get("id") or ""),
                    "recipient_id": str(recipient.get("id") or ""),
                    "instagram_user_id": ig_user_id or str(recipient.get("id") or ""),
                    "username": "",
                    "message_id": str(message.get("mid") or messaging.get("message_id") or ""),
                    "text": str(text),
                    "payload": payload,
                    "headers": {},
                }
        return None


class InstagramProvider(BaseInstagramAdapter):
    adapter = "meta_graph"

    def send_message(self, channel, recipient_id, text, payload=None):
        config = channel.config_json or {}
        mode = config.get("provider_mode") or "mock"
        event_payload = {
            "recipient_id": recipient_id,
            "text": text,
            "mode": mode,
            "instagram_user_id_configured": bool(config.get("instagram_user_id") or channel.external_id),
            **(payload or {}),
        }
        if mode == "disabled":
            self.log_event(
                business=channel.bot.business,
                channel=channel.channel,
                direction=IntegrationEventLog.Directions.OUTBOUND,
                payload=event_payload,
                status=IntegrationEventLog.Statuses.FAILED,
                error="Instagram channel is disabled.",
            )
            return {"ok": False, "mock": False, "provider": self.provider, "reason": "Instagram channel is disabled."}
        if mode == "meta_graph" and settings.INSTAGRAM_ENABLED:
            return self._send_meta_message(channel, recipient_id, text, payload=payload)

        self.log_event(
            business=channel.bot.business,
            channel=channel.channel,
            direction=IntegrationEventLog.Directions.OUTBOUND,
            payload=event_payload,
            status=IntegrationEventLog.Statuses.MOCKED,
        )
        return {
            "ok": True,
            "mock": True,
            "provider": self.provider,
            "adapter": self.adapter,
            "reason": "Instagram mock mode. No real Meta Graph request was sent.",
        }

    def validate_credentials(self, channel):
        config = channel.config_json or {}
        access_token = get_instagram_access_token(channel)
        instagram_user_id = config.get("instagram_user_id") or channel.external_id
        safe_payload = {
            "mode": config.get("provider_mode") or "mock",
            "instagram_user_id_configured": bool(instagram_user_id),
            "access_token_configured": bool(access_token),
        }
        if not access_token or not instagram_user_id:
            return {"ok": False, "mock": False, "reason": "Instagram Meta credentials are missing."}
        if not settings.INSTAGRAM_ENABLED:
            self.log_event(
                business=channel.bot.business,
                channel=channel.channel,
                direction=IntegrationEventLog.Directions.OUTBOUND,
                payload=safe_payload,
                status=IntegrationEventLog.Statuses.MOCKED,
            )
            return {"ok": True, "mock": True, "reason": "Instagram disabled; credentials are stored for local real-test activation."}

        try:
            request = urllib_request.Request(
                self._graph_url(instagram_user_id, fields="id,username"),
                headers={"Authorization": f"Bearer {access_token}"},
                method="GET",
            )
            with urllib_request.urlopen(request, timeout=15) as response:
                result = json.loads(response.read().decode("utf-8"))
            self.log_event(
                business=channel.bot.business,
                channel=channel.channel,
                direction=IntegrationEventLog.Directions.OUTBOUND,
                payload={**safe_payload, "provider_response": result},
                status=IntegrationEventLog.Statuses.SENT,
            )
            return {"ok": True, "mock": False, "instagram_account": result}
        except Exception as exc:
            self.log_event(
                business=channel.bot.business,
                channel=channel.channel,
                direction=IntegrationEventLog.Directions.OUTBOUND,
                payload=safe_payload,
                status=IntegrationEventLog.Statuses.FAILED,
                error=str(exc),
            )
            return {"ok": False, "mock": False, "reason": str(exc)}

    def _send_meta_message(self, channel, recipient_id, text, payload=None):
        config = channel.config_json or {}
        access_token = get_instagram_access_token(channel)
        instagram_user_id = config.get("instagram_user_id") or channel.external_id
        event_payload = {
            "recipient_id": recipient_id,
            "text": text,
            "mode": "meta_graph",
            "instagram_user_id_configured": bool(instagram_user_id),
            "access_token_configured": bool(access_token),
            **(payload or {}),
        }
        if not access_token or not instagram_user_id:
            self.log_event(
                business=channel.bot.business,
                channel=channel.channel,
                direction=IntegrationEventLog.Directions.OUTBOUND,
                payload=event_payload,
                status=IntegrationEventLog.Statuses.FAILED,
                error="Instagram Meta credentials are missing.",
            )
            return {"ok": False, "mock": False, "provider": self.provider, "reason": "Instagram Meta credentials are missing."}

        try:
            request = urllib_request.Request(
                self._graph_url(instagram_user_id, "messages"),
                data=json.dumps(
                    {
                        "recipient": {"id": recipient_id},
                        "message": {"text": text},
                    }
                ).encode("utf-8"),
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json",
                },
                method="POST",
            )
            with urllib_request.urlopen(request, timeout=15) as response:
                result = json.loads(response.read().decode("utf-8"))
            self.log_event(
                business=channel.bot.business,
                channel=channel.channel,
                direction=IntegrationEventLog.Directions.OUTBOUND,
                payload={**event_payload, "provider_response": result},
                status=IntegrationEventLog.Statuses.SENT,
            )
            return {"ok": True, "mock": False, "provider": self.provider, "result": result}
        except Exception as exc:
            self.log_event(
                business=channel.bot.business,
                channel=channel.channel,
                direction=IntegrationEventLog.Directions.OUTBOUND,
                payload=event_payload,
                status=IntegrationEventLog.Statuses.FAILED,
                error=str(exc),
            )
            return {"ok": False, "mock": False, "provider": self.provider, "reason": str(exc)}

    def _graph_url(self, instagram_user_id, edge="", fields=""):
        base = str(getattr(settings, "INSTAGRAM_GRAPH_BASE_URL", "https://graph.facebook.com") or "").strip().rstrip("/")
        if not is_safe_public_https_url(base):
            raise ValueError("INSTAGRAM_GRAPH_BASE_URL must be a public HTTPS URL.")
        version = getattr(settings, "INSTAGRAM_GRAPH_API_VERSION", "v25.0").strip("/")
        suffix = f"/{edge.strip('/')}" if edge else ""
        query = f"?fields={fields}" if fields else ""
        return f"{base}/{version}/{instagram_user_id}{suffix}{query}"


class InstagramMetaPlaceholderAdapter(InstagramProvider):
    adapter = "meta_placeholder"
