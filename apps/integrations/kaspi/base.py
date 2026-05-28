from dataclasses import dataclass
from datetime import timedelta
from decimal import Decimal
import json
from urllib import parse, request as urllib_request

from django.conf import settings
from django.utils import timezone

from apps.integrations.connectors import decrypt_credential_value
from apps.integrations.models import ConnectorSyncRun


KASPI_EVENT_TYPES = {
    "order_imported": "kaspi_order_imported",
    "sale_detected": "kaspi_sale_detected",
    "product_activity": "kaspi_product_activity",
}


@dataclass(frozen=True)
class KaspiReadOnlyEvent:
    event_type: str
    external_id: str
    payload: dict


def normalize_kaspi_amount(value):
    if value in (None, ""):
        return "0"
    return str(Decimal(str(value)))


def get_kaspi_api_token(connector):
    credential = connector.credentials.filter(key="api_token").first()
    if not credential:
        return ""
    return decrypt_credential_value(credential.encrypted_value)


def kaspi_connector_safe_config(connector):
    config = connector.config_json or {}
    return {
        "merchant_id": config.get("merchant_id", ""),
        "order_state": config.get("order_state", "ARCHIVE"),
        "sync_days": int(config.get("sync_days") or 14),
        "page_size": min(int(config.get("page_size") or 20), 100),
        "read_only": True,
    }


def validate_kaspi_credentials(connector):
    token = get_kaspi_api_token(connector)
    if not token:
        return {"ok": False, "mock": False, "reason": "Kaspi API token is missing."}
    if not settings.KASPI_ENABLED:
        return {"ok": True, "mock": True, "reason": "Kaspi disabled; token is stored for local real-test activation."}
    try:
        payload = fetch_kaspi_orders(connector, page_size=1)
    except Exception as exc:
        return {"ok": False, "mock": False, "reason": str(exc)}
    return {"ok": True, "mock": False, "orders_count": len(payload.get("data") or []), "provider_response": _safe_response_meta(payload)}


def sync_kaspi_orders(connector):
    run = ConnectorSyncRun.objects.create(
        business=connector.business,
        connector=connector,
        mode=ConnectorSyncRun.Modes.PULL,
        status=ConnectorSyncRun.Statuses.RUNNING,
        started_at=timezone.now(),
    )
    try:
        if settings.KASPI_ENABLED:
            payload = fetch_kaspi_orders(connector)
            events = build_kaspi_events_from_orders(payload)
        else:
            from apps.integrations.kaspi.mock import build_kaspi_mock_events

            events = build_kaspi_mock_events(prefix=f"kaspi-local-{connector.id}")
        run.status = ConnectorSyncRun.Statuses.SUCCEEDED
        run.events_received = len(events)
        run.events_processed = len(events)
        run.finished_at = timezone.now()
        run.save(update_fields=["status", "events_received", "events_processed", "finished_at"])
        return {"ok": True, "mock": not settings.KASPI_ENABLED, "events": events, "run": run}
    except Exception as exc:
        run.status = ConnectorSyncRun.Statuses.FAILED
        run.error = str(exc)
        run.finished_at = timezone.now()
        run.save(update_fields=["status", "error", "finished_at"])
        return {"ok": False, "mock": False, "reason": str(exc), "events": [], "run": run}


def fetch_kaspi_orders(connector, page_size=None):
    token = get_kaspi_api_token(connector)
    if not token:
        raise ValueError("Kaspi API token is missing.")
    config = kaspi_connector_safe_config(connector)
    size = min(int(page_size or config["page_size"]), 100)
    created_after = timezone.now() - timedelta(days=config["sync_days"])
    params = {
        "page[number]": "0",
        "page[size]": str(size),
        "filter[orders][state]": config["order_state"],
        "filter[orders][creationDate][$ge]": str(int(created_after.timestamp() * 1000)),
        "filter[orders][creationDate][$le]": str(int(timezone.now().timestamp() * 1000)),
    }
    url = f"{settings.KASPI_API_BASE_URL.rstrip('/')}/orders?{parse.urlencode(params)}"
    request = urllib_request.Request(
        url,
        headers={
            "Content-Type": "application/vnd.api+json",
            "X-Auth-Token": token,
        },
        method="GET",
    )
    with urllib_request.urlopen(request, timeout=20) as response:
        return json.loads(response.read().decode("utf-8"))


def build_kaspi_events_from_orders(payload):
    events = []
    for item in payload.get("data") or []:
        attributes = item.get("attributes") or {}
        order_id = str(item.get("id") or attributes.get("code") or "")
        code = str(attributes.get("code") or order_id)
        total_price = attributes.get("totalPrice") or attributes.get("total_price") or attributes.get("amount") or 0
        status = attributes.get("status") or attributes.get("state") or ""
        event_payload = {
            "order_id": order_id,
            "code": code,
            "amount": normalize_kaspi_amount(total_price),
            "status": status,
            "state": attributes.get("state") or "",
            "payment_mode": attributes.get("paymentMode") or "",
            "delivery_mode": attributes.get("deliveryMode") or "",
            "creation_date": attributes.get("creationDate") or "",
            "read_only": True,
            "source": "kaspi",
            "raw": item,
        }
        events.append(
            KaspiReadOnlyEvent(
                event_type=KASPI_EVENT_TYPES["order_imported"],
                external_id=order_id or code,
                payload=event_payload,
            )
        )
        if status in {"COMPLETED", "ACCEPTED_BY_MERCHANT", "APPROVED_BY_BANK"}:
            events.append(
                KaspiReadOnlyEvent(
                    event_type=KASPI_EVENT_TYPES["sale_detected"],
                    external_id=f"{order_id or code}:sale",
                    payload={**event_payload, "sale_id": f"{order_id or code}:sale"},
                )
            )
    return events


def _safe_response_meta(payload):
    meta = payload.get("meta") if isinstance(payload, dict) else None
    links = payload.get("links") if isinstance(payload, dict) else None
    return {"meta": meta or {}, "links": links or {}}
