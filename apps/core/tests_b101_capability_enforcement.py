from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.activities.models import ActivityEvent
from apps.bots.models import Bot, BotConversation
from apps.businesses.access import ensure_default_roles
from apps.businesses.capabilities import apply_business_type_defaults
from apps.businesses.models import Business, BusinessCapability, BusinessMember, BusinessRole
from apps.clients.models import Client
from apps.conversations.pipeline import run_conversation_pipeline
from apps.core.domain_errors import ModuleDisabled
from apps.core.models import AuditLog
from apps.crm.models import Deal, Pipeline, PipelineStage
from apps.leads.models import Lead
from apps.leads.services import create_deal_from_lead
from apps.notifications.models import Notification


class CapabilityEnforcementCustomActionTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.owner = self._create_user("b101-owner@example.com", User.Roles.BUSINESS_OWNER)
        self.operator = self._create_user("b101-operator@example.com", User.Roles.BUSINESS_OPERATOR)
        self.other_owner = self._create_user("b101-other@example.com", User.Roles.BUSINESS_OWNER)
        self.business = Business.objects.create(owner=self.owner, name="B101 Clinic", slug="b101-clinic")
        self.other_business = Business.objects.create(
            owner=self.other_owner,
            name="B101 Other",
            slug="b101-other",
        )
        ensure_default_roles(self.business)
        ensure_default_roles(self.other_business)
        self._create_member(self.business, self.owner, BusinessMember.Roles.OWNER)
        self._create_member(self.business, self.operator, BusinessMember.Roles.OPERATOR)
        self._create_member(self.other_business, self.other_owner, BusinessMember.Roles.OWNER)
        apply_business_type_defaults(self.business, configured_by=self.owner)
        apply_business_type_defaults(self.other_business, configured_by=self.other_owner)

        self.client = Client.objects.create(business=self.business, full_name="B101 Client")
        self.lead = Lead.objects.create(business=self.business, client=self.client)
        self.pipeline = Pipeline.objects.create(
            business=self.business,
            name="B101 Sales",
            slug="b101-sales",
            is_default=True,
        )
        self.stage = PipelineStage.objects.create(
            business=self.business,
            pipeline=self.pipeline,
            name="New",
            order=1,
            probability=10,
        )
        self.bot = Bot.objects.create(business=self.business, name="B101 Bot")
        self.conversation = BotConversation.objects.create(
            business=self.business,
            bot=self.bot,
            channel=BotConversation.Channels.WEBSITE,
            external_user_id="b101-contact",
        )

        self.other_client = Client.objects.create(business=self.other_business, full_name="Foreign Client")
        self.other_pipeline = Pipeline.objects.create(
            business=self.other_business,
            name="Foreign Sales",
            slug="foreign-sales",
            is_default=True,
        )
        self.other_stage = PipelineStage.objects.create(
            business=self.other_business,
            pipeline=self.other_pipeline,
            name="Foreign New",
            order=1,
        )
        self.foreign_deal = Deal.objects.create(
            business=self.other_business,
            client=self.other_client,
            pipeline=self.other_pipeline,
            stage=self.other_stage,
            title="Foreign Deal",
            owner=self.other_owner,
        )

    @staticmethod
    def _create_user(email, role):
        return User.objects.create_user(
            username=email,
            email=email,
            password="Strong-pass-123",
            role=role,
        )

    @staticmethod
    def _create_member(business, user, role):
        return BusinessMember.objects.create(
            business=business,
            user=user,
            role=role,
            business_role=BusinessRole.objects.get(business=business, preset_key=role),
        )

    def _set_deals_enabled(self, enabled):
        capability = BusinessCapability.objects.get(business=self.business, module_key="deals")
        capability.is_enabled = enabled
        capability.save(update_fields=["is_enabled", "updated_at"])
        if hasattr(self.business, "_capability_map"):
            del self.business._capability_map

    def _business_side_effect_counts(self):
        return {
            "deals": Deal.objects.filter(business=self.business).count(),
            "pipelines": Pipeline.objects.filter(business=self.business).count(),
            "stages": PipelineStage.objects.filter(business=self.business).count(),
            "activity": ActivityEvent.objects.filter(business=self.business).count(),
            "audit": AuditLog.objects.filter(business=self.business).count(),
            "notifications": Notification.objects.filter(business=self.business).count(),
        }

    def test_lead_create_deal_denial_has_no_side_effects_and_enabled_path_succeeds(self):
        self._set_deals_enabled(False)
        self.api.force_authenticate(self.owner)
        before = self._business_side_effect_counts()

        denied = self.api.post(
            f"/api/leads/{self.lead.id}/create-deal/",
            {"amount": "25000"},
            format="json",
        )

        self.assertEqual(denied.status_code, 403)
        self.assertEqual(denied.data["code"], "module_disabled")
        self.assertEqual(denied.data["errors"], {"module": "deals"})
        self.assertEqual(self._business_side_effect_counts(), before)
        self.lead.refresh_from_db()
        self.assertEqual(self.lead.status, Lead.Statuses.NEW)

        self._set_deals_enabled(True)
        allowed = self.api.post(
            f"/api/leads/{self.lead.id}/create-deal/",
            {"amount": "25000"},
            format="json",
        )

        self.assertEqual(allowed.status_code, 201)
        self.assertTrue(Deal.objects.filter(business=self.business, lead=self.lead).exists())

    def test_role_denial_precedes_capability_state(self):
        self._set_deals_enabled(False)
        self.api.force_authenticate(self.operator)
        before = self._business_side_effect_counts()

        response = self.api.post(f"/api/leads/{self.lead.id}/create-deal/", {}, format="json")

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.data["code"], "permission_denied")
        self.assertEqual(self._business_side_effect_counts(), before)

    def test_inbox_deal_actions_are_denied_before_any_side_effect(self):
        self._set_deals_enabled(False)
        self.api.force_authenticate(self.owner)
        preserved_deal = Deal.objects.create(
            business=self.business,
            client=self.client,
            lead=self.lead,
            pipeline=self.pipeline,
            stage=self.stage,
            title="Preserved Deal",
            owner=self.owner,
        )
        before = self._business_side_effect_counts()

        responses = (
            self.api.post(
                f"/api/inbox/conversations/{self.conversation.id}/link-deal/",
                {"deal_id": preserved_deal.id},
                format="json",
            ),
            self.api.post(
                f"/api/inbox/conversations/{self.conversation.id}/create-deal/",
                {"title": "Blocked Inbox Deal"},
                format="json",
            ),
            self.api.post(
                f"/api/inbox/conversations/{self.conversation.id}/run-pipeline/",
                {
                    "use_ai_qualification": False,
                    "create_lead": True,
                    "create_deal": True,
                    "create_task": False,
                },
                format="json",
            ),
        )

        for response in responses:
            self.assertEqual(response.status_code, 403)
            self.assertEqual(response.data["code"], "module_disabled")
        self.assertEqual(self._business_side_effect_counts(), before)
        self.conversation.refresh_from_db()
        self.assertIsNone(self.conversation.client_id)
        self.assertIsNone(self.conversation.lead_id)
        self.assertIsNone(self.conversation.deal_id)

    def test_foreign_inbox_deal_link_remains_tenant_safe(self):
        self.api.force_authenticate(self.owner)
        before = self._business_side_effect_counts()

        response = self.api.post(
            f"/api/inbox/conversations/{self.conversation.id}/link-deal/",
            {"deal_id": self.foreign_deal.id},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["code"], "validation_error")
        self.assertNotIn(self.other_business.name, str(response.data))
        self.assertEqual(self._business_side_effect_counts(), before)
        self.conversation.refresh_from_db()
        self.assertIsNone(self.conversation.deal_id)

    def test_pipeline_template_and_deal_assignment_custom_actions_are_gated(self):
        preserved_deal = Deal.objects.create(
            business=self.business,
            client=self.client,
            pipeline=self.pipeline,
            stage=self.stage,
            title="Assignment Target",
            owner=self.owner,
        )
        self._set_deals_enabled(False)
        self.api.force_authenticate(self.owner)
        before = self._business_side_effect_counts()

        template_response = self.api.post(
            "/api/pipelines/templates/apply/",
            {"business": self.business.id, "template_key": "sales_basic"},
            format="json",
        )
        assignment_response = self.api.post(
            f"/api/deals/{preserved_deal.id}/assign-owner/",
            {"user_id": self.operator.id},
            format="json",
        )

        self.assertEqual(template_response.status_code, 403)
        self.assertEqual(template_response.data["code"], "module_disabled")
        self.assertEqual(assignment_response.status_code, 403)
        self.assertEqual(assignment_response.data["code"], "module_disabled")
        self.assertEqual(self._business_side_effect_counts(), before)
        preserved_deal.refresh_from_db()
        self.assertEqual(preserved_deal.owner, self.owner)

    def test_service_boundaries_reject_disabled_deals_before_partial_writes(self):
        self._set_deals_enabled(False)
        before = self._business_side_effect_counts()

        with self.assertRaises(ModuleDisabled):
            create_deal_from_lead(lead=self.lead, actor=self.owner)
        with self.assertRaises(ModuleDisabled):
            run_conversation_pipeline(
                conversation=self.conversation,
                actor=self.owner,
                create_lead=True,
                create_deal=True,
                create_task=False,
                use_ai_qualification=False,
            )

        self.assertEqual(self._business_side_effect_counts(), before)
        self.conversation.refresh_from_db()
        self.assertIsNone(self.conversation.client_id)
        self.assertIsNone(self.conversation.lead_id)
        self.assertIsNone(self.conversation.deal_id)
