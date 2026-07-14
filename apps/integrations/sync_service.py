from datetime import timedelta

from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.integrations.crm_mapping import record_connector_events
from apps.integrations.connectors import run_connector_healthcheck
from apps.integrations.kaspi import sync_kaspi_orders
from apps.integrations.models import BusinessConnector, ConnectorSyncRun
from apps.integrations.moysklad import sync_moysklad
from apps.integrations.ozon import sync_ozon
from apps.integrations.wildberries import sync_wildberries


SYNC_HANDLERS = {
    BusinessConnector.Providers.KASPI: {
        "function": sync_kaspi_orders,
        "next_delta": timedelta(hours=6),
        "failure": "Kaspi sync failed.",
        "audit_kind": "kaspi_sync_orders",
    },
    BusinessConnector.Providers.MOYSKLAD: {
        "function": sync_moysklad,
        "next_delta": timedelta(hours=6),
        "failure": "MoySklad sync failed.",
        "audit_kind": "moysklad_sync",
    },
    BusinessConnector.Providers.WILDBERRIES: {
        "function": sync_wildberries,
        "next_delta": timedelta(minutes=30),
        "failure": "Wildberries sync failed.",
        "audit_kind": "wildberries_sync",
    },
    BusinessConnector.Providers.OZON: {
        "function": sync_ozon,
        "next_delta": timedelta(minutes=30),
        "failure": "Ozon sync failed.",
        "audit_kind": "ozon_sync",
    },
}


def execute_connector_sync(connector):
    config = SYNC_HANDLERS.get(connector.provider)
    if config is None:
        raise ValidationError("This connector does not support safe pull sync retry.")

    result = config["function"](connector)
    events = record_connector_events(connector, result.get("events", []))
    sync_run = result["run"]

    connector.status = BusinessConnector.Statuses.CONNECTED if result.get("ok") else BusinessConnector.Statuses.FAILED
    connector.last_error = "" if result.get("ok") else result.get("reason", config["failure"])
    connector.last_sync_at = sync_run.finished_at or timezone.now()
    connector.next_sync_at = timezone.now() + config["next_delta"]
    if connector.status == BusinessConnector.Statuses.CONNECTED and connector.connected_at is None:
        connector.connected_at = timezone.now()
    connector.save(update_fields=["status", "last_error", "last_sync_at", "next_sync_at", "connected_at", "updated_at"])

    return {
        "ok": result.get("ok", False),
        "mock": result.get("mock", False),
        "reason": result.get("reason", ""),
        "events": events,
        "sync_run": sync_run,
        "audit_kind": config["audit_kind"],
    }


def retry_connector_sync_run(run):
    if run.status != ConnectorSyncRun.Statuses.FAILED:
        raise ValidationError("Only failed sync runs can be retried.")

    if run.mode == ConnectorSyncRun.Modes.HEALTHCHECK:
        new_run = run_connector_healthcheck(run.connector)
        return {
            "ok": new_run.status == ConnectorSyncRun.Statuses.SUCCEEDED,
            "mock": False,
            "reason": new_run.error,
            "events": [],
            "sync_run": new_run,
            "audit_kind": "connector_health_retry",
        }

    if run.mode not in {ConnectorSyncRun.Modes.MANUAL, ConnectorSyncRun.Modes.PULL}:
        raise ValidationError("This sync run cannot be retried safely.")

    return execute_connector_sync(run.connector)
