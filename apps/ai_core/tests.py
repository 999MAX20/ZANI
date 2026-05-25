from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.ai_core.ai_client import AIClientError, generate_text, resolve_model
from apps.ai_core.models import AIToolCallLog, AIRequestLog, AgentProfile, BusinessKnowledgeItem
from apps.bots.models import Bot, BotConversation, BotMessage
from apps.ai_core.services import run_ai_request
from apps.businesses.models import Business, BusinessMember
from apps.clients.models import Client
from apps.leads.models import Lead
from apps.tasks.models import Task
from apps.notifications.models import Notification


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

    @override_settings(AI_PROVIDER="mock", OPENAI_API_KEY="", OPENROUTER_API_KEY="", KIMI_API_KEY="")
    def test_generate_text_returns_mock_without_key(self):
        result = generate_text("Hello")

        self.assertTrue(result.is_mock)
        self.assertEqual(result.provider, "mock")
        self.assertIn("mock response", result.output_text)

    @override_settings(
        AI_PROVIDER="kimi",
        AI_FAST_MODEL="kimi-fast",
        AI_SMART_MODEL="kimi-smart",
        AI_PROMPT_MODEL_TIERS='{"lead_reply": "fast"}',
    )
    def test_resolve_model_uses_prompt_tiers(self):
        self.assertEqual(resolve_model(prompt_type="lead_reply"), "kimi-fast")
        self.assertEqual(resolve_model(prompt_type="crm_assistant"), "kimi-smart")
        self.assertEqual(resolve_model(model="manual-model"), "manual-model")

    @override_settings(AI_PROVIDER="kimi", KIMI_API_KEY="")
    def test_generate_text_can_return_controlled_error_without_key(self):
        with self.assertRaises(AIClientError):
            generate_text("Hello", allow_mock=False)

    @override_settings(AI_PROVIDER="mock", OPENAI_API_KEY="", OPENROUTER_API_KEY="", KIMI_API_KEY="")
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
        self.assertEqual(log.input_json["ai_provider"], "mock")

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

    def test_agent_profiles_are_tenant_filtered_and_validate_bot_business(self):
        own_bot = Bot.objects.create(business=self.business, name="Own bot")
        other_bot = Bot.objects.create(business=self.other_business, name="Other bot")
        AgentProfile.objects.create(business=self.business, bot=own_bot, name="Own agent", tone=AgentProfile.Tones.SUPPORT)
        AgentProfile.objects.create(business=self.other_business, bot=other_bot, name="Hidden agent")
        self.api.force_authenticate(self.owner)

        list_response = self.api.get("/api/ai/agent-profiles/")
        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(list_response.data["count"], 1)
        self.assertEqual(list_response.data["results"][0]["name"], "Own agent")

        invalid_response = self.api.post(
            "/api/ai/agent-profiles/",
            {
                "business": self.business.id,
                "bot": other_bot.id,
                "name": "Invalid agent",
                "tone": AgentProfile.Tones.FRIENDLY,
                "language": "ru",
            },
            format="json",
        )
        self.assertEqual(invalid_response.status_code, 400)

    @override_settings(AI_PROVIDER="mock", OPENAI_API_KEY="", OPENROUTER_API_KEY="", KIMI_API_KEY="")
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

    @override_settings(AI_ENABLED=True, AI_PROVIDER="kimi", KIMI_API_KEY="test-key", AI_SMART_MODEL="kimi-k2.6")
    def test_ai_assistant_status_reports_configured_provider(self):
        self.api.force_authenticate(self.owner)

        response = self.api.get("/api/ai/assistant/status/", {"business": self.business.id})

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["ready"])
        self.assertEqual(response.data["provider"], "kimi")
        self.assertEqual(response.data["mode"], "live")
        self.assertEqual(response.data["model"], "kimi-k2.6")

    @override_settings(AI_ENABLED=True, AI_PROVIDER="kimi", KIMI_API_KEY="", AI_SMART_MODEL="kimi-k2.6")
    def test_ai_assistant_status_reports_missing_key_as_mock_mode(self):
        self.api.force_authenticate(self.owner)

        response = self.api.get("/api/ai/assistant/status/", {"business": self.business.id})

        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data["ready"])
        self.assertEqual(response.data["provider"], "kimi")
        self.assertEqual(response.data["mode"], "mock")

    @override_settings(AI_PROVIDER="mock", OPENAI_API_KEY="", OPENROUTER_API_KEY="", KIMI_API_KEY="")
    def test_ai_assistant_chat_rejects_foreign_business(self):
        self.api.force_authenticate(self.owner)

        response = self.api.post(
            "/api/ai/assistant/chat/",
            {"business": self.other_business.id, "message": "Show data"},
            format="json",
        )

        self.assertEqual(response.status_code, 403)

    def test_ai_tool_suggest_logs_actions_without_execution(self):
        bot = Bot.objects.create(business=self.business, name="Tool bot")
        conversation = BotConversation.objects.create(
            business=self.business,
            bot=bot,
            channel=BotConversation.Channels.WEBSITE,
            external_user_id="tool-visitor",
        )
        BotMessage.objects.create(conversation=conversation, direction=BotMessage.Directions.INBOUND, text="Need follow up")
        self.api.force_authenticate(self.owner)

        response = self.api.post(
            "/api/ai/tools/suggest/",
            {"business": self.business.id, "conversation": conversation.id, "message": "Suggest next action"},
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertGreaterEqual(len(response.data["suggested_actions"]), 3)
        self.assertEqual(Task.objects.count(), 0)
        self.assertTrue(AIToolCallLog.objects.filter(business=self.business, status="suggested").exists())

    def test_ai_tool_execute_creates_task_after_confirmation(self):
        bot = Bot.objects.create(business=self.business, name="Task tool bot")
        conversation = BotConversation.objects.create(
            business=self.business,
            bot=bot,
            channel=BotConversation.Channels.WEBSITE,
            external_user_id="task-visitor",
        )
        log = AIToolCallLog.objects.create(
            business=self.business,
            user=self.owner,
            conversation=conversation,
            tool_name="create_task",
            input_json={"title": "AI follow-up", "priority": "high"},
        )
        self.api.force_authenticate(self.owner)

        response = self.api.post(f"/api/ai/tools/{log.id}/execute/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "executed")
        task = Task.objects.get()
        self.assertEqual(task.title, "AI follow-up")
        self.assertEqual(task.business, self.business)
        self.assertIsNotNone(task.due_at)
        notification = Notification.objects.get(business=self.business, category=Notification.Categories.TASKS)
        self.assertIn("AI создал задачу", notification.text)
        self.assertEqual(notification.action_url, f"/dashboard/tasks?task={task.id}")
        self.assertTrue(response.data["output_json"]["notification_created"])
        self.assertEqual(response.data["output_json"]["calendar_status"], "scheduled")


    def test_ai_tool_execute_creates_task_with_due_reminder_and_assignee(self):
        due_at = timezone.now() + timezone.timedelta(days=1)
        reminder_at = due_at - timezone.timedelta(hours=2)
        log = AIToolCallLog.objects.create(
            business=self.business,
            user=self.owner,
            tool_name="create_task",
            input_json={
                "title": "Launch weekend promo",
                "description": "Prepare campaign assets.",
                "recommendation": "Sales dropped on weekends. Create a promotion task.",
                "priority": "urgent",
                "assignee_id": self.owner.id,
                "due_at": due_at.isoformat(),
                "reminder_at": reminder_at.isoformat(),
            },
        )
        self.api.force_authenticate(self.owner)

        response = self.api.post(f"/api/ai/tools/{log.id}/execute/")

        self.assertEqual(response.status_code, 200)
        task = Task.objects.get(title="Launch weekend promo")
        self.assertEqual(task.assignee, self.owner)
        self.assertEqual(task.priority, Task.Priorities.URGENT)
        self.assertIsNotNone(task.due_at)
        self.assertIsNotNone(task.reminder_at)
        self.assertIn("AI recommendation", task.description)
        notification = Notification.objects.get(business=self.business, category=Notification.Categories.TASKS)
        self.assertEqual(notification.priority, Notification.Priorities.HIGH)
        self.assertEqual(notification.action_label, "Открыть задачу")
        self.assertEqual(response.data["output_json"]["assignee_id"], self.owner.id)

    def test_ai_tool_execute_rejects_foreign_business_access(self):
        log = AIToolCallLog.objects.create(
            business=self.other_business,
            user=self.other_owner,
            tool_name="create_task",
            input_json={"title": "Hidden task"},
        )
        self.api.force_authenticate(self.owner)

        response = self.api.post(f"/api/ai/tools/{log.id}/execute/")

        self.assertEqual(response.status_code, 403)
        self.assertEqual(Task.objects.count(), 0)
