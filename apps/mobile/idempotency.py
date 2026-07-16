import hashlib
import json

from django.core.serializers.json import DjangoJSONEncoder
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.mobile.models import MobileIdempotencyKey, hash_mobile_secret
from apps.mobile.observability import record_mobile_event


IDEMPOTENCY_RETENTION_DAYS = 7


def request_idempotency_key(request):
    return (request.headers.get("Idempotency-Key") or "").strip()


def run_idempotent_mobile_action(*, request, business, endpoint, action):
    raw_key = request_idempotency_key(request)
    if not raw_key:
        raise ValidationError({"idempotency_key": "Idempotency-Key header is required."})
    key_hash = hash_mobile_secret(raw_key, namespace="mobile-idempotency")
    request_hash = _request_hash(request)
    now = timezone.now()

    with transaction.atomic():
        existing = (
            MobileIdempotencyKey.objects.select_for_update()
            .filter(
                business=business,
                user=request.user,
                endpoint=endpoint,
                key_hash=key_hash,
                expires_at__gt=now,
            )
            .first()
        )
        if existing:
            if existing.request_hash != request_hash:
                record_mobile_event("idempotency_conflict", business_id=business.id, endpoint=endpoint, status="mismatch")
                raise ValidationError({"idempotency_key": "Idempotency-Key was already used for a different request."})
            record_mobile_event("idempotency_replay", business_id=business.id, endpoint=endpoint, status=str(existing.response_status or 200))
            return existing.response_status or 200, existing.response_json, True

        record_mobile_event("idempotency_created", business_id=business.id, endpoint=endpoint, status="created")
        record = MobileIdempotencyKey.objects.create(
            business=business,
            user=request.user,
            endpoint=endpoint,
            key_hash=key_hash,
            request_hash=request_hash,
            expires_at=now + timezone.timedelta(days=IDEMPOTENCY_RETENTION_DAYS),
        )
        response_status, response_json = action()
        response_json = _json_safe(response_json)
        record.response_status = response_status
        record.response_json = response_json
        record.save(update_fields=["response_status", "response_json", "updated_at"])
        return response_status, response_json, False


def _request_hash(request):
    payload = {
        "method": request.method,
        "path": request.path,
        "query": sorted(request.query_params.items()),
        "body": request.data,
    }
    raw = json.dumps(_json_safe(payload), sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _json_safe(value):
    return json.loads(json.dumps(value, cls=DjangoJSONEncoder))
