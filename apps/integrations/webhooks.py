import hmac
import http.client
import ipaddress
import json
import socket
import ssl
from hashlib import sha256
from urllib.error import URLError
from urllib.parse import urljoin, urlparse

from django.conf import settings
from django.utils import timezone

from apps.integrations.models import WebhookDeliveryLog, WebhookEndpoint
from apps.integrations.sanitization import sanitize_config, sanitize_error_text


LOCAL_HOSTNAMES = {"localhost", "localhost.localdomain"}
WEBHOOK_TIMEOUT_SECONDS = 8
WEBHOOK_MAX_REDIRECTS = 3
WEBHOOK_MAX_RESPONSE_BYTES = 2000
WEBHOOK_REDIRECT_STATUSES = {301, 302, 303, 307, 308}


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


def _resolve_outbound_webhook_url(url, *, allow_mock=None):
    allow_mock = settings.DEBUG if allow_mock is None else allow_mock
    normalized_url = str(url or "").strip()
    parsed = urlparse(normalized_url)
    if allow_mock and parsed.scheme == "mock" and parsed.netloc in {"success", "fail"}:
        return normalized_url, parsed, []
    if parsed.scheme not in {"http", "https"}:
        raise ValueError("Webhook URL must use http or https.")
    if parsed.scheme != "https" and (not settings.DEBUG or not allow_mock):
        raise ValueError("Webhook URL must use https.")
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
    addresses = []
    for item in resolved:
        address = item[4][0]
        if _is_blocked_address(address):
            raise ValueError("Webhook URL must not resolve to local or private network addresses.")
        if address not in addresses:
            addresses.append(address)
    if not addresses:
        raise ValueError("Webhook URL hostname did not resolve to a usable address.")
    return normalized_url, parsed, addresses


def validate_outbound_webhook_url(url, *, allow_mock=None):
    normalized_url, _, _ = _resolve_outbound_webhook_url(url, allow_mock=allow_mock)
    return normalized_url


class _PinnedHTTPSConnection(http.client.HTTPSConnection):
    """HTTPS connection that never performs a second, untrusted DNS lookup."""

    def __init__(self, hostname, port, resolved_address, *, timeout):
        super().__init__(hostname, port=port, timeout=timeout, context=ssl.create_default_context())
        self._resolved_address = resolved_address

    def connect(self):
        raw_socket = self._create_connection(
            (self._resolved_address, self.port),
            self.timeout,
            self.source_address,
        )
        peer_address = raw_socket.getpeername()[0]
        if _is_blocked_address(peer_address):
            raw_socket.close()
            raise URLError("Webhook connection reached a local or private network address.")
        try:
            self.sock = self._context.wrap_socket(raw_socket, server_hostname=self.host)
        except Exception:
            raw_socket.close()
            raise


def _read_limited_response_body(response, *, max_bytes=WEBHOOK_MAX_RESPONSE_BYTES):
    chunks = []
    remaining = max_bytes + 1
    while remaining > 0:
        chunk = response.read(min(8192, remaining))
        if not chunk:
            break
        chunks.append(chunk)
        remaining -= len(chunk)
    return b"".join(chunks)[:max_bytes].decode("utf-8", errors="replace")


def _post_webhook_once(url, body, headers):
    _, parsed, addresses = _resolve_outbound_webhook_url(url, allow_mock=False)
    target = parsed.path or "/"
    if parsed.query:
        target = f"{target}?{parsed.query}"
    port = parsed.port or 443
    last_error = None
    for address in addresses:
        connection = _PinnedHTTPSConnection(
            parsed.hostname,
            port,
            address,
            timeout=WEBHOOK_TIMEOUT_SECONDS,
        )
        try:
            connection.request("POST", target, body=body, headers=headers)
            response = connection.getresponse()
            status = response.status
            location = response.getheader("Location")
            response_body = "" if status in WEBHOOK_REDIRECT_STATUSES else _read_limited_response_body(response)
            return status, location, response_body
        except (OSError, TimeoutError, ssl.SSLError, URLError) as exc:
            last_error = exc
        finally:
            connection.close()
    raise URLError("Webhook endpoint could not be reached.") from last_error


def _post_webhook(url, body, headers):
    current_url = url
    visited_urls = set()
    for redirect_count in range(WEBHOOK_MAX_REDIRECTS + 1):
        if current_url in visited_urls:
            raise URLError("Webhook redirect loop detected.")
        visited_urls.add(current_url)
        status, location, response_body = _post_webhook_once(current_url, body, headers)
        if status not in WEBHOOK_REDIRECT_STATUSES:
            return status, response_body
        if not location:
            raise URLError("Webhook redirect did not provide a destination.")
        if redirect_count >= WEBHOOK_MAX_REDIRECTS:
            raise URLError("Webhook redirect limit exceeded.")
        current_url = urljoin(current_url, location)
        validate_outbound_webhook_url(current_url, allow_mock=False)
    raise URLError("Webhook redirect limit exceeded.")


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

        body = json.dumps({"event": event_type, "payload": safe_payload}).encode("utf-8")
        headers = {
            "Content-Type": "application/json",
            "X-Zani-Event": event_type,
            "X-Zani-Idempotency-Key": idempotency_key,
            "X-Zani-Signature": sign_payload(endpoint.secret, body),
        }
        log.response_status, response_body = _post_webhook(endpoint.url, body, headers)
        log.response_body = sanitize_error_text(response_body, max_length=WEBHOOK_MAX_RESPONSE_BYTES)
        log.status = WebhookDeliveryLog.Statuses.SENT if 200 <= (log.response_status or 0) < 300 else WebhookDeliveryLog.Statuses.FAILED
        log.error = "" if log.status == WebhookDeliveryLog.Statuses.SENT else f"Unexpected status {log.response_status}"
        log.delivered_at = timezone.now() if log.status == WebhookDeliveryLog.Statuses.SENT else None
    except Exception as exc:
        log.status = WebhookDeliveryLog.Statuses.FAILED
        log.error = sanitize_error_text(exc)
        log.next_retry_at = timezone.now()
    log.save()
    return log
