from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.activities.models import ActivityEvent
from apps.activities.taxonomy import ActivityEvents
from apps.businesses.access import ensure_default_roles
from apps.businesses.models import Business, BusinessMember, BusinessRole
from apps.core.models import AuditLog, CustomFieldDefinition, CustomFieldValue
from apps.clients.models import Client
from apps.crm.models import Deal, DealStageHistory, DealValueHistory, Pipeline, PipelineStage
from apps.tasks.models import Task


class PipelineStageEngineUpgradeTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.owner = User.objects.create_user(
            username="pipeline-owner",
            email="pipeline-owner@example.com",
            password="pass",
            role=User.Roles.BUSINESS_OWNER,
        )
        self.manager = User.objects.create_user(
            username="pipeline-manager",
            email="pipeline-manager@example.com",
            password="pass",
            role=User.Roles.BUSINESS_MANAGER,
        )
        self.business = Business.objects.create(owner=self.owner, name="Pipeline Clinic", slug="pipeline-clinic")
        ensure_default_roles(self.business)
        BusinessMember.objects.create(
            business=self.business,
            user=self.owner,
            role=BusinessMember.Roles.OWNER,
            business_role=BusinessRole.objects.get(business=self.business, preset_key=BusinessMember.Roles.OWNER),
        )
        BusinessMember.objects.create(
            business=self.business,
            user=self.manager,
            role=BusinessMember.Roles.MANAGER,
            business_role=BusinessRole.objects.get(business=self.business, preset_key=BusinessMember.Roles.MANAGER),
        )
        self.client = Client.objects.create(business=self.business, full_name="Pipeline Client")
        self.pipeline = Pipeline.objects.create(business=self.business, name="Sales", slug="sales", is_default=True)
        self.new_stage = PipelineStage.objects.create(business=self.business, pipeline=self.pipeline, name="New", order=1, probability=10)
        self.offer_stage = PipelineStage.objects.create(
            business=self.business,
            pipeline=self.pipeline,
            name="Offer",
            order=2,
            probability=60,
            required_fields_json={"fields": ["amount"]},
            sla_minutes=1,
        )
        self.won_stage = PipelineStage.objects.create(
            business=self.business,
            pipeline=self.pipeline,
            name="Paid",
            order=3,
            probability=100,
            is_won=True,
        )
        self.lost_stage = PipelineStage.objects.create(
            business=self.business,
            pipeline=self.pipeline,
            name="Lost",
            order=4,
            is_lost=True,
            required_fields_json={"fields": ["lost_reason"]},
        )
        self.deal = Deal.objects.create(
            business=self.business,
            client=self.client,
            pipeline=self.pipeline,
            stage=self.new_stage,
            title="Pipeline deal",
            amount=0,
        )
        self.api.force_authenticate(self.owner)

    def test_move_stage_requires_configured_fields(self):
        response = self.api.post(f"/api/deals/{self.deal.id}/move-stage/", {"stage": self.offer_stage.id}, format="json")

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["required_fields"], ["amount"])

    def test_move_stage_requires_configured_custom_fields(self):
        definition = CustomFieldDefinition.objects.create(
            business=self.business,
            entity_type=CustomFieldDefinition.EntityTypes.DEAL,
            key="decision_maker",
            label="Decision maker",
        )
        self.offer_stage.required_fields_json = {"fields": ["amount"], "custom_fields": ["decision_maker"]}
        self.offer_stage.save(update_fields=["required_fields_json", "updated_at"])

        invalid = self.api.post(f"/api/deals/{self.deal.id}/move-stage/", {"stage": self.offer_stage.id}, format="json")
        CustomFieldValue.objects.create(
            business=self.business,
            definition=definition,
            entity_type=CustomFieldDefinition.EntityTypes.DEAL,
            entity_id=str(self.deal.id),
            value_json={"value": "Aruzhan"},
        )
        valid = self.api.post(
            f"/api/deals/{self.deal.id}/move-stage/",
            {"stage": self.offer_stage.id, "amount": "10000"},
            format="json",
        )

        self.assertEqual(invalid.status_code, 400)
        self.assertEqual(invalid.data["required_fields"], ["amount"])
        self.assertEqual(invalid.data["required_custom_fields"], ["decision_maker"])
        self.assertEqual(valid.status_code, 200)

    def test_move_stage_accepts_custom_field_id_reference_and_ignores_inactive_definition(self):
        definition = CustomFieldDefinition.objects.create(
            business=self.business,
            entity_type=CustomFieldDefinition.EntityTypes.DEAL,
            key="approval_code",
            label="Approval code",
        )
        inactive_definition = CustomFieldDefinition.objects.create(
            business=self.business,
            entity_type=CustomFieldDefinition.EntityTypes.DEAL,
            key="archived_requirement",
            label="Archived requirement",
            is_active=False,
        )
        self.offer_stage.required_fields_json = {
            "custom_fields": [str(definition.id), "archived_requirement"],
        }
        self.offer_stage.save(update_fields=["required_fields_json", "updated_at"])

        invalid = self.api.post(f"/api/deals/{self.deal.id}/move-stage/", {"stage": self.offer_stage.id}, format="json")
        CustomFieldValue.objects.create(
            business=self.business,
            definition=definition,
            entity_type=CustomFieldDefinition.EntityTypes.DEAL,
            entity_id=str(self.deal.id),
            value_json={"value": "APP-1"},
        )
        valid = self.api.post(f"/api/deals/{self.deal.id}/move-stage/", {"stage": self.offer_stage.id}, format="json")

        self.assertEqual(invalid.status_code, 400)
        self.assertEqual(invalid.data["required_custom_fields"], ["approval_code"])
        self.assertEqual(valid.status_code, 200)

    def test_move_stage_updates_status_timestamps_and_activity(self):
        self.deal.amount = 10000
        self.deal.save(update_fields=["amount", "updated_at"])

        response = self.api.post(f"/api/deals/{self.deal.id}/move-stage/", {"stage": self.offer_stage.id}, format="json")

        self.assertEqual(response.status_code, 200)
        self.deal.refresh_from_db()
        self.assertEqual(self.deal.stage, self.offer_stage)
        self.assertIsNotNone(self.deal.stage_entered_at)
        self.assertTrue(ActivityEvent.objects.filter(business=self.business, entity_type="Deal", entity_id=str(self.deal.id), event_type=ActivityEvents.DEAL_STAGE_CHANGED).exists())
        self.assertTrue(
            AuditLog.objects.filter(
                business=self.business,
                entity_type="Deal",
                entity_id=str(self.deal.id),
                metadata__kind="lifecycle",
                metadata__event_type=ActivityEvents.DEAL_STAGE_CHANGED,
                metadata__lifecycle_action=ActivityEvents.DEAL_STAGE_CHANGED,
            ).exists()
        )
        history = DealStageHistory.objects.get(business=self.business, deal=self.deal)
        self.assertEqual(history.from_stage, self.new_stage)
        self.assertEqual(history.to_stage, self.offer_stage)
        self.assertEqual(history.from_status, Deal.Statuses.OPEN)
        self.assertEqual(history.to_status, Deal.Statuses.OPEN)
        self.assertEqual(str(history.amount_before), "10000.00")
        self.assertEqual(str(history.amount_after), "10000.00")
        self.assertEqual(history.actor, self.owner)

    def test_lost_reason_is_required_and_saved(self):
        invalid = self.api.post(f"/api/deals/{self.deal.id}/move-stage/", {"stage": self.lost_stage.id}, format="json")
        valid = self.api.post(
            f"/api/deals/{self.deal.id}/move-stage/",
            {"stage": self.lost_stage.id, "lost_reason": "No budget"},
            format="json",
        )

        self.assertEqual(invalid.status_code, 400)
        self.assertEqual(valid.status_code, 200)
        self.deal.refresh_from_db()
        self.assertEqual(self.deal.status, Deal.Statuses.LOST)
        self.assertEqual(self.deal.lost_reason, "No budget")
        self.assertIsNotNone(self.deal.lost_at)

    def test_generic_patch_cannot_bypass_deal_lifecycle_actions(self):
        response = self.api.patch(
            f"/api/deals/{self.deal.id}/",
            {"stage": self.lost_stage.id, "status": Deal.Statuses.LOST, "lost_reason": "Bypass attempt"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["fields"], ["lost_reason", "stage", "status"])
        self.deal.refresh_from_db()
        self.assertEqual(self.deal.status, Deal.Statuses.OPEN)
        self.assertEqual(self.deal.stage, self.new_stage)
        self.assertEqual(self.deal.lost_reason, "")

    def test_generic_lost_reason_patch_cannot_satisfy_lost_stage_requirement(self):
        reason_response = self.api.patch(
            f"/api/deals/{self.deal.id}/",
            {"lost_reason": "Seeded outside lifecycle"},
            format="json",
        )
        move_response = self.api.post(f"/api/deals/{self.deal.id}/move-stage/", {"stage": self.lost_stage.id}, format="json")

        self.assertEqual(reason_response.status_code, 400)
        self.assertEqual(move_response.status_code, 400)
        self.assertEqual(move_response.data["required_fields"], ["lost_reason"])
        self.deal.refresh_from_db()
        self.assertEqual(self.deal.status, Deal.Statuses.OPEN)

    def test_generic_patch_cannot_bypass_deal_archive_action(self):
        response = self.api.patch(
            f"/api/deals/{self.deal.id}/",
            {"is_archived": True, "archive_reason": "Bypass attempt"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["fields"], ["archive_reason", "is_archived"])
        self.deal.refresh_from_db()
        self.assertFalse(self.deal.is_archived)
        self.assertEqual(self.deal.archive_reason, "")

    def test_create_deal_cannot_seed_archive_state(self):
        response = self.api.post(
            "/api/deals/",
            {
                "business": self.business.id,
                "client": self.client.id,
                "pipeline": self.pipeline.id,
                "stage": self.new_stage.id,
                "title": "Archived at birth",
                "is_archived": True,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["fields"], ["is_archived"])

    def test_create_deal_rejects_owner_outside_business(self):
        foreign_user = User.objects.create_user(username="foreign-deal-owner", email="foreign-deal-owner@example.com", password="pass")

        response = self.api.post(
            "/api/deals/",
            {
                "business": self.business.id,
                "client": self.client.id,
                "pipeline": self.pipeline.id,
                "stage": self.new_stage.id,
                "title": "Foreign owner",
                "owner": foreign_user.id,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("owner", response.data)

    def test_move_stage_rejects_foreign_stage(self):
        other_business = Business.objects.create(owner=self.owner, name="Other Pipeline Clinic", slug="other-pipeline-clinic")
        other_pipeline = Pipeline.objects.create(business=other_business, name="Other Sales", slug="other-sales")
        other_stage = PipelineStage.objects.create(business=other_business, pipeline=other_pipeline, name="Other", order=1)

        response = self.api.post(f"/api/deals/{self.deal.id}/move-stage/", {"stage": other_stage.id}, format="json")

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["stage"], "Stage does not exist in this deal pipeline.")

    def test_manager_cannot_move_unowned_deal(self):
        self.api.force_authenticate(self.manager)

        response = self.api.post(f"/api/deals/{self.deal.id}/move-stage/", {"stage": self.offer_stage.id, "amount": "10000"}, format="json")

        self.assertEqual(response.status_code, 404)
        self.deal.refresh_from_db()
        self.assertEqual(self.deal.stage, self.new_stage)

    def test_amount_update_writes_value_history_activity_and_audit(self):
        response = self.api.patch(f"/api/deals/{self.deal.id}/", {"amount": "12345.67"}, format="json")

        self.assertEqual(response.status_code, 200)
        self.deal.refresh_from_db()
        self.assertEqual(str(self.deal.amount), "12345.67")
        history = DealValueHistory.objects.get(business=self.business, deal=self.deal)
        self.assertEqual(str(history.amount_before), "0.00")
        self.assertEqual(str(history.amount_after), "12345.67")
        self.assertEqual(history.currency_before, "KZT")
        self.assertEqual(history.currency_after, "KZT")
        self.assertEqual(history.actor, self.owner)
        self.assertEqual(history.metadata["event_type"], ActivityEvents.DEAL_VALUE_CHANGED)
        self.assertTrue(
            ActivityEvent.objects.filter(
                business=self.business,
                entity_type="Deal",
                entity_id=str(self.deal.id),
                event_type=ActivityEvents.DEAL_VALUE_CHANGED,
                metadata__amount_before="0.00",
                metadata__amount_after="12345.67",
                metadata__event_type=ActivityEvents.DEAL_VALUE_CHANGED,
            ).exists()
        )
        self.assertTrue(
            AuditLog.objects.filter(
                business=self.business,
                entity_type="Deal",
                entity_id=str(self.deal.id),
                metadata__kind="deal_value",
                metadata__event_type=ActivityEvents.DEAL_VALUE_CHANGED,
                metadata__amount_after="12345.67",
            ).exists()
        )

    def test_non_value_update_does_not_write_value_history(self):
        response = self.api.patch(f"/api/deals/{self.deal.id}/", {"title": "Renamed pipeline deal"}, format="json")

        self.assertEqual(response.status_code, 200)
        self.assertFalse(DealValueHistory.objects.filter(business=self.business, deal=self.deal).exists())
        self.assertFalse(ActivityEvent.objects.filter(business=self.business, entity_type="Deal", entity_id=str(self.deal.id), event_type="deal_value_changed").exists())

    def test_manager_cannot_update_unowned_deal_amount(self):
        self.api.force_authenticate(self.manager)

        response = self.api.patch(f"/api/deals/{self.deal.id}/", {"amount": "999"}, format="json")

        self.assertEqual(response.status_code, 404)
        self.deal.refresh_from_db()
        self.assertEqual(str(self.deal.amount), "0.00")
        self.assertFalse(DealValueHistory.objects.filter(business=self.business, deal=self.deal).exists())

    def test_deal_value_update_is_tenant_isolated(self):
        other_owner = User.objects.create_user(
            username="other-deal-owner",
            email="other-deal-owner@example.com",
            password="pass",
            role=User.Roles.BUSINESS_OWNER,
        )
        other_business = Business.objects.create(owner=other_owner, name="Other Deal Clinic", slug="other-deal-clinic")
        ensure_default_roles(other_business)
        BusinessMember.objects.create(
            business=other_business,
            user=other_owner,
            role=BusinessMember.Roles.OWNER,
            business_role=BusinessRole.objects.get(business=other_business, preset_key=BusinessMember.Roles.OWNER),
        )
        other_client = Client.objects.create(business=other_business, full_name="Other Client")
        other_pipeline = Pipeline.objects.create(business=other_business, name="Other Sales", slug="other-sales")
        other_stage = PipelineStage.objects.create(business=other_business, pipeline=other_pipeline, name="Other New", order=1)
        other_deal = Deal.objects.create(
            business=other_business,
            client=other_client,
            pipeline=other_pipeline,
            stage=other_stage,
            title="Other deal",
            amount=500,
        )

        response = self.api.patch(f"/api/deals/{other_deal.id}/", {"amount": "999"}, format="json")

        self.assertEqual(response.status_code, 404)
        other_deal.refresh_from_db()
        self.assertEqual(str(other_deal.amount), "500.00")
        self.assertFalse(DealValueHistory.objects.filter(business=other_business, deal=other_deal).exists())

    def test_quick_mark_won_moves_to_won_stage_without_dragging(self):
        response = self.api.post(f"/api/deals/{self.deal.id}/mark-won/", {"amount": "15000"}, format="json")

        self.assertEqual(response.status_code, 200)
        self.deal.refresh_from_db()
        self.assertEqual(self.deal.stage, self.won_stage)
        self.assertEqual(self.deal.status, Deal.Statuses.WON)
        self.assertEqual(str(self.deal.amount), "15000.00")
        self.assertIsNotNone(self.deal.won_at)
        value_history = DealValueHistory.objects.get(business=self.business, deal=self.deal)
        self.assertEqual(str(value_history.amount_before), "0.00")
        self.assertEqual(str(value_history.amount_after), "15000.00")
        self.assertEqual(value_history.metadata["event_type"], ActivityEvents.DEAL_VALUE_CHANGED)
        self.assertEqual(value_history.metadata["source_event_type"], ActivityEvents.DEAL_WON)
        history = DealStageHistory.objects.get(business=self.business, deal=self.deal)
        self.assertEqual(history.from_stage, self.new_stage)
        self.assertEqual(history.to_stage, self.won_stage)
        self.assertEqual(history.from_status, Deal.Statuses.OPEN)
        self.assertEqual(history.to_status, Deal.Statuses.WON)
        self.assertEqual(str(history.amount_before), "0.00")
        self.assertEqual(str(history.amount_after), "15000.00")
        self.assertTrue(ActivityEvent.objects.filter(business=self.business, entity_type="Deal", entity_id=str(self.deal.id), event_type=ActivityEvents.DEAL_WON).exists())
        self.assertTrue(
            ActivityEvent.objects.filter(
                business=self.business,
                entity_type="Deal",
                entity_id=str(self.deal.id),
                event_type=ActivityEvents.DEAL_VALUE_CHANGED,
                metadata__source_event_type=ActivityEvents.DEAL_WON,
            ).exists()
        )
        self.assertTrue(
            AuditLog.objects.filter(
                business=self.business,
                entity_type="Deal",
                entity_id=str(self.deal.id),
                metadata__kind="lifecycle",
                metadata__event_type=ActivityEvents.DEAL_WON,
                metadata__lifecycle_action=ActivityEvents.DEAL_WON,
            ).exists()
        )

    def test_quick_mark_lost_requires_reason_and_can_reopen(self):
        invalid = self.api.post(f"/api/deals/{self.deal.id}/mark-lost/", {}, format="json")
        valid = self.api.post(f"/api/deals/{self.deal.id}/mark-lost/", {"lost_reason": "Client refused"}, format="json")

        self.assertEqual(invalid.status_code, 400)
        self.assertEqual(valid.status_code, 200)
        self.deal.refresh_from_db()
        self.assertEqual(self.deal.status, Deal.Statuses.LOST)
        self.assertEqual(self.deal.stage, self.lost_stage)
        self.assertEqual(self.deal.previous_stage, self.new_stage)
        self.assertEqual(self.deal.lost_reason, "Client refused")
        lost_history = DealStageHistory.objects.get(business=self.business, deal=self.deal)
        self.assertEqual(lost_history.from_stage, self.new_stage)
        self.assertEqual(lost_history.to_stage, self.lost_stage)
        self.assertEqual(lost_history.from_status, Deal.Statuses.OPEN)
        self.assertEqual(lost_history.to_status, Deal.Statuses.LOST)
        self.assertEqual(lost_history.metadata["event_type"], ActivityEvents.DEAL_LOST)

        reopened = self.api.post(f"/api/deals/{self.deal.id}/reopen/", {}, format="json")

        self.assertEqual(reopened.status_code, 200)
        self.deal.refresh_from_db()
        self.assertEqual(self.deal.status, Deal.Statuses.OPEN)
        self.assertEqual(self.deal.stage, self.new_stage)
        self.assertEqual(self.deal.lost_reason, "")
        reopen_history = DealStageHistory.objects.filter(business=self.business, deal=self.deal).order_by("-created_at").first()
        self.assertEqual(reopen_history.from_stage, self.lost_stage)
        self.assertEqual(reopen_history.to_stage, self.new_stage)
        self.assertEqual(reopen_history.from_status, Deal.Statuses.LOST)
        self.assertEqual(reopen_history.to_status, Deal.Statuses.OPEN)
        self.assertTrue(
            ActivityEvent.objects.filter(
                business=self.business,
                entity_type="Deal",
                entity_id=str(self.deal.id),
                event_type=ActivityEvents.DEAL_LOST,
                metadata__lost_reason="Client refused",
            ).exists()
        )
        self.assertTrue(
            ActivityEvent.objects.filter(
                business=self.business,
                entity_type="Deal",
                entity_id=str(self.deal.id),
                event_type=ActivityEvents.DEAL_REOPENED,
                metadata__cleared_lost_reason="Client refused",
            ).exists()
        )
        self.assertTrue(
            AuditLog.objects.filter(
                business=self.business,
                entity_type="Deal",
                entity_id=str(self.deal.id),
                metadata__kind="lifecycle",
                metadata__event_type=ActivityEvents.DEAL_LOST,
                metadata__lifecycle_action=ActivityEvents.DEAL_LOST,
                metadata__lost_reason="Client refused",
            ).exists()
        )
        self.assertTrue(
            AuditLog.objects.filter(
                business=self.business,
                entity_type="Deal",
                entity_id=str(self.deal.id),
                metadata__kind="lifecycle",
                metadata__event_type=ActivityEvents.DEAL_REOPENED,
                metadata__lifecycle_action=ActivityEvents.DEAL_REOPENED,
                metadata__cleared_lost_reason="Client refused",
            ).exists()
        )

    def test_pipeline_board_returns_stages_with_deals(self):
        response = self.api.get(f"/api/pipelines/{self.pipeline.id}/board/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["pipeline"]["id"], self.pipeline.id)
        self.assertEqual(response.data["stages"][0]["deals"][0]["id"], self.deal.id)

    def test_pipeline_template_apply_creates_default_stages(self):
        response = self.api.post(
            "/api/pipelines/templates/apply/",
            {"business": self.business.id, "name": "Template pipeline", "slug": "template-pipeline"},
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        pipeline = Pipeline.objects.get(id=response.data["id"])
        self.assertEqual(pipeline.stages.count(), 5)

    def test_deal_list_supports_filters_pagination_and_enriched_fields(self):
        other_client = Client.objects.create(business=self.business, full_name="Other Client", phone="+77010000000")
        Deal.objects.create(
            business=self.business,
            client=other_client,
            pipeline=self.pipeline,
            stage=self.offer_stage,
            title="Hidden offer",
            amount=25000,
            source="website",
            owner=self.owner,
        )
        Task.objects.create(
            business=self.business,
            client=self.client,
            deal=self.deal,
            title="Call client",
            due_at="2026-06-20T09:00:00Z",
            status=Task.Statuses.OPEN,
        )

        response = self.api.get(
            "/api/deals/",
            {
                "pipeline": self.pipeline.id,
                "search": "Pipeline",
                "status": "open",
                "page_size": 1,
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        deal = response.data["results"][0]
        self.assertEqual(deal["id"], self.deal.id)
        self.assertEqual(deal["client_name"], "Pipeline Client")
        self.assertEqual(deal["stage_name"], "New")
        self.assertEqual(deal["owner_name"], "")
        self.assertEqual(deal["next_task_title"], "Call client")
        self.assertIn(deal["risk_level"], ["low", "medium", "high"])
        self.assertEqual(response.data["facets"]["status"][Deal.Statuses.OPEN], 1)
        self.assertEqual(response.data["facets"]["stage"][str(self.new_stage.id)], 1)

    def test_deal_summary_and_board_return_server_driven_counts(self):
        for index in range(12):
            Deal.objects.create(
                business=self.business,
                client=self.client,
                pipeline=self.pipeline,
                stage=self.offer_stage,
                title=f"Offer {index}",
                amount=1000,
                status=Deal.Statuses.OPEN,
                source="manual",
            )
        Deal.objects.create(
            business=self.business,
            client=self.client,
            pipeline=self.pipeline,
            stage=self.won_stage,
            title="Won deal",
            amount=5000,
            status=Deal.Statuses.WON,
            source="manual",
        )
        Deal.objects.create(
            business=self.business,
            client=self.client,
            pipeline=self.pipeline,
            stage=self.lost_stage,
            title="Lost deal",
            amount=3000,
            status=Deal.Statuses.LOST,
            source="manual",
        )

        summary = self.api.get("/api/deals/summary/", {"pipeline": self.pipeline.id})
        board = self.api.get("/api/deals/board/", {"pipeline": self.pipeline.id, "limit_per_stage": 10})

        self.assertEqual(summary.status_code, 200)
        self.assertEqual(summary.data["total"], 15)
        self.assertEqual(summary.data["open"], 13)
        self.assertEqual(summary.data["won"], 1)
        self.assertEqual(summary.data["lost"], 1)
        self.assertEqual(summary.data["open_value"], "12000.00")
        self.assertEqual(summary.data["pipeline_value"], "12000.00")
        self.assertEqual(summary.data["won_value"], "5000.00")
        self.assertEqual(summary.data["lost_value"], "3000.00")
        self.assertEqual(summary.data["lost_count"], 1)
        self.assertEqual(summary.data["conversion_rate"], 50.0)
        self.assertEqual(summary.data["stale_deals"], 13)
        self.assertEqual(summary.data["hot"], 13)
        self.assertEqual(summary.data["no_tasks"], 13)
        self.assertIn(str(self.offer_stage.id), summary.data["by_stage"])
        self.assertEqual(summary.data["by_status"][Deal.Statuses.OPEN], 13)
        self.assertEqual(summary.data["by_status"][Deal.Statuses.WON], 1)
        self.assertEqual(summary.data["by_status"][Deal.Statuses.LOST], 1)

        self.assertEqual(board.status_code, 200)
        offer_column = next(stage for stage in board.data["stages"] if stage["id"] == self.offer_stage.id)
        self.assertEqual(offer_column["count"], 12)
        self.assertEqual(len(offer_column["deals"]), 10)
        self.assertTrue(offer_column["has_more"])

    def test_deal_summary_is_tenant_scoped(self):
        other_owner = User.objects.create_user(
            username="summary-other-owner",
            email="summary-other-owner@example.com",
            password="pass",
            role=User.Roles.BUSINESS_OWNER,
        )
        other_business = Business.objects.create(owner=other_owner, name="Summary Other Clinic", slug="summary-other-clinic")
        other_client = Client.objects.create(business=other_business, full_name="Other Client")
        other_pipeline = Pipeline.objects.create(business=other_business, name="Other Sales", slug="summary-other-sales")
        other_stage = PipelineStage.objects.create(business=other_business, pipeline=other_pipeline, name="Other New", order=1)
        Deal.objects.create(
            business=other_business,
            client=other_client,
            pipeline=other_pipeline,
            stage=other_stage,
            title="Foreign summary deal",
            amount=99999,
            status=Deal.Statuses.OPEN,
        )

        response = self.api.get("/api/deals/summary/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["total"], 1)
        self.assertEqual(response.data["open_value"], "0.00")
        self.assertEqual(response.data["by_status"][Deal.Statuses.OPEN], 1)

    def test_deal_overdue_filters_use_stage_sla_minutes(self):
        self.offer_stage.sla_minutes = 60
        self.offer_stage.save(update_fields=["sla_minutes", "updated_at"])
        actual_overdue = Deal.objects.create(
            business=self.business,
            client=self.client,
            pipeline=self.pipeline,
            stage=self.offer_stage,
            title="Actually overdue",
            amount=1000,
            status=Deal.Statuses.OPEN,
            stage_entered_at=timezone.now() - timezone.timedelta(minutes=90),
        )
        Deal.objects.create(
            business=self.business,
            client=self.client,
            pipeline=self.pipeline,
            stage=self.offer_stage,
            title="Not overdue yet",
            amount=1000,
            status=Deal.Statuses.OPEN,
            stage_entered_at=timezone.now() - timezone.timedelta(minutes=2),
        )

        quick = self.api.get("/api/deals/", {"quick": "overdue", "pipeline": self.pipeline.id})
        summary = self.api.get("/api/deals/summary/", {"pipeline": self.pipeline.id})

        self.assertEqual(quick.status_code, 200)
        self.assertEqual(quick.data["count"], 1)
        self.assertEqual(quick.data["results"][0]["id"], actual_overdue.id)
        self.assertEqual(summary.status_code, 200)
        self.assertEqual(summary.data["overdue"], 1)
