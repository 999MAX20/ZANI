from dataclasses import dataclass
from datetime import timedelta
from decimal import Decimal
import json
from urllib import request as urllib_request

from django.conf import settings
from django.utils import timezone

from apps.integrations.connectors import decrypt_credential_value
from apps.integrations.models import ConnectorSyncRun


OZON_EVENT_TYPES = {
    "fbs_posting": "ozon_fbs_posting_imported",
    "fbo_posting": "ozon_fbo_posting_imported",
    "stock": "ozon_stock_imported",
    "cancelled": "ozon_cancelled_detected",
}

OZON_SUPPORTED_ENTITIES = ("fbs_postings", "fbo_postings", "stocks")


@dataclass(frozen=True)
class OzonReadOnlyEvent:
    event_type: str
    external_id: str
    payload: dict


def get_ozon_credentials(connector):
    client_id = connector.credentials.filter(key="client_id").first()
    api_key = connector.credentials.filter(key="api_key").first()
    return {
        "client_id": decrypt_credential_value(client_id.encrypted_value) if client_id else "",
        "api_key": decrypt_credential_value(api_key.encrypted_value) if api_key else "",
    }


def ozon_connector_safe_config(connector):
    config = connector.config_json or {}
    entities = config.get("entities") or ["fbs_postings", "fbo_postings", "stocks"]
    if not isinstance(entities, list):
        entities = ["fbs_postings", "fbo_postings", "stocks"]
    entities = [entity for entity in entities if entity in OZON_SUPPORTED_ENTITIES]
    return {
        "entities": entities or ["fbs_postings", "fbo_postings", "stocks"],
        "sync_days": min(int(config.get("sync_days") or 7), 90),
        "limit": min(int(config.get("limit") or 50), 1000),
        "read_only": True,
    }


def validate_ozon_credentials(connector):
    credentials = get_ozon_credentials(connector)
    if not credentials["client_id"] or not credentials["api_key"]:
        return {"ok": False, "mock": False, "reason": "Ozon Client-Id or Api-Key is missing."}
    if not settings.OZON_ENABLED:
        return {"ok": True, "mock": True, "reason": "Ozon disabled; credentials are stored for local real-test activation."}
    try:
        payload = fetch_ozon_json("v1/warehouse/list", credentials, {})
    except Exception as exc:
        return {"ok": False, "mock": False, "reason": str(exc)}
    warehouses = payload.get("result") or []
    return {"ok": True, "mock": False, "warehouses_count": len(warehouses), "provider_response": {"result_type": type(warehouses).__name__}}


def sync_ozon(connector):
    run = ConnectorSyncRun.objects.create(
        business=connector.business,
        connector=connector,
        mode=ConnectorSyncRun.Modes.PULL,
        status=ConnectorSyncRun.Statuses.RUNNING,
        started_at=timezone.now(),
    )
    try:
        if settings.OZON_ENABLED:
            events = fetch_ozon_events(connector)
        else:
            from apps.integrations.ozon.mock import build_ozon_mock_events

            events = build_ozon_mock_events(prefix=f"ozon-local-{connector.id}")
        run.status = ConnectorSyncRun.Statuses.SUCCEEDED
        run.events_received = len(events)
        run.events_processed = len(events)
        run.finished_at = timezone.now()
        run.save(update_fields=["status", "events_received", "events_processed", "finished_at"])
        return {"ok": True, "mock": not settings.OZON_ENABLED, "events": events, "run": run}
    except Exception as exc:
        run.status = ConnectorSyncRun.Statuses.FAILED
        run.error = str(exc)
        run.finished_at = timezone.now()
        run.save(update_fields=["status", "error", "finished_at"])
        return {"ok": False, "mock": False, "reason": str(exc), "events": [], "run": run}


