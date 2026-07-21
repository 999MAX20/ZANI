from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.ai_core.ai_client import AIClientError, generate_text, resolve_model
from apps.ai_core.models import AIToolCallLog, AIRequestLog, AgentProfile, ApprovalRequest, BusinessKnowledgeItem
from apps.bots.models import Bot, BotConversation, BotMessage
from apps.ai_core.services import run_ai_request
from apps.businesses.access import Actions, Resources
from apps.businesses.models import Business, BusinessMember, BusinessRole, RolePermission
from apps.clients.models import Client
from apps.crm.models import Deal, Pipeline, PipelineStage
from apps.core.models import AuditLog
from apps.integrations.models import BusinessConnector, BusinessEvent
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

    def approved_tool_request(self, log, *, user=None):
        approver = user or self.owner
        return ApprovalRequest.objects.create(
            business=log.business,
            requested_by=log.user or approver,
            approved_by=approver,
            approved_at=timezone.now(),
            action_type=ApprovalRequest.ActionTypes.AI_PIPELINE,
            ai_tool_call_log=log,
            status=ApprovalRequest.Statuses.APPROVED,
            payload={"tool_call_id": log.id, "tool_name": log.tool_name},
        )

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
        AIRequestLog.objects.create(
            business=self.business,
            user=self.owner,
            source="crm",
            prompt_type="own",
            input_json={"api_key": "raw-log-key"},
            output_text="Provider returned token=raw-output-token",
        )
        AIRequestLog.objects.create(business=self.other_business, user=self.other_owner, source="crm", prompt_type="other")
        self.api.force_authenticate(self.owner)

        response = self.api.get("/api/ai/request-logs/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["prompt_type"], "own")
        self.assertNotIn("raw-log-key", str(response.data))
        self.assertNotIn("raw-output-token", str(response.data))

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

    @override_settings(AI_PROVIDER="mock", OPENAI_API_KEY="", OPENROUTER_API_KEY="", KIMI_API_KEY="")
    def test_ai_assistant_chat_context_respects_lead_view_scope(self):
        manager = User.objects.create_user(
            username="ai-manager",
            email="ai-manager@example.com",
            password="pass",
            role=User.Roles.BUSINESS_MANAGER,
        )
        BusinessMember.objects.create(business=self.business, user=manager, role=BusinessMember.Roles.MANAGER)
        visible_client = Client.objects.create(business=self.business, full_name="Visible AI Client")
        hidden_client = Client.objects.create(business=self.business, full_name="Hidden AI Client")
        visible_lead = Lead.objects.create(
            business=self.business,
            client=visible_client,
            responsible_user=manager,
            source=Lead.Sources.WEBSITE,
            message="Visible manager lead",
        )
        hidden_lead = Lead.objects.create(
            business=self.business,
            client=hidden_client,
            responsible_user=self.owner,
            source=Lead.Sources.WEBSITE,
            message="Hidden owner lead",
        )
        self.api.force_authenticate(manager)

        response = self.api.post(
            "/api/ai/assistant/chat/",
            {"business": self.business.id, "message": "What needs attention?"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["context"]["new_leads_count"], 1)
        log = AIRequestLog.objects.get(prompt_type="crm_assistant")
        latest_lead_ids = {item["id"] for item in log.input_json["crm_context"]["latest_leads"]}
        self.assertEqual(latest_lead_ids, {visible_lead.id})
        self.assertNotIn(hidden_lead.message, str(log.input_json["crm_context"]))

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

    @override_settings(AI_PROVIDER="mock", OPENAI_API_KEY="", OPENROUTER_API_KEY="", KIMI_API_KEY="")
    def test_ai_analyst_brief_reads_business_events_and_cites_sources(self):
        connector = BusinessConnector.objects.create(
            business=self.business,
            provider=BusinessConnector.Providers.KASPI,
            capability=BusinessConnector.Capabilities.SALES,
            name="Kaspi",
            status=BusinessConnector.Statuses.CONNECTED,
        )
        event = BusinessEvent.objects.create(
            business=self.business,
            connector=connector,
            source=BusinessConnector.Providers.KASPI,
            event_type="order.received",
            external_id="order-1",
            deduplication_key="order-1",
            status=BusinessEvent.Statuses.RECEIVED,
            payload_json={"amount": 15000, "api_key": "secret-key"},
        )
        self.api.force_authenticate(self.owner)

        response = self.api.get("/api/ai/analyst/brief/", {"business": self.business.id})

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["is_mock"])
        self.assertEqual(response.data["sources"][0]["id"], f"BE-{event.id}")
        self.assertEqual(response.data["sources"][0]["payload"]["api_key"], "***")
        self.assertTrue(response.data["insights"])
        self.assertIn(f"BE-{event.id}", response.data["insights"][0]["source_ids"])
        self.assertTrue(response.data["actions"])
        log = AIRequestLog.objects.get(prompt_type="business_event_analyst")
        self.assertEqual(log.business, self.business)
        self.assertEqual(log.input_json["business_event_sources"][0]["id"], f"BE-{event.id}")

    def test_ai_analyst_brief_rejects_foreign_business(self):
        self.api.force_authenticate(self.owner)

        response = self.api.get("/api/ai/analyst/brief/", {"business": self.other_business.id})

        self.assertEqual(response.status_code, 403)

    @override_settings(AI_PROVIDER="mock", OPENAI_API_KEY="", OPENROUTER_API_KEY="", KIMI_API_KEY="")
    def test_ai_analyst_brief_without_sources_returns_no_data_output(self):
        self.api.force_authenticate(self.owner)

        response = self.api.get("/api/ai/analyst/brief/", {"business": self.business.id})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["sources"], [])
        self.assertEqual(response.data["insights"][0]["id"], "no_business_events")
        self.assertEqual(response.data["insights"][0]["source_ids"], [])
        self.assertEqual(response.data["actions"][0]["source_ids"], [])

    @override_settings(AI_PROVIDER="mock", OPENAI_API_KEY="", OPENROUTER_API_KEY="", KIMI_API_KEY="")
    def test_ai_analyst_brief_does_not_read_business_events_without_integration_view(self):
        marketer = User.objects.create_user(
            username="ai-marketer",
            email="ai-marketer@example.com",
            password="pass",
            role=User.Roles.STAFF,
        )
        BusinessMember.objects.create(business=self.business, user=marketer, role=BusinessMember.Roles.MARKETER)
        connector = BusinessConnector.objects.create(
            business=self.business,
            provider=BusinessConnector.Providers.KASPI,
            capability=BusinessConnector.Capabilities.SALES,
            name="Hidden Kaspi",
            status=BusinessConnector.Statuses.CONNECTED,
        )
        hidden_event = BusinessEvent.objects.create(
            business=self.business,
            connector=connector,
            source=BusinessConnector.Providers.KASPI,
            event_type="order.hidden",
            external_id="hidden-order-1",
            deduplication_key="hidden-order-1",
            status=BusinessEvent.Statuses.RECEIVED,
            payload_json={"summary": "Hidden analyst order"},
        )
        self.api.force_authenticate(marketer)

        response = self.api.get("/api/ai/analyst/brief/", {"business": self.business.id})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["sources"], [])
        self.assertEqual(response.data["insights"][0]["source_ids"], [])
        self.assertNotIn(f"BE-{hidden_event.id}", str(response.data))
        self.assertNotIn("Hidden analyst order", str(response.data))
        log = AIRequestLog.objects.get(prompt_type="business_event_analyst")
        self.assertEqual(log.input_json["business_event_sources"], [])
        self.assertNotIn("Hidden analyst order", str(log.input_json))

    def test_ai_owner_daily_brief_returns_source_grounded_next_best_actions(self):
        now = timezone.now()
        client = Client.objects.create(business=self.business, full_name="Brief Client")
        lead = Lead.objects.create(
            business=self.business,
            client=client,
            responsible_user=self.owner,
            source=Lead.Sources.WEBSITE,
            message="Needs follow-up",
        )
        Lead.objects.filter(id=lead.id).update(updated_at=now - timezone.timedelta(days=4))
        task = Task.objects.create(
            business=self.business,
            title="Brief overdue task",
            assignee=self.owner,
            due_at=now - timezone.timedelta(hours=3),
            priority=Task.Priorities.HIGH,
        )
        bot = Bot.objects.create(business=self.business, name="Brief bot")
        conversation = BotConversation.objects.create(
            business=self.business,
            bot=bot,
            channel=BotConversation.Channels.WEBSITE,
            external_user_id="brief-visitor",
            unread_count=2,
            last_inbound_at=now - timezone.timedelta(hours=2),
        )
        pipeline = Pipeline.objects.create(business=self.business, name="Sales", slug="sales", is_default=True)
        stage = PipelineStage.objects.create(
            business=self.business,
            pipeline=pipeline,
            name="Negotiation",
            order=1,
            sla_minutes=30,
        )
        deal = Deal.objects.create(
            business=self.business,
            client=client,
            pipeline=pipeline,
            stage=stage,
            title="Brief deal",
            owner=self.owner,
            stage_entered_at=now - timezone.timedelta(hours=2),
        )
        connector = BusinessConnector.objects.create(
            business=self.business,
            provider=BusinessConnector.Providers.KASPI,
            capability=BusinessConnector.Capabilities.SALES,
            name="Kaspi failed",
            status=BusinessConnector.Statuses.ERROR,
            last_error="token=raw-connector-token",
        )
        event = BusinessEvent.objects.create(
            business=self.business,
            connector=connector,
            source=BusinessConnector.Providers.KASPI,
            event_type="sync.failed",
            external_id="sync-1",
            deduplication_key="sync-1",
            status=BusinessEvent.Statuses.FAILED,
            error="api_key=raw-event-key",
        )
        self.api.force_authenticate(self.owner)

        response = self.api.get("/api/ai/owner-brief/daily/", {"business": self.business.id, "limit": 10})

        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data["summary"]["no_data"])
        categories = {item["category"] for item in response.data["recommendations"]}
        self.assertTrue(
            {
                "stale_leads",
                "overdue_tasks",
                "unanswered_conversations",
                "stalled_deals",
                "failed_connectors",
            }.issubset(categories)
        )
        source_ids = {source["id"] for source in response.data["sources"]}
        self.assertIn(f"LEAD-{lead.id}", source_ids)
        self.assertIn(f"TASK-{task.id}", source_ids)
        self.assertIn(f"CONV-{conversation.id}", source_ids)
        self.assertIn(f"DEAL-{deal.id}", source_ids)
        self.assertIn(f"BE-{event.id}", source_ids)
        for recommendation in response.data["recommendations"]:
            self.assertTrue(recommendation["source_ids"])
            self.assertTrue(set(recommendation["source_ids"]).issubset(source_ids))
        self.assertNotIn("raw-connector-token", str(response.data))
        self.assertNotIn("raw-event-key", str(response.data))

    def test_ai_owner_daily_brief_returns_no_data_state(self):
        self.api.force_authenticate(self.owner)

        response = self.api.get("/api/ai/owner-brief/daily/", {"business": self.business.id})

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["summary"]["no_data"])
        self.assertEqual(response.data["recommendations"], [])
        self.assertEqual(response.data["sources"], [])
        self.assertTrue(all(section["count"] == 0 for section in response.data["sections"]))

    def test_ai_owner_daily_brief_respects_user_lead_scope(self):
        manager = User.objects.create_user(
            username="brief-manager",
            email="brief-manager@example.com",
            password="pass",
            role=User.Roles.BUSINESS_MANAGER,
        )
        BusinessMember.objects.create(business=self.business, user=manager, role=BusinessMember.Roles.MANAGER)
        visible_client = Client.objects.create(business=self.business, full_name="Visible brief client")
        hidden_client = Client.objects.create(business=self.business, full_name="Hidden brief client")
        visible_lead = Lead.objects.create(
            business=self.business,
            client=visible_client,
            responsible_user=manager,
            source=Lead.Sources.WEBSITE,
        )
        hidden_lead = Lead.objects.create(
            business=self.business,
            client=hidden_client,
            responsible_user=self.owner,
            source=Lead.Sources.WEBSITE,
        )
        stale_at = timezone.now() - timezone.timedelta(days=4)
        Lead.objects.filter(id__in=[visible_lead.id, hidden_lead.id]).update(updated_at=stale_at)
        self.api.force_authenticate(manager)

        response = self.api.get("/api/ai/owner-brief/daily/", {"business": self.business.id, "limit": 10})

        self.assertEqual(response.status_code, 200)
        source_ids = {source["id"] for source in response.data["sources"]}
        self.assertIn(f"LEAD-{visible_lead.id}", source_ids)
        self.assertNotIn(f"LEAD-{hidden_lead.id}", source_ids)
        self.assertNotIn("Hidden brief client", str(response.data))

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

        approval = self.approved_tool_request(log)
        response = self.api.post(f"/api/ai/tools/{log.id}/execute/", {"approval_id": approval.id}, format="json")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "executed")
        approval.refresh_from_db()
        self.assertEqual(approval.status, ApprovalRequest.Statuses.EXECUTED)
        task = Task.objects.get()
        self.assertEqual(task.title, "AI follow-up")
        self.assertEqual(task.business, self.business)
        self.assertIsNotNone(task.due_at)
        notification = Notification.objects.get(business=self.business, category=Notification.Categories.TASKS)
        self.assertIn("AI создал задачу", notification.text)
        self.assertEqual(notification.action_url, f"/app/tasks?task={task.id}")
        self.assertTrue(response.data["output_json"]["notification_created"])
        self.assertEqual(response.data["output_json"]["calendar_status"], "scheduled")
        self.assertTrue(
            AuditLog.objects.filter(
                business=self.business,
                actor=self.owner,
                entity_type="AIToolCallLog",
                entity_id=str(log.id),
                metadata__kind="ai_tool_execution",
                metadata__tool_name="create_task",
                metadata__status=AIToolCallLog.Statuses.EXECUTED,
                metadata__output_refs__task_id=task.id,
                metadata__approval_id=approval.id,
            ).exists()
        )


    def test_ai_tool_execute_requires_approval_for_critical_actions(self):
        log = AIToolCallLog.objects.create(
            business=self.business,
            user=self.owner,
            tool_name="create_task",
            input_json={"title": "Blocked AI task"},
        )
        self.api.force_authenticate(self.owner)

        response = self.api.post(f"/api/ai/tools/{log.id}/execute/")

        self.assertEqual(response.status_code, 403)
        self.assertTrue(response.data["approval_required"])
        self.assertEqual(Task.objects.count(), 0)
        log.refresh_from_db()
        self.assertEqual(log.status, AIToolCallLog.Statuses.SUGGESTED)
        self.assertTrue(
            AuditLog.objects.filter(
                business=self.business,
                actor=self.owner,
                entity_type="AIToolCallLog",
                entity_id=str(log.id),
                metadata__kind="ai_tool_execution",
                metadata__status="approval_required",
                metadata__approval_required=True,
            ).exists()
        )

    def test_ai_tool_execute_allows_read_only_tool_without_approval_and_writes_audit(self):
        bot = Bot.objects.create(business=self.business, name="Read tool bot")
        conversation = BotConversation.objects.create(
            business=self.business,
            bot=bot,
            channel=BotConversation.Channels.WEBSITE,
            external_user_id="read-tool-visitor",
        )
        BotMessage.objects.create(conversation=conversation, direction=BotMessage.Directions.INBOUND, text="Need a summary")
        log = AIToolCallLog.objects.create(
            business=self.business,
            user=self.owner,
            conversation=conversation,
            tool_name="summarize_conversation",
            input_json={"message": "Summarize"},
        )
        self.api.force_authenticate(self.owner)

        response = self.api.post(f"/api/ai/tools/{log.id}/execute/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], AIToolCallLog.Statuses.EXECUTED)
        self.assertEqual(ApprovalRequest.objects.count(), 0)
        self.assertTrue(
            AuditLog.objects.filter(
                business=self.business,
                actor=self.owner,
                entity_type="AIToolCallLog",
                entity_id=str(log.id),
                metadata__kind="ai_tool_execution",
                metadata__status=AIToolCallLog.Statuses.EXECUTED,
                metadata__approval_required=False,
            ).exists()
        )


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

        approval = self.approved_tool_request(log)
        response = self.api.post(f"/api/ai/tools/{log.id}/execute/", {"approval_id": approval.id}, format="json")

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

    def test_ai_tool_execute_requires_underlying_crm_create_permission(self):
        limited_user = User.objects.create_user(
            username="ai-limited-executor",
            email="ai-limited-executor@example.com",
            password="pass",
            role=User.Roles.STAFF,
        )
        ai_executor_role = BusinessRole.objects.create(business=self.business, name="AI executor without task create")
        RolePermission.objects.create(
            business_role=ai_executor_role,
            resource=Resources.AI_PIPELINE,
            action=Actions.EXECUTE,
            scope=RolePermission.Scopes.BUSINESS,
        )
        BusinessMember.objects.create(
            business=self.business,
            user=limited_user,
            role=BusinessMember.Roles.STAFF,
            business_role=ai_executor_role,
        )
        log = AIToolCallLog.objects.create(
            business=self.business,
            user=limited_user,
            tool_name="create_task",
            input_json={"title": "Should not be created"},
        )
        approval = self.approved_tool_request(log, user=self.owner)
        self.api.force_authenticate(limited_user)

        response = self.api.post(f"/api/ai/tools/{log.id}/execute/", {"approval_id": approval.id}, format="json")

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.data["approval_status"], "permission_denied")
        self.assertEqual(Task.objects.count(), 0)
        log.refresh_from_db()
        self.assertEqual(log.status, AIToolCallLog.Statuses.SUGGESTED)
        self.assertTrue(
            AuditLog.objects.filter(
                business=self.business,
                actor=limited_user,
                entity_type="AIToolCallLog",
                entity_id=str(log.id),
                metadata__kind="ai_tool_execution",
                metadata__status="permission_denied",
                metadata__approval_id=approval.id,
            ).exists()
        )

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

    def test_ai_tool_response_masks_secret_input_output_and_error(self):
        log = AIToolCallLog.objects.create(
            business=self.business,
            user=self.owner,
            tool_name="create_task",
            status=AIToolCallLog.Statuses.FAILED,
            input_json={"api_key": "raw-input-key"},
            output_json={"access_token": "raw-output-token"},
            error="Provider failed with token=raw-error-token",
        )
        self.api.force_authenticate(self.owner)

        response = self.api.post(f"/api/ai/tools/{log.id}/execute/")

        self.assertEqual(response.status_code, 400)
        self.assertNotIn("raw-input-key", str(response.data))
        self.assertNotIn("raw-output-token", str(response.data))
        self.assertNotIn("raw-error-token", str(response.data))
        audit = AuditLog.objects.get(
            business=self.business,
            actor=self.owner,
            entity_type="AIToolCallLog",
            entity_id=str(log.id),
            metadata__kind="ai_tool_execution",
            metadata__status=AIToolCallLog.Statuses.REJECTED,
        )
        self.assertNotIn("raw-input-key", str(audit.metadata))
        self.assertNotIn("raw-output-token", str(audit.metadata))
        self.assertNotIn("raw-error-token", str(audit.metadata))

    def test_approval_request_can_be_created_and_approved_by_owner(self):
        self.api.force_authenticate(self.owner)

        create_response = self.api.post(
            "/api/ai/approval-requests/",
            {
                "business": self.business.id,
                "action_type": ApprovalRequest.ActionTypes.CAMPAIGN_LAUNCH,
                "payload": {"campaign_id": 123, "api_key": "secret"},
                "source_object_type": "OutreachCampaign",
                "source_object_id": "123",
            },
            format="json",
        )

        self.assertEqual(create_response.status_code, 201)
        self.assertEqual(create_response.data["requested_by"], self.owner.id)
        self.assertEqual(create_response.data["payload"]["api_key"], "configured")
        approval = ApprovalRequest.objects.get()
        create_audit = AuditLog.objects.get(
            business=self.business,
            actor=self.owner,
            entity_type="ApprovalRequest",
            entity_id=str(approval.id),
            action=AuditLog.Actions.CREATE,
            metadata__kind="ai_approval_request",
        )
        self.assertEqual(create_audit.metadata["action_type"], ApprovalRequest.ActionTypes.CAMPAIGN_LAUNCH)
        self.assertEqual(create_audit.metadata["payload_keys"], ["api_key", "campaign_id"])
        self.assertNotIn("secret", str(create_audit.metadata))
        approve_response = self.api.post(f"/api/ai/approval-requests/{approval.id}/approve/", {"reason": "Looks safe"}, format="json")

        self.assertEqual(approve_response.status_code, 200)
        approval.refresh_from_db()
        self.assertEqual(approval.status, ApprovalRequest.Statuses.APPROVED)
        self.assertEqual(approval.approved_by, self.owner)
        self.assertEqual(approval.reason, "Looks safe")
        self.assertTrue(
            AuditLog.objects.filter(
                business=self.business,
                actor=self.owner,
                entity_type="ApprovalRequest",
                entity_id=str(approval.id),
                action=AuditLog.Actions.UPDATE,
                metadata__kind="ai_approval_decision",
                metadata__decision="approved",
                metadata__reason="Looks safe",
            ).exists()
        )

    def test_approval_request_create_cannot_seed_approved_status_or_decision_fields(self):
        log = AIToolCallLog.objects.create(
            business=self.business,
            user=self.owner,
            tool_name="create_task",
            input_json={"title": "Blocked malicious approval"},
        )
        self.api.force_authenticate(self.owner)

        create_response = self.api.post(
            "/api/ai/approval-requests/",
            {
                "business": self.business.id,
                "action_type": ApprovalRequest.ActionTypes.AI_PIPELINE,
                "ai_tool_call_log": log.id,
                "payload": {"tool_call_id": log.id, "tool_name": log.tool_name},
                "status": ApprovalRequest.Statuses.APPROVED,
                "approved_by": self.owner.id,
                "approved_at": timezone.now().isoformat(),
            },
            format="json",
        )

        self.assertEqual(create_response.status_code, 201)
        approval = ApprovalRequest.objects.get(ai_tool_call_log=log)
        self.assertEqual(approval.status, ApprovalRequest.Statuses.PENDING)
        self.assertIsNone(approval.approved_by)
        self.assertIsNone(approval.approved_at)

        execute_response = self.api.post(f"/api/ai/tools/{log.id}/execute/", {"approval_id": approval.id}, format="json")

        self.assertEqual(execute_response.status_code, 403)
        self.assertEqual(execute_response.data["approval_status"], "approval_not_approved")
        self.assertEqual(Task.objects.count(), 0)

    def test_approval_request_rejects_foreign_ai_tool_call_log(self):
        foreign_log = AIToolCallLog.objects.create(
            business=self.other_business,
            user=self.other_owner,
            tool_name="create_task",
            input_json={"title": "Foreign tool call"},
        )
        self.api.force_authenticate(self.owner)

        response = self.api.post(
            "/api/ai/approval-requests/",
            {
                "business": self.business.id,
                "action_type": ApprovalRequest.ActionTypes.AI_PIPELINE,
                "ai_tool_call_log": foreign_log.id,
                "payload": {"tool_call_id": foreign_log.id},
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(ApprovalRequest.objects.count(), 0)

    def test_approval_request_reject_writes_audit(self):
        approval = ApprovalRequest.objects.create(
            business=self.business,
            requested_by=self.owner,
            action_type=ApprovalRequest.ActionTypes.AI_PIPELINE,
            payload={"lead_id": 100, "access_token": "raw-approval-token"},
        )
        self.api.force_authenticate(self.owner)

        response = self.api.post(
            f"/api/ai/approval-requests/{approval.id}/reject/",
            {"reason": "Needs manual review"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        approval.refresh_from_db()
        self.assertEqual(approval.status, ApprovalRequest.Statuses.REJECTED)
        audit = AuditLog.objects.get(
            business=self.business,
            actor=self.owner,
            entity_type="ApprovalRequest",
            entity_id=str(approval.id),
            action=AuditLog.Actions.UPDATE,
            metadata__kind="ai_approval_decision",
            metadata__decision="rejected",
        )
        self.assertEqual(audit.metadata["reason"], "Needs manual review")
        self.assertEqual(audit.metadata["payload_keys"], ["access_token", "lead_id"])
        self.assertNotIn("raw-approval-token", str(audit.metadata))
