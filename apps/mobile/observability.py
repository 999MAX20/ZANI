import json
import logging
import time
from collections import Counter

from django.conf import settings
from django.core.cache import cache
from django.utils import timezone


logger = logging.getLogger("zani.mobile")

MOBILE_TELEMETRY_CACHE_KEY = "zani.mobile.telemetry.v1"
MOBILE_TELEMETRY_TTL_SECONDS = 60 * 60 * 24 * 7
MOBILE_PAYLOAD_WARN_KB = 120


def record_mobile_event(kind, *, business_id=None, endpoint="", status="", value=1, metadata=None):
    event = {
        "kind": kind,
        "business_id": business_id,
        "endpoint": endpoint,
        "status": status,
        "value": value,
        "metadata": metadata or {},
        "recorded_at": timezone.now().isoformat(),
    }
    events = cache.get(MOBILE_TELEMETRY_CACHE_KEY) or []
    events.append(event)
    cache.set(MOBILE_TELEMETRY_CACHE_KEY, events[-1000:], MOBILE_TELEMETRY_TTL_SECONDS)
    logger.info("mobile_event %s", json.dumps(event, default=str, ensure_ascii=True, sort_keys=True))


def record_mobile_api_response(*, request, response, duration_ms):
    path = getattr(request, "path", "")
    if not path.startswith("/api/mobile/v1/"):
        return
    content_size = len(getattr(response, "content", b"") or b"")
    business_id = _business_id_from_request(request)
    status_code = getattr(response, "status_code", 0)
    endpoint = _normalize_mobile_path(path)
    metadata = {
        "method": getattr(request, "method", ""),
        "duration_ms": round(duration_ms, 2),
        "status_code": status_code,
        "request_id": getattr(request, "request_id", ""),
        "payload_kb": round(content_size / 1024, 2),
    }
    record_mobile_event("api_response", business_id=business_id, endpoint=endpoint, status=str(status_code), metadata=metadata)
    if content_size > getattr(settings, "MOBILE_PAYLOAD_WARN_BYTES", MOBILE_PAYLOAD_WARN_KB * 1024):
        record_mobile_event("payload_budget_exceeded", business_id=business_id, endpoint=endpoint, status=str(status_code), metadata=metadata)


def mobile_telemetry_summary(*, business):
    events = [
        event for event in (cache.get(MOBILE_TELEMETRY_CACHE_KEY) or [])
        if event.get("business_id") in {None, business.id}
    ]
    by_kind = Counter(event.get("kind") or "unknown" for event in events)
    api_by_status = Counter(event.get("status") for event in events if event.get("kind") == "api_response")
    api_by_endpoint = Counter(event.get("endpoint") for event in events if event.get("kind") == "api_response")
    return {
        "events_recorded": len(events),
        "by_kind": dict(by_kind),
        "api_by_status": dict(api_by_status),
        "api_by_endpoint": dict(api_by_endpoint),
        "recent": events[-20:],
    }


class MobileApiTelemetryMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        started = time.perf_counter()
        response = self.get_response(request)
        record_mobile_api_response(request=request, response=response, duration_ms=(time.perf_counter() - started) * 1000)
        return response


def _business_id_from_request(request):
    value = None
    if hasattr(request, "GET"):
        value = request.GET.get("business")
    if value is None and hasattr(request, "POST"):
        value = request.POST.get("business")
    try:
        return int(value) if value else None
    except (TypeError, ValueError):
        return None


def _normalize_mobile_path(path):
    parts = []
    for part in str(path).strip("/").split("/"):
        parts.append(":id" if part.isdigit() else part)
    return "/" + "/".join(parts) + "/"
