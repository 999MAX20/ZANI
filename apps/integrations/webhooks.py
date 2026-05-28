import hmac
import ipaddress
import json
import socket
from hashlib import sha256
from urllib.parse import urlparse
from urllib import request as urllib_request
from urllib.error import URLError, HTTPError

from django.conf import settings
from django.utils import timezone

from apps.integrations.models import WebhookDeliveryLog, WebhookEndpoint
from apps.integrations.sanitization import sanitize_config


LOCAL_HOSTNAMES = {"localhost", "localhost.localdomain"}


def _is_blocked_address(address):
    try:
        parsed = ipaddress.ip_address(address)
    except ValueError:
        return False
    return any(
        [
            parsed.is_loopback,
            parsed.is_private,
            parsed.is_link_local,
            parsed.is_multicast,
            parsed.is_reserved,
            parsed.is_unspecified,
        ]
    )


def validate_outbound_webhook_url(url, *, allow_mock=None):
    allow_mock = settings.DEBUG if allow_mock is None else allow_mock
    parsed = urlparse(str(url or "").strip())
    if allow_mock and parsed.scheme == "mock" and parsed.netloc in {"success", "fail"}:
        return str(url).strip()
    if parsed.scheme not in {"http", "https"}:
        raise ValueError("Webhook URL must use http or https.")
    if not parsed.hostname:
        raise ValueError("Webhook URL must include a hostname.")
    if parsed.username or parsed.password:
        raise ValueError("Webhook URL must not include credentials.")
    if parsed.fragment:
        raise ValueError("Webhook URL must not include a fragment.")

    hostname = parsed.hostname.lower().rstrip(".")
    if hostname in LOCAL_HOSTNAMES or _is_blocked_address(hostname):
        raise ValueError("Webhook URL must not target local or private network addresses.")

    try:
        resolved = socket.getaddrinfo(hostname, parsed.port or (443 if parsed.scheme == "https" else 80), type=socket.SOCK_STREAM)
    except socket.gaierror as exc:
        raise ValueError("Webhook URL hostname could not be resolved.") from exc
    for item in resolved:
        address = item[4][0]
        if _is_blocked_address(address):
            raise ValueError("Webhook URL must not resolve to local or private network addresses.")
    return str(url).strip()


def sign_payload(secret, body):
    if not secret:
        return ""
    return hmac.new(secret.encode("utf-8"), body, sha256).hexdigest()


def deliver_webhook_event(endpoint: WebhookEndpoint, event_type, payload, idempotency_key):
    safe_payload = sanitize_config(payload or {})
    log, created = WebhookDeliveryLog.objects.get_or_create(
        endpoint=endpoint,
        idempotency_key=idempotency_key,
        defaults={
            "business": endpoint.business,
            "event_type": event_type,
            "payload_json": safe_payload,
            "status": WebhookDeliveryLog.Statuses.PENDING,
        },
    )
    if not created and log.status == WebhookDeliveryLog.Statuses.SENT:
        return log
    log.attempts += 1

    try:
        if endpoint.url.startswith("mock://success"):
            log.status = WebhookDeliveryLog.Statuses.SENT
            log.response_status = 200
            log.response_body = "mock success"
            log.error = ""
            log.delivered_at = timezone.now()
            log.next_retry_at = None
            log.save()
            return log
        if endpoint.url.startswith("mock://fail"):
            raise URLError("mock failure")

        validate_outbound_webhook_url(endpoint.url, allow_mock=False)
        body = json.dumps({"event": event_type, "payload": safe_payload}).encode("utf-8")
        request = urllib_request.Request(
            endpoint.url,
            data=body,
            method="POST",
            headers={
                "Content-Type": "application/json",
                "X-Zani-Event": event_type,
                "X-Zani-Idempotency-Key": idempotency_key,
                "X-Zani-Signature": sign_payload(endpoint.secret, body),
            },
        )
        with urllib_request.urlopen(request, timeout=8) as response:
            log.response_status = response.status
            log.response_body = response.read().decode("utf-8")[:2000]
        log.status = WebhookDeliveryLog.Statuses.SENT if 200 <= (log.response_status or 0) < 300 else WebhookDeliveryLog.Statuses.FAILED
        log.error = "" if log.status == WebhookDeliveryLog.Statuses.SENT else f"Unexpected status {log.response_status}"
        log.delivered_at = timezone.now() if log.status == WebhookDeliveryLog.Statuses.SENT else None
    except (HTTPError, URLError, TimeoutError, Exception) as exc:
        log.status = WebhookDeliveryLog.Statuses.FAILED
        log.error = str(exc)
        log.next_retry_at = timezone.now()
    log.save()
    return log
