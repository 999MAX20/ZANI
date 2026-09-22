from dataclasses import replace
from datetime import date, timedelta
from decimal import Decimal
from unittest.mock import patch
from uuid import uuid4

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.businesses.models import Business, BusinessMember, BusinessRole, RolePermission
from apps.clients.models import Client
from apps.integrations.financial_sources import FinancialSnapshot
from apps.integrations.models import BusinessConnector, BusinessEvent, ConnectorSyncRun
from apps.integrations.providers.registry import FINANCIAL_SOURCE_READERS
from apps.payments.models import Payment


class FinancialSourceContractTests(TestCase):
    """Only isolated tests register this synthetic reader; production has none."""

    def setUp(self):
        self.owner = User.objects.create_user(username="finance-owner", email="finance-owner@example.test")
        self.business = Business.objects.create(owner=self.owner, name="Source contract", slug="financial-source", currency="KZT")
        self.api = APIClient()
        self.api.force_authenticate(self.owner)
        self.start, self.end = date(2026, 9, 1), date(2026, 9, 15)
        self.connector = BusinessConnector.objects.create(
            business=self.business, provider="1c", capability="finance", name="Isolated accounting fixture", status="connected",
        )
        self.updated_at = timezone.now() - timedelta(hours=2)
        self.run = ConnectorSyncRun.objects.create(
            business=self.business, connector=self.connector, mode="pull", status="succeeded",
            started_at=self.updated_at - timedelta(minutes=1), finished_at=self.updated_at,
        )
        ConnectorSyncRun.objects.filter(pk=self.run.pk).update(created_at=self.updated_at - timedelta(minutes=1))
        self.snapshot = FinancialSnapshot(
            business_id=self.business.pk, connector_id=self.connector.pk, sync_run_id=self.run.pk,
            period_start=self.start, period_end=self.end, currency="KZT",
            receipts=Decimal("500.00"), refunds=Decimal("200.00"), receipt_count=2, refund_count=1, complete=True,
        )
        self.snapshots = [self.snapshot]
        self.registration = patch.dict(FINANCIAL_SOURCE_READERS, {"1c": lambda connector, start, end: self.snapshots}, clear=True)
        self.registration.start()
        self.addCleanup(self.registration.stop)

    def response(self, endpoint="owner-dashboard", **params):
        return self.api.get(f"/api/analytics/{endpoint}/", {
            "business": self.business.pk, "start": self.start.isoformat(), "end": self.end.isoformat(), **params,
        })

    def financial(self, endpoint="owner-dashboard", **params):
        response = self.response(endpoint, **params)
        self.assertEqual(response.status_code, 200, response.data)
        return response.data["financial"]

    def assert_unavailable(self, payload, reason=None):
        self.assertEqual(payload["state"], "unavailable")
        if reason:
            self.assertEqual(payload["reason"], reason)
        for key in ("receipts", "refunds", "net_receipts", "last_successful_sync_at"):
            self.assertIsNone(payload[key])

    def test_no_source_keeps_operational_metrics_and_finance_is_not_zero(self):
        self.connector.delete()
        response = self.response()
        self.assertEqual(response.status_code, 200)
        self.assert_unavailable(response.data["financial"], "no_source")
        self.assertIn("crm_funnel", response.data)
        self.assertIn("appointments_today", response.data)
        self.assertIsNone(response.data["revenue_estimate"])
        self.assertIsNone(response.data["revenue"]["today"])

    def test_connected_flag_and_arbitrary_events_do_not_create_financial_source(self):
        BusinessEvent.objects.create(
            business=self.business, connector=self.connector, event_type="sale.recorded", source="1c",
            deduplication_key="unverified", payload_json={"amount": "999999.00", "verified": True}, status="processed",
        )
        with patch.dict(FINANCIAL_SOURCE_READERS, {}, clear=True):
            result = self.response()
            self.assert_unavailable(result.data["financial"], "unsupported_source")
            self.assertIsNone(result.data["latest_business_events"][0]["amount"])
            self.assertIsNone(result.data["revenue"]["total_estimate"])

    def test_incomplete_first_load_and_healthcheck_are_not_ready(self):
        self.connector.status = "syncing"
        self.connector.save()
        self.snapshots = [replace(self.snapshot, complete=False)]
        self.assert_unavailable(self.financial(), "initial_sync")
        self.connector.status = "connected"
        self.connector.save()
        self.snapshots = [self.snapshot]
        self.run.mode = "healthcheck"
        self.run.save()
        self.assert_unavailable(self.financial(), "no_verified_snapshot")

    def test_verified_zero_is_available_only_for_its_complete_period(self):
        self.snapshots = [replace(self.snapshot, receipts=Decimal("0"), refunds=Decimal("0"), receipt_count=0, refund_count=0)]
        for endpoint in ("owner-dashboard", "reports/summary"):
            with self.subTest(endpoint=endpoint):
                payload = self.financial(endpoint)
                self.assertEqual(payload["state"], "available")
                self.assertEqual(payload["net_receipts"], "0")
                self.assertEqual(payload["period"], {"start": "2026-09-01", "end": "2026-09-15"})
                self.assertEqual(payload["last_successful_sync_at"], self.updated_at.isoformat())
        self.assert_unavailable(self.financial(start="2026-09-02"), "no_verified_snapshot")

    def test_receipt_refund_snapshot_is_not_added_to_manual_ledger(self):
        client = Client.objects.create(business=self.business, full_name="Manual client")
        payload = {"business": self.business.pk, "client": client.pk, "submission_id": str(uuid4()),
                   "amount": "120.00", "currency": "KZT", "method": "cash", "occurred_at": self.updated_at.isoformat()}
        receipt = self.api.post("/api/client-payments/", payload, format="json")
        self.assertEqual(receipt.status_code, 201, receipt.data)
        self.assertEqual(self.api.post("/api/client-payments/", payload, format="json").status_code, 200)
        refund = self.api.post("/api/client-payments/", {
            "business": self.business.pk, "original": receipt.data["id"], "submission_id": str(uuid4()),
            "amount": "20.00", "method": "cash", "occurred_at": timezone.now().isoformat(), "reason": "Manual refund",
        }, format="json")
        self.assertEqual(refund.status_code, 201, refund.data)
        for endpoint in ("owner-dashboard", "reports/summary"):
            data = self.financial(endpoint)
            self.assertEqual((data["receipts"], data["refunds"], data["net_receipts"]), ("500.00", "200.00", "300.00"))
            self.assertEqual(data["source"]["id"], self.connector.pk)
        self.assertEqual(Payment.objects.count(), 2)
        self.assertEqual(self.api.get("/api/client-payments/", {"business": self.business.pk}).data["count"], 2)

    def test_failed_refresh_preserves_snapshot_and_uses_success_time_not_failure_time(self):
        self.connector.status = "failed"
        self.connector.last_sync_at = timezone.now()
        self.connector.save()
        ConnectorSyncRun.objects.create(business=self.business, connector=self.connector, mode="pull", status="failed", finished_at=timezone.now())
        payload = self.financial()
        self.assertEqual(payload["state"], "stale")
        self.assertEqual(payload["reason"], "sync_failed")
        self.assertEqual(payload["last_successful_sync_at"], self.updated_at.isoformat())
        self.assertEqual(payload["net_receipts"], "300.00")
        self.snapshots = []
        self.assert_unavailable(self.financial(), "no_verified_snapshot")

    def test_stopped_and_overdue_refresh_retain_data_without_invented_ttl(self):
        for status in ("disconnected", "disabled"):
            self.connector.status = status
            self.connector.save()
            self.assertEqual(self.financial()["reason"], "sync_stopped")
        self.connector.status = "connected"
        self.connector.next_sync_at = timezone.now() - timedelta(minutes=1)
        self.connector.save()
        self.assertEqual(self.financial()["reason"], "sync_overdue")
        self.connector.next_sync_at = None
        self.connector.save()
        self.assertEqual(self.financial()["state"], "available")

    def test_incomplete_later_snapshot_does_not_replace_previous_verified_one(self):
        later = ConnectorSyncRun.objects.create(business=self.business, connector=self.connector, mode="pull", status="succeeded", finished_at=timezone.now())
        self.snapshots.append(replace(self.snapshot, sync_run_id=later.pk, complete=False, receipts=Decimal("900")))
        payload = self.financial()
        self.assertEqual(payload["state"], "stale")
        self.assertEqual(payload["net_receipts"], "300.00")
        self.assertEqual(payload["last_successful_sync_at"], self.updated_at.isoformat())

    def test_invalid_snapshot_values_and_provenance_fail_closed(self):
        cases = [
            {"business_id": self.business.pk + 100}, {"connector_id": self.connector.pk + 100},
            {"sync_run_id": self.run.pk + 100}, {"currency": "USD"}, {"complete": False},
            {"receipts": Decimal("NaN")}, {"refunds": Decimal("-1")},
            {"receipts": Decimal("0"), "receipt_count": 1}, {"receipt_count": 0},
            {"sync_run_id": "invalid"}, {"business_id": True},
        ]
        for changes in cases:
            with self.subTest(changes=changes):
                self.snapshots = [replace(self.snapshot, **changes)]
                self.assert_unavailable(self.financial(), "no_verified_snapshot")

    def test_scope_and_tenant_guards_apply_to_stale_snapshots(self):
        self.connector.status = "failed"
        self.connector.save()
        operator = User.objects.create_user(username="finance-operator", email="finance-operator@example.test")
        BusinessMember.objects.create(business=self.business, user=operator, role="operator")
        self.api.force_authenticate(operator)
        self.assertEqual(self.response().status_code, 403)
        for scope in ("own", "team"):
            user = User.objects.create_user(username=f"finance-{scope}", email=f"finance-{scope}@example.test")
            role = BusinessRole.objects.create(business=self.business, name=scope)
            RolePermission.objects.create(business_role=role, resource="analytics", action="view", scope=scope)
            BusinessMember.objects.create(business=self.business, user=user, role="operator", business_role=role)
            self.api.force_authenticate(user)
            payload = self.financial()
            self.assert_unavailable(payload, "permission_denied")
            self.assertIsNone(payload["source"])
        foreign = User.objects.create_user(username="finance-foreign", email="finance-foreign@example.test")
        self.api.force_authenticate(foreign)
        self.assertEqual(self.response().status_code, 400)

    def test_foreign_successful_run_cannot_certify_this_business_snapshot(self):
        user = User.objects.create_user(username="other-finance-owner", email="other-finance-owner@example.test")
        business = Business.objects.create(owner=user, name="Foreign finance", slug="foreign-finance")
        connector = BusinessConnector.objects.create(business=business, provider="1c", name="Foreign source", status="connected")
        run = ConnectorSyncRun.objects.create(business=business, connector=connector, mode="pull", status="succeeded", finished_at=self.updated_at)
        self.snapshots = [replace(self.snapshot, sync_run_id=run.pk)]
        self.assert_unavailable(self.financial(), "no_verified_snapshot")

    def test_multiple_supported_sources_are_not_automatically_summed(self):
        BusinessConnector.objects.create(business=self.business, provider="1c", name="Second isolated source", status="connected")
        self.assert_unavailable(self.financial(), "multiple_sources")

    def test_future_success_and_reader_failure_do_not_expose_finance(self):
        self.run.finished_at = timezone.now() + timedelta(days=1)
        self.run.save()
        self.assert_unavailable(self.financial(), "no_verified_snapshot")
        with patch("apps.analytics.financial_metrics.get_financial_source_reader") as lookup:
            lookup.return_value.side_effect = RuntimeError("private provider credential")
            response = self.response()
            self.assertEqual(response.status_code, 200)
            self.assert_unavailable(response.data["financial"], "source_unavailable")
            self.assertNotIn("private provider credential", str(response.data))

    def test_overlapping_failed_refresh_keeps_verified_snapshot_stale(self):
        failed = ConnectorSyncRun.objects.create(
            business=self.business, connector=self.connector, mode="pull", status="failed", finished_at=timezone.now(),
        )
        # A later run can begin while the verified run is still finishing.
        ConnectorSyncRun.objects.filter(pk=failed.pk).update(created_at=self.updated_at - timedelta(seconds=30))
        payload = self.financial()
        self.assertEqual(payload["state"], "stale")
        self.assertEqual(payload["reason"], "sync_failed")
        self.assertEqual(payload["net_receipts"], "300.00")
