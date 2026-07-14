from dataclasses import dataclass
from decimal import Decimal
import json
from urllib import parse, request as urllib_request

from django.conf import settings
from django.utils import timezone

from apps.core.production_rules import is_safe_public_https_url
from apps.integrations.connectors import decrypt_credential_value
from apps.integrations.models import ConnectorSyncRun


MOYSKLAD_EVENT_TYPES = {
    "product": "moysklad_product_imported",
    "stock": "moysklad_stock_imported",
    "sale": "moysklad_sale_imported",
    "client": "moysklad_client_imported",
}

MOYSKLAD_SUPPORTED_ENTITIES = ("products", "stock", "sales", "clients")


@dataclass(frozen=True)
class MoySkladReadOnlyEvent:
    event_type: str
    external_id: str
    payload: dict


def get_moysklad_access_token(connector):
    credential = connector.credentials.filter(key="access_token").first()
    if not credential:
        return ""
    return decrypt_credential_value(credential.encrypted_value)


def moysklad_connector_safe_config(connector):
    config = connector.config_json or {}
    entities = config.get("entities") or list(MOYSKLAD_SUPPORTED_ENTITIES)
    if not isinstance(entities, list):
        entities = list(MOYSKLAD_SUPPORTED_ENTITIES)
    entities = [entity for entity in entities if entity in MOYSKLAD_SUPPORTED_ENTITIES]
    return {
        "entities": entities or list(MOYSKLAD_SUPPORTED_ENTITIES),
        "page_size": min(int(config.get("page_size") or 50), 100),
        "read_only": True,
    }


def validate_moysklad_credentials(connector):
    token = get_moysklad_access_token(connector)
    if not token:
        return {"ok": False, "mock": False, "reason": "MoySklad access token is missing."}
    if not settings.MOYSKLAD_ENABLED:
        return {"ok": True, "mock": True, "reason": "MoySklad disabled; token is stored for local real-test activation."}
    try:
        payload = fetch_moysklad_json("entity/organization", token, {"limit": "1"})
    except Exception as exc:
        return {"ok": False, "mock": False, "reason": str(exc)}
    return {"ok": True, "mock": False, "rows_count": len(payload.get("rows") or []), "provider_response": _safe_response_meta(payload)}


def sync_moysklad(connector):
    run = ConnectorSyncRun.objects.create(
        business=connector.business,
        connector=connector,
        mode=ConnectorSyncRun.Modes.PULL,
        status=ConnectorSyncRun.Statuses.RUNNING,
        started_at=timezone.now(),
    )
    try:
        if settings.MOYSKLAD_ENABLED:
            events = fetch_moysklad_events(connector)
        else:
            from apps.integrations.moysklad.mock import build_moysklad_mock_events

            events = [
                MoySkladReadOnlyEvent(
                    event_type=item["event_type"],
                    external_id=item["external_id"],
                    payload=item["payload"],
                )
                for item in build_moysklad_mock_events(prefix=f"moysklad-local-{connector.id}")
            ]
        run.status = ConnectorSyncRun.Statuses.SUCCEEDED
        run.events_received = len(events)
        run.events_processed = len(events)
        run.finished_at = timezone.now()
        run.save(update_fields=["status", "events_received", "events_processed", "finished_at"])
        return {"ok": True, "mock": not settings.MOYSKLAD_ENABLED, "events": events, "run": run}
    except Exception as exc:
        run.status = ConnectorSyncRun.Statuses.FAILED
        run.error = str(exc)
        run.finished_at = timezone.now()
        run.save(update_fields=["status", "error", "finished_at"])
        return {"ok": False, "mock": False, "reason": str(exc), "events": [], "run": run}


def fetch_moysklad_events(connector):
    token = get_moysklad_access_token(connector)
    if not token:
        raise ValueError("MoySklad access token is missing.")
    config = moysklad_connector_safe_config(connector)
    events = []
    if "products" in config["entities"]:
        events.extend(build_moysklad_product_events(fetch_moysklad_json("entity/product", token, {"limit": str(config["page_size"])})))
    if "stock" in config["entities"]:
        events.extend(build_moysklad_stock_events(fetch_moysklad_json("report/stock/all", token, {"limit": str(config["page_size"])})))
    if "sales" in config["entities"]:
        events.extend(build_moysklad_sale_events(fetch_moysklad_json("entity/demand", token, {"limit": str(config["page_size"]), "expand": "agent"})))
    if "clients" in config["entities"]:
        events.extend(build_moysklad_client_events(fetch_moysklad_json("entity/counterparty", token, {"limit": str(config["page_size"])})))
    return events


