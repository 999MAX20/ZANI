from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.activities.models import ActivityEvent
from apps.businesses.models import Business, BusinessMember
from apps.clients.models import Client
from apps.crm.models import Deal, Pipeline, PipelineStage


class PipelineStageEngineUpgradeTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.owner = User.objects.create_user(
            username="pipeline-owner",
            email="pipeline-owner@example.com",
            password="pass",
            role=User.Roles.BUSINESS_OWNER,
        )
        self.business = Business.objects.create(owner=self.owner, name="Pipeline Clinic", slug="pipeline-clinic")
        BusinessMember.objects.create(business=self.business, user=self.owner, role=BusinessMember.Roles.OWNER)
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
        self.lost_stage = PipelineStage.objects.create(
            business=self.business,
            pipeline=self.pipeline,
            name="Lost",
            order=3,
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

    def test_move_stage_updates_status_timestamps_and_activity(self):
        self.deal.amount = 10000
        self.deal.save(update_fields=["amount", "updated_at"])

        response = self.api.post(f"/api/deals/{self.deal.id}/move-stage/", {"stage": self.offer_stage.id}, format="json")

        self.assertEqual(response.status_code, 200)
        self.deal.refresh_from_db()
        self.assertEqual(self.deal.stage, self.offer_stage)
        self.assertIsNotNone(self.deal.stage_entered_at)
        self.assertTrue(ActivityEvent.objects.filter(business=self.business, entity_type="Deal", entity_id=str(self.deal.id), event_type="deal_stage_changed").exists())

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
