import hashlib
import json
import uuid
from dataclasses import dataclass, replace
from datetime import date, datetime
from decimal import Decimal

from django.conf import settings
from django.core.serializers.json import DjangoJSONEncoder
from django.db import IntegrityError, models, transaction
from django.db.models import F
from django.utils import timezone
from rest_framework.exceptions import APIException, PermissionDenied, ValidationError
from rest_framework.response import Response

from apps.businesses.access import Actions, assert_can
from apps.businesses.capabilities import assert_resource_enabled
from apps.businesses.models import Business
from apps.core.models import CRMCommandIdempotency
from apps.core.permissions import user_can_access_business


class CRMCommandConflict(APIException):
    status_code = 409
    default_detail = "This command is already being processed."
    default_code = "idempotency_conflict"


@dataclass(frozen=True)
class CRMCommandClaim:
    record: CRMCommandIdempotency | None
    replayed: bool = False


@dataclass(frozen=True)
class CRMCommandResult:
    data: object
    status_code: int = 200
    resource: models.Model | None = None
    replayed: bool = False


def canonical_request_hash(payload):
    serialized = json.dumps(
        _canonical_value(payload),
        sort_keys=True,
        ensure_ascii=False,
        separators=(",", ":"),
    )
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


def _canonical_value(value):
    if isinstance(value, models.Model):
        return {
            "model": value._meta.label_lower,
            "id": str(value.pk),
        }
    if isinstance(value, dict):
        return {str(key): _canonical_value(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_canonical_value(item) for item in value]
    if isinstance(value, set):
        return sorted((_canonical_value(item) for item in value), key=str)
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, uuid.UUID):
        return str(value)
    if isinstance(value, bytes):
        return value.decode("utf-8", errors="replace")
    return value


def _normalize_key(value):
    key = str(value or "").strip()
    if len(key) > 128:
        raise ValidationError({"idempotency_key": "Idempotency-Key cannot exceed 128 characters."})
    return key


def _retention_expiry(now):
    days = max(1, getattr(settings, "CRM_COMMAND_IDEMPOTENCY_RETENTION_DAYS", 7))
    return now + timezone.timedelta(days=days)


def _processing_expiry(now):
    seconds = max(60, getattr(settings, "CRM_COMMAND_IDEMPOTENCY_LOCK_SECONDS", 300))
    return now + timezone.timedelta(seconds=seconds)


def begin_crm_command(*, business, actor, action, idempotency_key, payload):
    key = _normalize_key(idempotency_key)
    if not key:
        return CRMCommandClaim(record=None)
    if actor is None or not getattr(actor, "is_authenticated", False):
        raise ValidationError({"idempotency_key": "An authenticated actor is required."})

    action = str(action or "").strip()
    if not action or len(action) > 128:
        raise ValidationError({"idempotency_key": "The command action is invalid."})
    request_hash = canonical_request_hash(payload)
    now = timezone.now()

    existing = CRMCommandIdempotency.objects.filter(
        business=business,
        actor=actor,
        action=action,
        idempotency_key=key,
    ).first()
    if existing:
        return _resolve_existing(existing, request_hash=request_hash, now=now)

    try:
        with transaction.atomic():
            record = CRMCommandIdempotency.objects.create(
                business=business,
                actor=actor,
                action=action,
                idempotency_key=key,
                request_hash=request_hash,
                expires_at=_processing_expiry(now),
            )
        return CRMCommandClaim(record=record)
    except IntegrityError:
        existing = CRMCommandIdempotency.objects.get(
            business=business,
            actor=actor,
            action=action,
            idempotency_key=key,
        )
        return _resolve_existing(existing, request_hash=request_hash, now=now)


