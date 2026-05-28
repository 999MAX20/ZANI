from dataclasses import dataclass
from datetime import timedelta
from decimal import Decimal
import json
from urllib import parse, request as urllib_request

from django.conf import settings
from django.utils import timezone

from apps.integrations.connectors import decrypt_credential_value
from apps.integrations.models import ConnectorSyncRun


WILDBERRIES_EVENT_TYPES = {
    "order": "wildberries_order_imported",
    "sale": "wildberries_sale_imported",
    "stock": "wildberries_stock_imported",
    "return": "wildberries_return_detected",
}

WILDBERRIES_SUPPORTED_ENTITIES = ("orders", "sales", "stocks")


@dataclass(frozen=True)
class WildberriesReadOnlyEvent:
    event_type: str
    external_id: str
    payload: dict


def get_wildberries_api_token(connector):
    credential = connector.credentials.filter(key="api_token").first()
    if not credential:
        return ""
    return decrypt_credential_value(credential.encrypted_value)


def wildberries_connector_safe_config(connector):
    config = connector.config_json or {}
    entities = config.get("entities") or ["orders", "sales"]
    if not isinstance(entities, list):
        entities = ["orders", "sales"]
    entities = [entity for entity in entities if entity in WILDBERRIES_SUPPORTED_ENTITIES]
    return {
        "entities": entities or ["orders", "sales"],
        "sync_days": min(int(config.get("sync_days") or 7), 90),
        "read_only": True,
        "stocks_endpoint_note": "WB stocks statistics endpoint is deprecated; keep stocks optional until the replacement endpoint is finalized.",
    }


def validate_wildberries_credentials(connector):
    token = get_wildberries_api_token(connector)
    if not token:
        return {"ok": False, "mock": False, "reason": "Wildberries API token is missing."}
    if not settings.WILDBERRIES_ENABLED:
        return {"ok": True, "mock": True, "reason": "Wildberries disabled; token is stored for local real-test activation."}
    try:
        payload = fetch_wildberries_json("api/v1/supplier/orders", token, {"dateFrom": _date_from(1), "flag": "1"})
    except Exception as exc:
        return {"ok": False, "mock": False, "reason": str(exc)}
    return {"ok": True, "mock": False, "rows_count": len(payload if isinstance(payload, list) else []), "provider_response": {"type": type(payload).__name__}}


def sync_wildberries(connector):
    run = ConnectorSyncRun.objects.create(
        business=connector.business,
        connector=connector,
        mode=ConnectorSyncRun.Modes.PULL,
        status=ConnectorSyncRun.Statuses.RUNNING,
        started_at=timezone.now(),
    )
    try:
        if settings.WILDBERRIES_ENABLED:
            events = fetch_wildberries_events(connector)
        else:
            from apps.integrations.wildberries.mock import build_wildberries_mock_events

            events = build_wildberries_mock_events(prefix=f"wildberries-local-{connector.id}")
        run.status = ConnectorSyncRun.Statuses.SUCCEEDED
        run.events_received = len(events)
        run.events_processed = len(events)
        run.finished_at = timezone.now()
        run.save(update_fields=["status", "events_received", "events_processed", "finished_at"])
        return {"ok": True, "mock": not settings.WILDBERRIES_ENABLED, "events": events, "run": run}
    except Exception as exc:
        run.status = ConnectorSyncRun.Statuses.FAILED
        run.error = str(exc)
        run.finished_at = timezone.now()
        run.save(update_fields=["status", "error", "finished_at"])
        return {"ok": False, "mock": False, "reason": str(exc), "events": [], "run": run}


def fetch_wildberries_events(connector):
    token = get_wildberries_api_token(connector)
    if not token:
        raise ValueError("Wildberries API token is missing.")
    config = wildberries_connector_safe_config(connector)
    params = {"dateFrom": _date_from(config["sync_days"]), "flag": "0"}
    events = []
    if "orders" in config["entities"]:
        events.extend(build_wildberries_events_from_orders(fetch_wildberries_json("api/v1/supplier/orders", token, params)))
    if "sales" in config["entities"]:
        events.extend(build_wildberries_events_from_sales(fetch_wildberries_json("api/v1/supplier/sales", token, params)))
    if "stocks" in config["entities"]:
        events.extend(build_wildberries_events_from_stocks(fetch_wildberries_json("api/v1/supplier/stocks", token, {"dateFrom": _date_from(config["sync_days"])})))
    return events


