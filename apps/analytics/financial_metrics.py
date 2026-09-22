"""Permission-aware financial availability; operational estimates never enter it."""
from datetime import date
from decimal import Decimal

from django.utils import timezone

from apps.businesses.access import Actions, Resources, can
from apps.businesses.capabilities import resource_is_enabled
from apps.businesses.models import RolePermission
from apps.integrations.financial_sources import FinancialSnapshot
from apps.integrations.models import BusinessConnector, ConnectorSyncRun
from apps.integrations.providers.registry import get_financial_source_reader


def financial_report(business, *, user, start_date, end_date, now=None):
    now = now or timezone.now()
    result = {
        "state": "unavailable", "reason": "no_source",
        "period": {"start": start_date.isoformat(), "end": end_date.isoformat()},
        "source": None, "last_successful_sync_at": None,
        "currency": business.currency, "receipts": None, "refunds": None,
        "net_receipts": None,
    }
    permission = can(user, business, Resources.ANALYTICS, Actions.VIEW)
    if (not resource_is_enabled(business, Resources.ANALYTICS)
            or not permission.allowed or permission.scope != RolePermission.Scopes.BUSINESS):
        return {**result, "reason": "permission_denied"}

    connectors = list(BusinessConnector.objects.filter(business=business))
    supported = [(connector, get_financial_source_reader(connector.provider)) for connector in connectors]
    supported = [(connector, reader) for connector, reader in supported if reader is not None]
    if not supported:
        if any(connector.capability == BusinessConnector.Capabilities.FINANCE for connector in connectors):
            result["reason"] = "unsupported_source"
        return result
    if len(supported) != 1:
        # Never select or sum multiple systems without an explicit source policy.
        return {**result, "reason": "multiple_sources"}

    connector, reader = supported[0]
    result["source"] = {"id": connector.pk, "name": connector.name, "provider": connector.provider}
    try:
        snapshots = list(reader(connector, start_date, end_date))
    except Exception:
        # Readers load local snapshots, not a live provider. Do not expose errors
        # or substitute unverified event/ledger values when that read fails.
        return {**result, "reason": "source_unavailable"}
    runs_query = ConnectorSyncRun.objects.filter(business=business, connector=connector).exclude(mode=ConnectorSyncRun.Modes.HEALTHCHECK)
    candidates = [snapshot for snapshot in snapshots if _valid_snapshot(snapshot, business, connector, start_date, end_date)]
    runs = {run.pk: run for run in runs_query.filter(pk__in=[snapshot.sync_run_id for snapshot in candidates])}
    latest_run = runs_query.order_by("-created_at", "-pk").first()
    verified = []
    for snapshot in candidates:
        run = runs.get(snapshot.sync_run_id)
        if (run is not None and run.status == ConnectorSyncRun.Statuses.SUCCEEDED
                and run.mode != ConnectorSyncRun.Modes.HEALTHCHECK
                and run.finished_at is not None and run.finished_at <= now):
            verified.append((run, snapshot))
    if not verified:
        loading = connector.status == BusinessConnector.Statuses.SYNCING or (
            latest_run is not None and latest_run.status in {ConnectorSyncRun.Statuses.QUEUED, ConnectorSyncRun.Statuses.RUNNING}
        )
        return {**result, "reason": "initial_sync" if loading else "no_verified_snapshot"}

    run, snapshot = max(verified, key=lambda item: (item[0].finished_at, item[0].pk))
    stale_reason = _stale_reason(connector, run, latest_run, now)
    return {
        **result, "state": "stale" if stale_reason else "available",
        "reason": stale_reason, "last_successful_sync_at": run.finished_at.isoformat(),
        "receipts": str(snapshot.receipts), "refunds": str(snapshot.refunds),
        "net_receipts": str(snapshot.receipts - snapshot.refunds),
    }


def _valid_snapshot(snapshot, business, connector, start_date, end_date):
    if not isinstance(snapshot, FinancialSnapshot) or snapshot.complete is not True:
        return False
    if any(type(value) is not int or value <= 0 for value in (snapshot.business_id, snapshot.connector_id, snapshot.sync_run_id)):
        return False
    if (snapshot.business_id != business.pk or snapshot.connector_id != connector.pk
            or snapshot.currency != business.currency
            or type(snapshot.period_start) is not date or type(snapshot.period_end) is not date
            or snapshot.period_start != start_date or snapshot.period_end != end_date):
        return False
    for amount, count in ((snapshot.receipts, snapshot.receipt_count), (snapshot.refunds, snapshot.refund_count)):
        if (not isinstance(amount, Decimal) or not amount.is_finite() or amount < 0
                or type(count) is not int or count < 0 or (count == 0) != (amount == 0)):
            return False
    return True


def _stale_reason(connector, snapshot_run, latest_run, now):
    failed = {
        BusinessConnector.Statuses.ERROR, BusinessConnector.Statuses.FAILED,
        BusinessConnector.Statuses.EXPIRED_CREDENTIALS, BusinessConnector.Statuses.NEEDS_ATTENTION,
    }
    if connector.status in failed:
        return "sync_failed"
    if connector.status not in {BusinessConnector.Statuses.CONNECTED, BusinessConnector.Statuses.SYNCING}:
        return "sync_stopped"
    if latest_run is not None and latest_run.pk != snapshot_run.pk and latest_run.created_at >= snapshot_run.created_at:
        if latest_run.status == ConnectorSyncRun.Statuses.FAILED:
            return "sync_failed"
        if latest_run.status != ConnectorSyncRun.Statuses.SUCCEEDED:
            return "updating"
        return "snapshot_not_refreshed"
    if connector.status == BusinessConnector.Statuses.SYNCING:
        return "updating"
    # Use the connector's existing schedule; do not invent a freshness TTL.
    if connector.next_sync_at is not None and connector.next_sync_at <= now:
        return "sync_overdue"
    return None
