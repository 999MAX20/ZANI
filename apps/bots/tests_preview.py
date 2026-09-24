import json
from unittest.mock import patch

from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.ai_core.ai_client import AIClientError, AIClientResult
from apps.ai_core.models import AgentProfile, AIRequestLog, BusinessKnowledgeItem
from apps.bots.models import Bot, BotConversation, BotMessage
from apps.businesses.models import Business, BusinessMember, BusinessRole, RolePermission
from apps.clients.models import Client
from apps.crm.models import Deal
from apps.leads.models import Lead
from apps.notifications.models import Notification
from apps.scheduling.models import Appointment
from apps.services.models import Service
from apps.tasks.models import Task


class AgentPreviewTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.owner = User.objects.create_user(username="preview-owner", email="preview@example.test", password="test")
        cls.business = Business.objects.create(owner=cls.owner, name="Preview clinic", slug="preview-clinic")
        BusinessMember.objects.create(business=cls.business, user=cls.owner, role="owner")
        cls.bot = Bot.objects.create(business=cls.business, name="Reception", settings_json={
            "model": "openai/gpt-4o", "temperature": 0.2,
            "auto_crm_pipeline": {"enabled": True, "mode": "triage", "auto_send_reply": True},
        })
        cls.profile = AgentProfile.objects.create(business=cls.business, bot=cls.bot, name="Reception",
            language="kk", tone="formal", system_prompt="Use clinic facts", escalation_rules_json={"items": ["Escalate complaints"]})
        cls.service = Service.objects.create(business=cls.business, name="Cleaning", price_from=5000, duration_minutes=30)
        cls.knowledge = BusinessKnowledgeItem.objects.create(business=cls.business, title="Address", content="Test clinic at Test Street.")

    def setUp(self):
        self.api = APIClient()
        self.api.force_authenticate(self.owner)
        self.url = f"/api/bots/{self.bot.id}/preview/"

    def post(self, text="Cleaning price?", **extra):
        return self.api.post(self.url, {"messages": [{"direction": "inbound", "text": text}], **extra}, format="json")

    def counts(self):
        return {model.__name__: model.objects.count() for model in (
            Client, Lead, Deal, Task, Appointment, BotConversation, BotMessage, Notification,
        )}

    def qualification(self, intent="price_question", review=False):
        return AIClientResult(json.dumps({"intent": intent, "summary": "Test summary", "confidence": 0.95,
            "requires_human_review": review}), "test", provider="openrouter", is_mock=False)

    def test_draft_preview_uses_saved_settings_and_scoped_sources_without_crm_effects(self):
        before = self.counts()
        with patch("apps.ai_core.services.generate_text", side_effect=[self.qualification(), AIClientResult("From 5000", "openai/gpt-4o", provider="openrouter", is_mock=False)]) as generate:
            response = self.post()
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["reply"], "From 5000")
        self.assertTrue(response.data["automatic_reply_enabled"])
        self.assertFalse(response.data["readiness"]["channel_ready"])
        self.assertEqual(self.counts(), before)
        self.assertEqual(AIRequestLog.objects.count(), 2)
        reply_log = AIRequestLog.objects.get(prompt_type="bot_suggest_reply")
        self.assertIsNone(reply_log.input_json["conversation_id"])
        self.assertEqual(reply_log.input_json["agent_profile"]["language"], "kk")
        self.assertEqual(reply_log.input_json["agent_profile"]["tone"], "formal")
        self.assertEqual(reply_log.input_json["scheduling_context"]["currency"], "KZT")
        self.assertIn("local_date", reply_log.input_json["scheduling_context"])
        self.assertEqual(generate.call_args.kwargs["temperature"], 0.2)
        self.assertEqual(generate.call_args.kwargs["model"], "openai/gpt-4o")
        self.assertIn("reply in Kazakh", generate.call_args.args[0].messages[0]["content"])
        self.assertIn(self.service.id, [source["id"] for source in response.data["sources"] if source["type"] == "service"])
        self.assertFalse(any(source["type"] == "message" for source in response.data["sources"]))

    def test_complaint_and_human_request_preview_shared_handoff_without_reply_or_notification(self):
        before = self.counts()
        for intent in ("complaint", "support"):
            with self.subTest(intent=intent), patch("apps.ai_core.services.generate_text", return_value=self.qualification(intent, True)) as generate:
                response = self.post("Please connect me to an administrator")
                self.assertEqual(response.status_code, 200, response.data)
                self.assertTrue(response.data["handoff_required"])
                self.assertEqual(response.data["reply"], "")
                self.assertEqual(generate.call_count, 1)
                self.assertEqual(self.counts(), before)

    def test_empty_knowledge_and_disabled_automation_allow_only_preview(self):
        BusinessKnowledgeItem.objects.all().delete()
        self.bot.settings_json = {"auto_crm_pipeline": {"mode": "off"}}
        self.bot.save()
        with patch("apps.ai_core.services.generate_text", side_effect=[self.qualification(), AIClientResult("Ask staff", "test")]):
            response = self.post()
        self.assertEqual(response.status_code, 200, response.data)
        self.assertFalse(response.data["automatic_reply_enabled"])
        self.assertFalse(response.data["readiness"]["knowledge_ready"])
        self.assertEqual(self.api.post(f"/api/bots/{self.bot.id}/activate/").status_code, 409)

    def test_profile_required_and_message_input_bounded_before_provider_call(self):
        invalid = [[], [{"direction": "outbound", "text": "Hi"}], [{"direction": "inbound", "text": "x" * 2001}], [{"direction": "inbound", "text": "x"}] * 17]
        with patch("apps.ai_core.services.generate_text") as generate:
            for messages in invalid:
                response = self.api.post(self.url, {"messages": messages}, format="json")
                self.assertEqual(response.status_code, 400)
            self.profile.is_active = False
            self.profile.save()
            self.assertEqual(self.post().status_code, 400)
            generate.assert_not_called()

    def test_provider_failure_is_safe_and_has_no_crm_side_effects(self):
        before = self.counts()
        with patch("apps.ai_core.services.generate_text", side_effect=AIClientError(code="provider_timeout", retryable=True)):
            response = self.post()
        self.assertEqual(response.status_code, 503)
        self.assertEqual(self.counts(), before)

    def test_foreign_tenant_and_operator_cannot_preview_or_spend_requests(self):
        outsider = User.objects.create_user(username="preview-other", email="other@example.test", password="test")
        other_business = Business.objects.create(owner=outsider, name="Other", slug="preview-other")
        BusinessMember.objects.create(business=other_business, user=outsider, role="owner")
        with patch("apps.ai_core.services.generate_text") as generate:
            self.api.force_authenticate(outsider)
            self.assertEqual(self.post().status_code, 404)
            BusinessMember.objects.create(business=self.business, user=outsider, role="operator")
            # No ai_automation:view: scoped queryset deliberately hides the bot.
            self.api.force_authenticate(User.objects.get(pk=outsider.pk))
            self.assertEqual(self.post().status_code, 404)
            generate.assert_not_called()

    def test_ai_manager_without_suggest_permission_cannot_spend_requests(self):
        manager = User.objects.create_user(username="preview-manager", email="manager@example.test", password="test")
        role = BusinessRole.objects.create(business=self.business, name="AI setup manager")
        for action in ("view", "manage"):
            RolePermission.objects.create(business_role=role, resource="ai_automation", action=action, scope="business")
        BusinessMember.objects.create(business=self.business, user=manager, role="staff", business_role=role)
        self.api.force_authenticate(manager)
        with patch("apps.ai_core.services.generate_text") as generate:
            self.assertEqual(self.post().status_code, 403)
            generate.assert_not_called()
