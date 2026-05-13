from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.ai_core.ai_client import AIClientError, generate_text
from apps.ai_core.models import AIRequestLog, BusinessKnowledgeItem
from apps.ai_core.services import run_ai_request
from apps.businesses.models import Business, BusinessMember
from apps.clients.models import Client
from apps.leads.models import Lead


class AICoreFoundationTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.owner = User.objects.create_user(
            username="ai-owner",
            email="ai-owner@example.com",
            password="pass",
            role=User.Roles.BUSINESS_OWNER,
        )
        self.other_owner = User.objects.create_user(
            username="other-ai-owner",
            email="other-ai-owner@example.com",
            password="pass",
            role=User.Roles.BUSINESS_OWNER,
        )
        self.business = Business.objects.create(owner=self.owner, name="AI Clinic", slug="ai-clinic")
        self.other_business = Business.objects.create(owner=self.other_owner, name="Other AI Clinic", slug="other-ai-clinic")
        BusinessMember.objects.create(business=self.business, user=self.owner, role=BusinessMember.Roles.OWNER)
        BusinessMember.objects.create(business=self.other_business, user=self.other_owner, role=BusinessMember.Roles.OWNER)

    @override_settings(OPENAI_API_KEY="")
    def test_generate_text_returns_mock_without_key(self):
        result = generate_text("Hello")

        self.assertTrue(result.is_mock)
        self.assertIn("OPENAI_API_KEY", result.output_text)

    @override_settings(OPENAI_API_KEY="")
    def test_generate_text_can_return_controlled_error_without_key(self):
        with self.assertRaises(AIClientError):
            generate_text("Hello", allow_mock=False)

    @override_settings(OPENAI_API_KEY="")
    def test_run_ai_request_logs_mock_response(self):
        BusinessKnowledgeItem.objects.create(
            business=self.business,
            title="Working hours",
            content="We work from 09:00 to 18:00.",
            category="operations",
        )

        result, log = run_ai_request(
            business=self.business,
            user=self.owner,
            source=AIRequestLog.Sources.CRM,
            prompt_type="test_prompt",
            user_input="When are you open?",
        )

        self.assertTrue(result.is_mock)
        self.assertEqual(log.business, self.business)
        self.assertEqual(log.user, self.owner)
        self.assertEqual(log.prompt_type, "test_prompt")
        self.assertEqual(log.input_json["context"][0]["title"], "Working hours")

    def test_knowledge_items_are_tenant_filtered(self):
        BusinessKnowledgeItem.objects.create(business=self.business, title="Own", content="Visible")
        BusinessKnowledgeItem.objects.create(business=self.other_business, title="Other", content="Hidden")
        self.api.force_authenticate(self.owner)

        response = self.api.get("/api/ai/knowledge-items/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["title"], "Own")

    def test_ai_logs_are_tenant_filtered(self):
        AIRequestLog.objects.create(business=self.business, user=self.owner, source="crm", prompt_type="own")
        AIRequestLog.objects.create(business=self.other_business, user=self.other_owner, source="crm", prompt_type="other")
        self.api.force_authenticate(self.owner)

        response = self.api.get("/api/ai/request-logs/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["prompt_type"], "own")

    @override_settings(OPENAI_API_KEY="")
    def test_ai_assistant_chat_returns_mock_and_logs_context(self):
        client = Client.objects.create(business=self.business, full_name="AI Client", phone="+77010000000")
        Lead.objects.create(business=self.business, client=client, source=Lead.Sources.WEBSITE, message="Need appointment")
        self.api.force_authenticate(self.owner)

        response = self.api.post(
            "/api/ai/assistant/chat/",
            {"business": self.business.id, "message": "Что требует внимания?"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["is_mock"])
        self.assertEqual(response.data["context"]["new_leads_count"], 1)
        log = AIRequestLog.objects.get(prompt_type="crm_assistant")
        self.assertEqual(log.business, self.business)
        self.assertEqual(log.user, self.owner)
        self.assertEqual(log.input_json["crm_context"]["summary"]["new_leads_count"], 1)

    @override_settings(OPENAI_API_KEY="")
    def test_ai_assistant_chat_rejects_foreign_business(self):
        self.api.force_authenticate(self.owner)

        response = self.api.post(
            "/api/ai/assistant/chat/",
            {"business": self.other_business.id, "message": "Show data"},
            format="json",
        )

        self.assertEqual(response.status_code, 403)
