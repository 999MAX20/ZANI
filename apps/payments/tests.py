from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch
from uuid import uuid4

from django.db import IntegrityError, transaction
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.activities.models import ActivityEvent
from apps.businesses.models import Business, BusinessMember, BusinessRole, RolePermission, Team, TeamMember
from apps.clients.models import Client
from apps.clients.services import merge_clients, merge_clients_dry_run
from apps.core.models import AuditLog
from apps.crm.models import Deal, Pipeline, PipelineStage
from apps.scheduling.models import Appointment
from apps.services.models import Service
from .models import Payment


class PaymentFlowTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username="pay-owner", email="pay-owner@example.com", password="test-pass", role="business_owner")
        self.other = User.objects.create_user(username="pay-other", email="pay-other@example.com", password="test-pass", role="business_owner")
        self.business = Business.objects.create(owner=self.owner, name="Payments", slug="payments")
        self.foreign = Business.objects.create(owner=self.other, name="Other", slug="pay-other")
        self.client = Client.objects.create(business=self.business, full_name="Client")
        self.other_client = Client.objects.create(business=self.foreign, full_name="Secret client")
        self.manager = User.objects.create_user(username="pay-manager", email="pay-manager@example.com", password="test-pass", role="business_manager")
        self.member = BusinessMember.objects.create(business=self.business, user=self.manager, role="manager")
        self.api = APIClient()
        self.api.force_authenticate(self.owner)
        self.url = "/api/client-payments/"
        self.received_at = timezone.now() - timedelta(days=1)

    def payload(self, **overrides):
        return {"business": self.business.id, "client": self.client.id, "submission_id": str(uuid4()),
                "amount": "120.50", "currency": "KZT", "method": "cash", "note": "",
                "occurred_at": self.received_at.isoformat(), **overrides}

    def post(self, payload=None, **overrides):
        return self.api.post(self.url, payload or self.payload(**overrides), format="json")

    def receipt(self, **overrides):
        response = self.post(**overrides)
        self.assertEqual(response.status_code, 201, response.data)
        return Payment.objects.get(pk=response.data["id"])

    def refund(self, original, amount="20.00", **overrides):
        return {"business": self.business.id, "original": original.pk, "submission_id": str(uuid4()),
                "amount": amount, "occurred_at": timezone.now().isoformat(), "method": "cash",
                "reason": "Returned to client", **overrides}

    def test_receipt_journal_detail_provenance_and_audit(self):
        self.owner.full_name = "Payment recorder"
        self.owner.save(update_fields=["full_name"])
        item = self.receipt(source="one_c", kind="refund")
        self.assertEqual(item.source, "manual")
        self.assertEqual(item.kind, "receipt")
        self.assertEqual(item.created_by, self.owner)
        response = self.api.get(self.url, {"business": self.business.id, "client": self.client.id})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        row = response.data["results"][0]
        self.assertEqual(row["amount"], "120.50")
        self.assertEqual(row["actor_name"], "Payment recorder")
        self.assertTrue(row["can_refund"])
        self.assertNotIn("request_hash", row)
        self.assertEqual(self.api.get(f"{self.url}{item.pk}/", {"business": self.business.id}).status_code, 200)
        self.assertEqual(AuditLog.objects.filter(entity_type="Payment", entity_id=str(item.pk)).count(), 1)
        event = ActivityEvent.objects.get(event_type="client_payment_recorded", entity_id=str(item.pk))
        self.assertEqual(event.metadata, {"payment_id": item.pk})

    def test_partial_receipts_are_independent_records(self):
        self.receipt(amount="30.25")
        self.receipt(amount="90.25")
        self.assertEqual(list(Payment.objects.values_list("amount", flat=True)), [Decimal("90.25"), Decimal("30.25")])

    def test_same_command_is_durable_and_conflicting_payload_denied(self):
        payload = self.payload()
        first = self.post(payload)
        second = self.post(payload)
        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(first.data["id"], second.data["id"])
        self.assertEqual(self.post({**payload, "amount": "200.00"}).status_code, 409)
        self.assertEqual(Payment.objects.count(), 1)
        self.assertEqual(ActivityEvent.objects.filter(event_type="client_payment_recorded").count(), 1)

    def test_refund_partial_full_retry_and_overrefund(self):
        original = self.receipt()
        payload = self.refund(original)
        self.assertEqual(self.post(payload).status_code, 201)
        self.assertEqual(self.post(payload).status_code, 200)
        self.assertEqual(self.post(self.refund(original, "101.00")).status_code, 400)
        self.assertEqual(self.post(self.refund(original, "100.50")).status_code, 201)
        self.assertEqual(self.post(self.refund(original, "0.01")).status_code, 400)
        original.refresh_from_db()
        self.assertEqual(original.refunded_amount, original.amount)
        self.assertEqual(original.refunds.count(), 2)

    def test_refund_invalid_reason_time_context_or_refund_of_refund(self):
        original = self.receipt()
        for changes in ({"reason": " "}, {"occurred_at": (self.received_at - timedelta(hours=1)).isoformat()}, {"client": self.client.pk}):
            with self.subTest(changes=changes):
                self.assertEqual(self.post(self.refund(original, **changes)).status_code, 400)
        response = self.post(self.refund(original))
        refund = Payment.objects.get(pk=response.data["id"])
        self.assertEqual(self.post(self.refund(refund)).status_code, 400)

    def test_manager_can_record_but_not_refund_and_viewer_cannot_read_money(self):
        self.api.force_authenticate(self.manager)
        original = self.receipt()
        self.assertEqual(self.post(self.refund(original)).status_code, 403)
        rows = self.api.get(self.url, {"business": self.business.id}).data["results"]
        self.assertFalse(rows[0]["can_refund"])
        self.member.role = "specialist"
        self.member.save()
        self.assertEqual(self.api.get(self.url, {"business": self.business.id}).status_code, 403)
        self.assertEqual(self.post().status_code, 403)

    def test_inactive_membership_denies_reads_writes_and_replay(self):
        self.api.force_authenticate(self.manager)
        payload = self.payload()
        self.assertEqual(self.post(payload).status_code, 201)
        self.member.is_active = False
        self.member.save()
        self.assertEqual(self.post(payload).status_code, 403)
        self.assertEqual(self.api.get(self.url, {"business": self.business.id}).status_code, 403)

    def test_foreign_tenant_links_list_detail_refund_and_options_denied(self):
        own = self.receipt()
        self.assertEqual(self.post(client=self.other_client.pk).status_code, 404)
        self.assertEqual(self.post(business=self.foreign.pk, client=self.other_client.pk).status_code, 403)
        self.assertEqual(self.api.get(self.url, {"business": self.foreign.pk}).status_code, 403)
        self.api.force_authenticate(self.other)
        self.assertEqual(self.api.get(f"{self.url}{own.pk}/", {"business": self.foreign.pk}).status_code, 404)
        self.assertEqual(self.post(self.refund(own, business=self.foreign.pk)).status_code, 404)
        self.assertEqual(self.api.get(f"{self.url}link-options/", {"business": self.business.pk, "kind": "client"}).status_code, 403)

    def test_invalid_amount_currency_time_and_missing_submission(self):
        for changes in ({"amount": "0"}, {"amount": "-1"}, {"amount": "1.001"}, {"amount": "NaN"},
                        {"currency": "USD"}, {"submission_id": ""}, {"method": "fake"},
                        {"occurred_at": (timezone.now() + timedelta(days=1)).isoformat()}):
            with self.subTest(changes=changes):
                self.assertEqual(self.post(**changes).status_code, 400)
        self.assertEqual(Payment.objects.count(), 0)

    def make_deal(self, client=None):
        pipeline = Pipeline.objects.create(business=self.business, name="Sales")
        stage = PipelineStage.objects.create(business=self.business, pipeline=pipeline, name="New")
        return Deal.objects.create(business=self.business, client=client or self.client, pipeline=pipeline,
                                   stage=stage, title="Scoped deal", amount=500, owner=self.owner)

    def test_deal_link_preserves_lifecycle_and_rejects_wrong_client_currency(self):
        deal = self.make_deal()
        item = self.receipt(deal=deal.pk)
        self.assertEqual(item.deal_id, deal.pk)
        deal.refresh_from_db()
        self.assertEqual(deal.status, "open")
        self.assertIsNone(deal.won_at)
        other = Client.objects.create(business=self.business, full_name="Another")
        self.assertEqual(self.post(client=other.pk, deal=deal.pk).status_code, 404)
        deal.currency = "USD"
        deal.save()
        self.assertEqual(self.post(deal=deal.pk).status_code, 400)

    def test_appointment_link_and_both_links_rejected(self):
        service = Service.objects.create(business=self.business, name="Consultation", duration_minutes=30)
        appointment = Appointment.objects.create(business=self.business, client=self.client, service=service,
                                                 start_at=timezone.now(), end_at=timezone.now() + timedelta(minutes=30))
        item = self.receipt(appointment=appointment.pk)
        self.assertEqual(item.appointment_id, appointment.pk)
        self.assertEqual(self.post(appointment=appointment.pk, deal=self.make_deal().pk).status_code, 400)
        appointment.refresh_from_db()
        self.assertEqual(appointment.status, "created")

    def test_link_scope_rechecked_and_hidden_from_journal(self):
        deal = self.make_deal()
        item = self.receipt(deal=deal.pk)
        self.api.force_authenticate(self.manager)
        self.assertEqual(self.post(deal=deal.pk).status_code, 404)
        row = self.api.get(f"{self.url}{item.pk}/", {"business": self.business.pk}).data
        self.assertIsNone(row["link"])

    def test_disabled_clients_capability_denies_payment_workflow(self):
        self.business.capabilities.update_or_create(module_key="clients", defaults={"is_enabled": False})
        self.assertEqual(self.post().status_code, 403)
        self.assertEqual(self.api.get(self.url, {"business": self.business.pk}).status_code, 403)

    def test_own_scope_only_sees_and_refunds_own_receipts(self):
        own = self.receipt()
        role = BusinessRole.objects.create(business=self.business, name="Scoped payments")
        for action in ("view", "create", "manage"):
            RolePermission.objects.create(business_role=role, resource="payments", action=action, scope="own", is_allowed=True)
        self.member.business_role = role
        self.member.save()
        self.api.force_authenticate(self.manager)
        manager_receipt = self.receipt()
        rows = self.api.get(self.url, {"business": self.business.pk}).data
        self.assertEqual(rows["count"], 1)
        self.assertEqual(self.post(self.refund(own)).status_code, 404)
        self.assertEqual(self.post(self.refund(manager_receipt)).status_code, 201)

    def test_archive_merge_preserve_ledger_refunds_and_retry_identity(self):
        payload = self.payload()
        original = Payment.objects.get(pk=self.post(payload).data["id"])
        self.assertEqual(self.post(self.refund(original)).status_code, 201)
        target = Client.objects.create(business=self.business, full_name="Merge target")
        preview = merge_clients_dry_run(target_client=target, duplicate_client=self.client)
        self.assertEqual(preview["transferred"]["payments"], 2)
        merge_clients(target_client=target, duplicate_client=self.client, actor=self.owner)
        self.assertEqual(Payment.objects.filter(client=target).count(), 2)
        self.assertEqual(self.post(payload).status_code, 200)
        original.refresh_from_db()
        self.assertEqual(self.post(self.refund(original)).status_code, 201)
        target.is_archived = True
        target.save()
        self.assertEqual(self.post(client=target.pk).status_code, 404)
        self.assertEqual(self.api.get(self.url, {"business": self.business.pk, "client": target.pk}).data["count"], 3)

    def test_team_scope_excludes_other_recorders_and_explicit_denial_wins(self):
        self.receipt()
        role = BusinessRole.objects.create(business=self.business, name="Team payments")
        permission = RolePermission.objects.create(business_role=role, resource="payments", action="view", scope="team", is_allowed=True)
        self.member.business_role = role
        self.member.save()
        colleague = User.objects.create_user(username="pay-colleague", email="pay-colleague@example.com", password="test-pass")
        colleague_member = BusinessMember.objects.create(business=self.business, user=colleague, role="manager")
        team = Team.objects.create(business=self.business, name="Reception")
        TeamMember.objects.create(team=team, member=self.member)
        TeamMember.objects.create(team=team, member=colleague_member)
        self.api.force_authenticate(colleague)
        receipt = self.receipt()
        self.api.force_authenticate(self.manager)
        data = self.api.get(self.url, {"business": self.business.pk}).data
        self.assertEqual([row["id"] for row in data["results"]], [receipt.pk])
        permission.is_allowed = False
        permission.save()
        self.assertEqual(self.api.get(self.url, {"business": self.business.pk}).status_code, 403)

    def test_payment_grant_does_not_bypass_client_scope(self):
        item = self.receipt()
        role = BusinessRole.objects.create(business=self.business, name="Restricted client access")
        RolePermission.objects.create(business_role=role, resource="clients", action="view", scope="own", is_allowed=True)
        self.member.business_role = role
        self.member.save()
        self.api.force_authenticate(self.manager)
        self.assertEqual(self.api.get(self.url, {"business": self.business.pk}).data["count"], 0)
        self.assertEqual(self.api.get(f"{self.url}{item.pk}/", {"business": self.business.pk}).status_code, 404)
        self.assertEqual(self.post().status_code, 404)

    def test_no_generic_edit_or_delete(self):
        item = self.receipt()
        for method in ("patch", "put", "delete"):
            self.assertEqual(getattr(self.api, method)(f"{self.url}{item.pk}/", {}, format="json").status_code, 405)

    def test_audit_failure_rolls_back_ledger(self):
        with patch("apps.payments.services.write_actor_audit_log", side_effect=RuntimeError("test failure")):
            self.assertEqual(self.post().status_code, 500)
        self.assertFalse(Payment.objects.exists())

    def test_pagination_filter_validation_and_options(self):
        for _ in range(21):
            self.receipt()
        first = self.api.get(self.url, {"business": self.business.pk}).data
        second = self.api.get(self.url, {"business": self.business.pk, "page": 2}).data
        self.assertEqual(first["count"], 21)
        self.assertEqual(len(first["results"]), 20)
        self.assertEqual(len(second["results"]), 1)
        self.assertFalse({row["id"] for row in first["results"]} & {row["id"] for row in second["results"]})
        response = self.api.get(self.url, {"business": self.business.pk, "q": "missing"})
        self.assertEqual(response.data["count"], 0)
        for params in ({"client": "oops"}, {"kind": "invalid"}):
            self.assertEqual(self.api.get(self.url, {"business": self.business.pk, **params}).status_code, 400)
        options = self.api.get(f"{self.url}link-options/", {"business": self.business.pk, "kind": "client"})
        self.assertEqual(options.status_code, 200)
        self.assertEqual([row["id"] for row in options.data["results"]], [self.client.pk])

    def test_database_prevents_negative_amount_and_duplicate_submission(self):
        item = self.receipt()
        with self.assertRaises(IntegrityError), transaction.atomic():
            Payment.objects.filter(pk=item.pk).update(amount=-1)
        with self.assertRaises(IntegrityError), transaction.atomic():
            Payment.objects.filter(pk=item.pk).update(refunded_amount=Decimal("121"))
        with self.assertRaises(IntegrityError), transaction.atomic():
            item.pk = None
            item.save(force_insert=True)