def fetch_ozon_events(connector):
    credentials = get_ozon_credentials(connector)
    if not credentials["client_id"] or not credentials["api_key"]:
        raise ValueError("Ozon Client-Id or Api-Key is missing.")
    config = ozon_connector_safe_config(connector)
    since = timezone.now() - timedelta(days=config["sync_days"])
    to = timezone.now()
    events = []
    if "fbs_postings" in config["entities"]:
        payload = fetch_ozon_json(
            "v3/posting/fbs/list",
            credentials,
            {
                "dir": "ASC",
                "filter": {"since": since.isoformat(), "to": to.isoformat()},
                "limit": config["limit"],
                "offset": 0,
                "with": {"analytics_data": True, "financial_data": True},
            },
        )
        events.extend(build_ozon_events_from_fbs_postings(payload))
    if "fbo_postings" in config["entities"]:
        payload = fetch_ozon_json(
            "v2/posting/fbo/list",
            credentials,
            {
                "dir": "ASC",
                "filter": {"since": since.isoformat(), "to": to.isoformat()},
                "limit": config["limit"],
                "offset": 0,
                "with": {"analytics_data": True, "financial_data": True},
            },
        )
        events.extend(build_ozon_events_from_fbo_postings(payload))
    if "stocks" in config["entities"]:
        payload = fetch_ozon_json("v4/product/info/stocks", credentials, {"filter": {"visibility": "ALL"}, "limit": config["limit"]})
        events.extend(build_ozon_events_from_stocks(payload))
    return events


def fetch_ozon_json(path, credentials, payload):
    url = f"{settings.OZON_SELLER_API_BASE_URL.rstrip('/')}/{path.lstrip('/')}"
    request = urllib_request.Request(
        url,
        data=json.dumps(payload or {}).encode("utf-8"),
        headers={
            "Client-Id": credentials["client_id"],
            "Api-Key": credentials["api_key"],
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        method="POST",
    )
    with urllib_request.urlopen(request, timeout=20) as response:
        return json.loads(response.read().decode("utf-8"))


def build_ozon_events_from_fbs_postings(payload):
    return _build_ozon_posting_events(payload, OZON_EVENT_TYPES["fbs_posting"], "fbs")


def build_ozon_events_from_fbo_postings(payload):
    return _build_ozon_posting_events(payload, OZON_EVENT_TYPES["fbo_posting"], "fbo")


def _build_ozon_posting_events(payload, event_type, scheme):
    events = []
    result = payload.get("result") or {}
    postings = result.get("postings") if isinstance(result, dict) else []
    for item in postings or []:
        posting_number = str(item.get("posting_number") or item.get("order_id") or "")
        status = str(item.get("status") or "")
        products = item.get("products") or []
        amount = _posting_amount(item)
        normalized_type = OZON_EVENT_TYPES["cancelled"] if "cancel" in status.lower() else event_type
        events.append(
            OzonReadOnlyEvent(
                event_type=normalized_type,
                external_id=posting_number,
                payload={
                    "posting_number": posting_number,
                    "scheme": scheme,
                    "status": status,
                    "amount": normalize_ozon_amount(amount),
                    "products_count": len(products),
                    "products": products,
                    "in_process_at": item.get("in_process_at") or "",
                    "shipment_date": item.get("shipment_date") or "",
                    "read_only": True,
                    "source": "ozon",
                    "raw": item,
                },
            )
        )
    return events


def build_ozon_events_from_stocks(payload):
    events = []
    result = payload.get("result") or {}
    items = result.get("items") if isinstance(result, dict) else []
    for item in items or []:
        product_id = str(item.get("product_id") or item.get("offer_id") or "")
        total_stock = 0
        for stock in item.get("stocks") or []:
            total_stock += int(stock.get("present") or stock.get("reserved") or 0)
        events.append(
            OzonReadOnlyEvent(
                event_type=OZON_EVENT_TYPES["stock"],
                external_id=product_id,
                payload={
                    "product_id": product_id,
                    "offer_id": item.get("offer_id") or "",
                    "total_stock": str(total_stock),
                    "stocks": item.get("stocks") or [],
                    "read_only": True,
                    "source": "ozon",
                    "raw": item,
                },
            )
        )
    return events


def normalize_ozon_amount(value):
    if value in (None, ""):
        return "0"
    return str(Decimal(str(value)))


def _posting_amount(item):
    financial = item.get("financial_data") or {}
    products = financial.get("products") or item.get("products") or []
    total = Decimal("0")
    for product in products:
        value = product.get("price") or product.get("old_price") or product.get("payout") or 0
        total += Decimal(str(value or 0))
    return total