def fetch_wildberries_json(path, token, params=None):
    url = f"{settings.WILDBERRIES_STATISTICS_API_BASE_URL.rstrip('/')}/{path.lstrip('/')}"
    if params:
        url = f"{url}?{parse.urlencode(params)}"
    request = urllib_request.Request(
        url,
        headers={
            "Authorization": token,
            "Accept": "application/json",
        },
        method="GET",
    )
    with urllib_request.urlopen(request, timeout=20) as response:
        return json.loads(response.read().decode("utf-8"))


def build_wildberries_events_from_orders(payload):
    events = []
    for item in payload if isinstance(payload, list) else []:
        external_id = str(item.get("srid") or item.get("gNumber") or item.get("odid") or item.get("nmId") or "")
        amount = item.get("finishedPrice") or item.get("priceWithDisc") or item.get("totalPrice") or 0
        events.append(
            WildberriesReadOnlyEvent(
                event_type=WILDBERRIES_EVENT_TYPES["order"],
                external_id=external_id,
                payload={
                    "order_id": external_id,
                    "g_number": item.get("gNumber") or "",
                    "nm_id": item.get("nmId"),
                    "sku": item.get("supplierArticle") or "",
                    "barcode": item.get("barcode") or "",
                    "brand": item.get("brand") or "",
                    "subject": item.get("subject") or "",
                    "amount": normalize_wildberries_amount(amount),
                    "is_cancel": bool(item.get("isCancel")),
                    "date": item.get("date") or "",
                    "last_change_date": item.get("lastChangeDate") or "",
                    "read_only": True,
                    "source": "wildberries",
                    "raw": item,
                },
            )
        )
    return events


def build_wildberries_events_from_sales(payload):
    events = []
    for item in payload if isinstance(payload, list) else []:
        external_id = str(item.get("srid") or item.get("gNumber") or item.get("saleID") or item.get("nmId") or "")
        event_type = WILDBERRIES_EVENT_TYPES["return"] if str(item.get("saleID") or "").startswith("R") else WILDBERRIES_EVENT_TYPES["sale"]
        amount = item.get("forPay") or item.get("finishedPrice") or item.get("priceWithDisc") or item.get("totalPrice") or 0
        events.append(
            WildberriesReadOnlyEvent(
                event_type=event_type,
                external_id=external_id,
                payload={
                    "sale_id": str(item.get("saleID") or external_id),
                    "g_number": item.get("gNumber") or "",
                    "nm_id": item.get("nmId"),
                    "sku": item.get("supplierArticle") or "",
                    "barcode": item.get("barcode") or "",
                    "brand": item.get("brand") or "",
                    "amount": normalize_wildberries_amount(amount),
                    "date": item.get("date") or "",
                    "last_change_date": item.get("lastChangeDate") or "",
                    "read_only": True,
                    "source": "wildberries",
                    "raw": item,
                },
            )
        )
    return events


def build_wildberries_events_from_stocks(payload):
    events = []
    for item in payload if isinstance(payload, list) else []:
        external_id = str(item.get("barcode") or item.get("nmId") or item.get("supplierArticle") or "")
        quantity = item.get("quantityFull") if item.get("quantityFull") is not None else item.get("quantity") or 0
        events.append(
            WildberriesReadOnlyEvent(
                event_type=WILDBERRIES_EVENT_TYPES["stock"],
                external_id=external_id,
                payload={
                    "stock_id": external_id,
                    "nm_id": item.get("nmId"),
                    "sku": item.get("supplierArticle") or "",
                    "barcode": item.get("barcode") or "",
                    "warehouse_name": item.get("warehouseName") or "",
                    "quantity": normalize_wildberries_amount(quantity),
                    "in_way_to_client": normalize_wildberries_amount(item.get("inWayToClient")),
                    "in_way_from_client": normalize_wildberries_amount(item.get("inWayFromClient")),
                    "last_change_date": item.get("lastChangeDate") or "",
                    "read_only": True,
                    "source": "wildberries",
                    "raw": item,
                },
            )
        )
    return events


def normalize_wildberries_amount(value):
    if value in (None, ""):
        return "0"
    return str(Decimal(str(value)))


def _date_from(days):
    return (timezone.now() - timedelta(days=int(days))).date().isoformat()
