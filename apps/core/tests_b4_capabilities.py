from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.ai_core.models import AIToolCallLog, ApprovalRequest
from apps.businesses.access import ensure_default_roles
from apps.businesses.capabilities import apply_business_type_defaults, capability_payload
from apps.businesses.models import Business, BusinessCapability, BusinessMember, BusinessRole
from apps.clients.models import Client
from apps.crm.models import Deal, Pipeline, PipelineStage


class B4CapabilityTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.owner = User.objects.create_user(
            username="b4-owner@example.com",
            email="b4-owner@example.com",
            password="Strong-pass-123",
            role=User.Roles.BUSINESS_OWNER,
        )
        self.operator = User.objects.create_user(
            username="b4-operator@example.com",
            email="b4-operator@example.com",
            password="Strong-pass-123",
            role=User.Roles.BUSINESS_OPERATOR,
        )
        self.doctor = User.objects.create_user(
            username="b4-doctor@example.com",
            email="b4-doctor@example.com",
            password="Strong-pass-123",
            role=User.Roles.STAFF,
        )
        self.business = Business.objects.create(
            owner=self.owner,
            name="B4 Dental",
            slug="b4-dental",
            business_type=Business.BusinessTypes.DENTISTRY,
        )
        ensure_default_roles(self.business)
        for user, role in (
            (self.owner, BusinessMember.Roles.OWNER),
            (self.operator, BusinessMember.Roles.OPERATOR),
            (self.doctor, BusinessMember.Roles.DOCTOR),
        ):
            BusinessMember.objects.create(
                business=self.business,
                user=user,
                role=role,
                business_role=BusinessRole.objects.get(business=self.business, preset_key=role),
            )
        apply_business_type_defaults(self.business, configured_by=self.owner)
        self.client = Client.objects.create(business=self.business, full_name="B4 Patient")
        self.pipeline = Pipeline.objects.create(business=self.business, name="Optional deals", slug="b4-deals")
        self.stage = PipelineStage.objects.create(business=self.business, pipeline=self.pipeline, name="New", order=1)
        self.deal = Deal.objects.create(
            business=self.business,
            client=self.client,
            pipeline=self.pipeline,
            stage=self.stage,
            title="Preserved optional deal",
            owner=self.owner,
        )

    def test_dentistry_profile_is_appointment_first_with_deals_disabled(self):
        profile = capability_payload(self.business)

        self.assertEqual(profile["workflow_mode"], "appointment_first")
        self.assertFalse(profile["modules"]["deals"])
        self.assertTrue(profile["modules"]["appointments"])
        self.assertTrue(profile["modules"]["inbox"])

    def test_disabled_deal_module_blocks_api_and_reenable_preserves_data(self):
        self.api.force_authenticate(self.owner)

        hidden = self.api.get(f"/api/deals/{self.deal.id}/")
        create_denied = self.api.post(
            "/api/deals/",
            {
                "business": self.business.id,
                "client": self.client.id,
                "pipeline": self.pipeline.id,
                "stage": self.stage.id,
                "title": "Blocked deal",
            },
            format="json",
        )
        capability = BusinessCapability.objects.get(business=self.business, module_key="deals")
        enabled = self.api.patch(
            f"/api/business-capabilities/{capability.id}/",
            {"is_enabled": True},
            format="json",
        )
        restored = self.api.get(f"/api/deals/{self.deal.id}/")

        self.assertEqual(hidden.status_code, 404)
        self.assertEqual(create_denied.status_code, 403)
        self.assertEqual(enabled.status_code, 200)
        self.assertEqual(restored.status_code, 200)
        self.assertEqual(restored.data["id"], self.deal.id)

    def test_only_settings_manager_can_change_capability(self):
        capability = BusinessCapability.objects.get(business=self.business, module_key="deals")
        self.api.force_authenticate(self.operator)

        response = self.api.patch(
            f"/api/business-capabilities/{capability.id}/",
            {"is_enabled": True},
            format="json",
        )

        self.assertEqual(response.status_code, 404)
        capability.refresh_from_db()
        self.assertFalse(capability.is_enabled)

    def test_ai_tool_cannot_target_disabled_deals(self):
        log = AIToolCallLog.objects.create(
            business=self.business,
            user=self.owner,
            tool_name="create_deal",
            input_json={"client_id": self.client.id, "title": "AI blocked deal"},
        )
        approval = ApprovalRequest.objects.create(
            business=self.business,
            requested_by=self.owner,
            approved_by=self.owner,
            action_type=ApprovalRequest.ActionTypes.AI_PIPELINE,
            ai_tool_call_log=log,
            status=ApprovalRequest.Statuses.APPROVED,
        )
        self.api.force_authenticate(self.owner)

        response = self.api.post(
            f"/api/ai/tools/{log.id}/execute/",
            {"approval_id": approval.id},
            format="json",
        )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(Deal.objects.filter(business=self.business).count(), 1)

    def test_current_user_bootstrap_exposes_capabilities_and_doctor_role(self):
        self.api.force_authenticate(self.doctor)

        response = self.api.get("/api/auth/me/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["memberships"][0]["role"], BusinessMember.Roles.DOCTOR)
        self.assertFalse(response.data["capabilities"][str(self.business.id)]["modules"]["deals"])
