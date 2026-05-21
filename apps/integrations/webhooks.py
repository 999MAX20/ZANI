import hmac
import json
from hashlib import sha256
from urllib import request as urllib_request
from urllib.error import URLError, HTTPError

from django.utils import timezone

from apps.integrations.models import WebhookDeliveryLog, WebhookEndpoint


def sign_payload(secret, body):
    if not secret:
        return ""
    return hmac.new(secret.encode("utf-8"), body, sha256).hexdigest()


def deliver_webhook_event(endpoint: WebhookEndpoint, event_type, payload, idempotency_key):
    log, created = WebhookDeliveryLog.objects.get_or_create(
        endpoint=endpoint,
        idempotency_key=idempotency_key,
        defaults={
            "business": endpoint.business,
            "event_type": event_type,
            "payload_json": payload,
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

        body = json.dumps({"event": event_type, "payload": payload}).encode("utf-8")
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