def fetch_moysklad_json(path, token, params=None):
    base_url = str(settings.MOYSKLAD_API_BASE_URL or "").strip().rstrip("/")
    if not is_safe_public_https_url(base_url):
        raise ValueError("MOYSKLAD_API_BASE_URL must be a public HTTPS URL.")
    url = f"{base_url}/{path.lstrip('/')}"
    if params:
        url = f"{url}?{parse.urlencode(params)}"
    request = urllib_request.Request(
        url,
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/json;charset=utf-8",
            "Accept-Encoding": "gzip",
        },
        method="GET",
    )
    with urllib_request.urlopen(request, timeout=20) as response:
        raw = response.read()
        if response.headers.get("Content-Encoding") == "gzip":
            import gzip

            raw = gzip.decompress(raw)
        return json.loads(raw.decode("utf-8"))


def build_moysklad_product_events(payload):
    events = []
    for item in payload.get("rows") or []:
        external_id = str(item.get("id") or item.get("code") or item.get("article") or item.get("name") or "")
        events.append(
            MoySkladReadOnlyEvent(
                event_type=MOYSKLAD_EVENT_TYPES["product"],
                external_id=external_id,
                payload={
                    "product_id": external_id,
                    "name": item.get("name") or "",
                    "sku": item.get("article") or item.get("code") or "",
                    "code": item.get("code") or "",
                    "archived": bool(item.get("archived")),
                    "read_only": True,
                    "source": "moysklad",
                    "raw": item,
                },
            )
        )
    return events


def build_moysklad_stock_events(payload):
    events = []
    for item in payload.get("rows") or []:
        meta = item.get("meta") or {}
        external_id = str(item.get("assortmentId") or item.get("id") or meta.get("href") or item.get("name") or "")
        quantity = item.get("quantity") if item.get("quantity") is not None else item.get("stock") or 0
        events.append(
            MoySkladReadOnlyEvent(
                event_type=MOYSKLAD_EVENT_TYPES["stock"],
                external_id=external_id,
                payload={
                    "assortment_id": external_id,
                    "name": item.get("name") or "",
                    "sku": item.get("article") or item.get("code") or "",
                    "quantity": normalize_moysklad_decimal(quantity),
                    "reserve": normalize_moysklad_decimal(item.get("reserve")),
                    "in_transit": normalize_moysklad_decimal(item.get("inTransit")),
                    "available": normalize_moysklad_decimal(item.get("available")),
                    "read_only": True,
                    "source": "moysklad",
                    "raw": item,
                },
            )
        )
    return events


def build_moysklad_sale_events(payload):
    events = []
    for item in payload.get("rows") or []:
        external_id = str(item.get("id") or item.get("name") or "")
        agent = item.get("agent") or {}
        events.append(
            MoySkladReadOnlyEvent(
                event_type=MOYSKLAD_EVENT_TYPES["sale"],
                external_id=external_id,
                payload={
                    "sale_id": external_id,
                    "name": item.get("name") or "",
                    "amount": normalize_moysklad_minor_money(item.get("sum")),
                    "moment": item.get("moment") or "",
                    "applicable": bool(item.get("applicable")),
                    "client_name": agent.get("name") or "",
                    "read_only": True,
                    "source": "moysklad",
                    "raw": item,
                },
            )
        )
    return events


def build_moysklad_client_events(payload):
    events = []
    for item in payload.get("rows") or []:
        external_id = str(item.get("id") or item.get("name") or item.get("phone") or item.get("email") or "")
        events.append(
            MoySkladReadOnlyEvent(
                event_type=MOYSKLAD_EVENT_TYPES["client"],
                external_id=external_id,
                payload={
                    "client_id": external_id,
                    "client_name": item.get("name") or "",
                    "phone": item.get("phone") or "",
                    "email": item.get("email") or "",
                    "read_only": True,
                    "source": "moysklad",
                    "raw": item,
                },
            )
        )
    return events


def normalize_moysklad_decimal(value):
    if value in (None, ""):
        return "0"
    return str(Decimal(str(value)))


def normalize_moysklad_minor_money(value):
    if value in (None, ""):
        return "0"
    return str(Decimal(str(value)) / Decimal("100"))


def _safe_response_meta(payload):
    return {"meta": payload.get("meta") or {}, "context": payload.get("context") or {}}