def _resolve_existing(record, *, request_hash, now):
    if record.request_hash != request_hash:
        raise CRMCommandConflict("This Idempotency-Key was already used with different command data.")
    if record.status == CRMCommandIdempotency.Statuses.SUCCEEDED and record.expires_at > now:
        return CRMCommandClaim(record=record, replayed=True)
    if record.status == CRMCommandIdempotency.Statuses.PROCESSING and record.expires_at > now:
        raise CRMCommandConflict()

    token = uuid.uuid4()
    updated = CRMCommandIdempotency.objects.filter(
        id=record.id,
        request_hash=request_hash,
        expires_at__lte=now,
    ).update(
        status=CRMCommandIdempotency.Statuses.PROCESSING,
        claim_token=token,
        attempts=F("attempts") + 1,
        response_json={},
        response_status=200,
        resource_type="",
        resource_id="",
        locked_at=now,
        expires_at=_processing_expiry(now),
    )
    if not updated:
        current = CRMCommandIdempotency.objects.get(id=record.id)
        if current.status == CRMCommandIdempotency.Statuses.SUCCEEDED:
            return CRMCommandClaim(record=current, replayed=True)
        raise CRMCommandConflict()
    record.refresh_from_db()
    return CRMCommandClaim(record=record)


def run_idempotent_crm_command(
    *,
    business,
    actor,
    action,
    idempotency_key,
    payload,
    operation,
):
    claim = begin_crm_command(
        business=business,
        actor=actor,
        action=action,
        idempotency_key=idempotency_key,
        payload=payload,
    )
    if claim.replayed:
        return CRMCommandResult(
            data=claim.record.response_json,
            status_code=claim.record.response_status,
            replayed=True,
        )
    if claim.record is None:
        return operation()

    try:
        with transaction.atomic():
            locked = CRMCommandIdempotency.objects.select_for_update().get(
                id=claim.record.id,
                claim_token=claim.record.claim_token,
                status=CRMCommandIdempotency.Statuses.PROCESSING,
            )
            result = operation()
            safe_data = _json_safe(result.data)
            resource = result.resource
            updated = CRMCommandIdempotency.objects.filter(
                id=locked.id,
                claim_token=locked.claim_token,
                status=CRMCommandIdempotency.Statuses.PROCESSING,
            ).update(
                status=CRMCommandIdempotency.Statuses.SUCCEEDED,
                response_status=result.status_code,
                response_json=safe_data,
                resource_type=resource._meta.label_lower if resource is not None else "",
                resource_id=str(resource.pk) if resource is not None else "",
                locked_at=timezone.now(),
                expires_at=_retention_expiry(timezone.now()),
            )
            if updated != 1:
                raise CRMCommandConflict()
        return replace(result, data=safe_data)
    except Exception:
        CRMCommandIdempotency.objects.filter(
            id=claim.record.id,
            claim_token=claim.record.claim_token,
            status=CRMCommandIdempotency.Statuses.PROCESSING,
        ).delete()
        raise


def _json_safe(value):
    return json.loads(json.dumps(value, cls=DjangoJSONEncoder, ensure_ascii=False))


def prune_expired_crm_commands(*, limit=1000, now=None):
    if limit <= 0:
        return 0
    now = now or timezone.now()
    ids = list(
        CRMCommandIdempotency.objects.filter(expires_at__lte=now)
        .order_by("expires_at", "id")
        .values_list("id", flat=True)[: min(limit, 5000)]
    )
    if not ids:
        return 0
    deleted, _ = CRMCommandIdempotency.objects.filter(id__in=ids).delete()
    return deleted


class IdempotentCRMCreateMixin:
    idempotency_action = ""

    def create(self, request, *args, **kwargs):
        if not str(request.headers.get("Idempotency-Key", "")).strip():
            return super().create(request, *args, **kwargs)
        serializer_class = self.get_serializer_class()
        business = Business.objects.filter(id=request.data.get("business")).first()
        if business is None or not user_can_access_business(request.user, business):
            raise PermissionDenied("You do not have access to this business.")
        resource = self.get_access_resource()
        if resource is not None:
            assert_resource_enabled(business, resource)
            assert_can(request.user, business, resource, Actions.CREATE)
        action = self.idempotency_action or f"{serializer_class.Meta.model._meta.label_lower}.create"
        serializer = None

        def operation():
            nonlocal serializer
            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            self._enforce_business_access(serializer)
            self.perform_create(serializer)
            return CRMCommandResult(
                data=serializer.data,
                status_code=201,
                resource=serializer.instance,
            )

        result = run_idempotent_crm_command(
            business=business,
            actor=request.user,
            action=action,
            idempotency_key=request.headers.get("Idempotency-Key", ""),
            payload=request.data,
            operation=operation,
        )
        headers = {} if result.replayed else self.get_success_headers(serializer.data)
        return Response(result.data, status=result.status_code, headers=headers)
