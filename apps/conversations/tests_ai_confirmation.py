from unittest.mock import patch

from django.test import TestCase, override_settings
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.ai_core.models import AgentProfile, BusinessKnowledgeItem
from apps.bots.models import Bot, BotChannel, BotConversation, BotMessage
from apps.businesses.models import Business, BusinessMember
from apps.clients.models import Client
from apps.conversations.pipeline import run_conversation_pipeline
from apps.conversations.ai_qualification import qualify_conversation
from apps.crm.models import Deal
from apps.leads.models import Lead
from apps.integrations.models import BusinessEvent
from apps.core.models import AuditLog
from apps.tasks.models import Task


@override_settings(AI_PROVIDER="mock", OPENAI_API_KEY="", OPENROUTER_API_KEY="")
class AIConfirmationTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username="confirm-owner", email="confirm-owner@example.com", password="pass")
        self.business = Business.objects.create(owner=self.owner, name="Confirmation clinic", slug="confirmation-clinic")
        BusinessMember.objects.create(business=self.business, user=self.owner, role=BusinessMember.Roles.OWNER)
        self.bot = Bot.objects.create(business=self.business, name="Confirmation bot", status=Bot.Statuses.ACTIVE)
        AgentProfile.objects.create(business=self.business, bot=self.bot, name="Reception")
        BusinessKnowledgeItem.objects.create(business=self.business, title="Reception", content="Staff confirms CRM actions and books appointments.")
        self.channel = BotChannel.objects.create(bot=self.bot, channel="website", status="active")
        self.conversation = BotConversation.objects.create(business=self.business, bot=self.bot, channel="website", external_user_id="confirmation-client")
        BotMessage.objects.create(conversation=self.conversation, direction="inbound", sender_type="client", text="Хочу записаться на консультацию и узнать цену")
        self.api = APIClient()
        self.api.force_authenticate(self.owner)
        self.url = f"/api/inbox/conversations/{self.conversation.id}/run-pipeline/"

    def assert_no_work(self):
        self.assertEqual((Lead.objects.count(), Task.objects.count(), Deal.objects.count()), (0, 0, 0))

    def preview(self):
        response = self.api.post(f"/api/inbox/conversations/{self.conversation.id}/qualify/")
        self.assertEqual(response.status_code, 200, response.data)
        return response.data["qualified_at"]

    def payload(self, preview_id):
        return {"preview_id": preview_id, "confirmed_actions": ["create_task"], "create_lead": False, "create_deal": False, "create_task": True, "apply_ai_decisions": False}

    def test_preview_is_read_only_and_confirmation_creates_only_selected_action_once(self):
        preview_id = self.preview()
        self.assert_no_work()
        for _ in range(2):
            response = self.api.post(self.url, self.payload(preview_id), format="json")
            self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual((Lead.objects.count(), Task.objects.count(), Deal.objects.count()), (0, 1, 0))
        self.conversation.refresh_from_db()
        self.assertEqual(self.conversation.metadata_json["conversation_pipeline"]["confirmed_actions"], ["create_task"])
        self.assertEqual(self.conversation.metadata_json["conversation_pipeline"]["last_run_by"], self.owner.id)

    def test_missing_or_mismatched_confirmation_cannot_write(self):
        payload = self.payload(self.preview())
        for actions in (None, [], ["create_lead"], ["create_task", "create_deal"]):
            candidate = dict(payload)
            if actions is None:
                candidate.pop("confirmed_actions")
            else:
                candidate["confirmed_actions"] = actions
            response = self.api.post(self.url, candidate, format="json")
            self.assertEqual(response.status_code, 400, response.data)
            self.assert_no_work()
        self.assertFalse(Client.objects.exists())

    def test_confirmed_website_lead_emits_capture_and_audit_once(self):
        preview_id = self.preview()
        self.assertFalse(BusinessEvent.objects.filter(event_type="lead.captured").exists())
        payload = {"preview_id": preview_id, "confirmed_actions": ["create_lead"], "create_lead": True, "create_deal": False, "create_task": False}
        for _ in range(2):
            response = self.api.post(self.url, payload, format="json")
            self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(Lead.objects.count(), 1)
        self.assertEqual(BusinessEvent.objects.filter(event_type="lead.captured", business=self.business).count(), 1)
        self.assertEqual(AuditLog.objects.filter(metadata__kind="conversation_pipeline_confirmed", actor=self.owner).count(), 1)

    def test_replaced_preview_requires_review_again(self):
        old_id = self.preview()
        self.preview()
        response = self.api.post(self.url, self.payload(old_id), format="json")
        self.assertEqual(response.status_code, 400, response.data)
        self.assertIn("preview_id", response.data)
        self.assert_no_work()

    def test_new_message_invalidates_confirmation(self):
        preview_id = self.preview()
        BotMessage.objects.create(conversation=self.conversation, direction="inbound", sender_type="client", text="Планы изменились")
        response = self.api.post(self.url, self.payload(preview_id), format="json")
        self.assertEqual(response.status_code, 400, response.data)
        self.assertIn("stale", str(response.data))
        self.assert_no_work()

    def test_message_during_qualification_does_not_publish_stale_preview(self):
        def changed_during_request(**kwargs):
            result = qualify_conversation(**kwargs)
            BotMessage.objects.create(conversation=self.conversation, direction="inbound", sender_type="client", text="Отмена запроса")
            return result
        with patch("apps.conversations.inbox_views.qualify_conversation", side_effect=changed_during_request):
            response = self.api.post(f"/api/inbox/conversations/{self.conversation.id}/qualify/")
        self.assertEqual(response.status_code, 400, response.data)
        self.conversation.refresh_from_db()
        self.assertNotIn("conversation_qualification_preview", self.conversation.metadata_json)
        self.assert_no_work()

    def test_staff_permission_denial_is_atomic(self):
        payload = self.payload(self.preview())
        specialist = User.objects.create_user(username="confirm-specialist", email="confirm-specialist@example.com", password="pass")
        BusinessMember.objects.create(business=self.business, user=specialist, role=BusinessMember.Roles.SPECIALIST)
        self.api.force_authenticate(specialist)
        response = self.api.post(self.url, payload, format="json")
        self.assertIn(response.status_code, (403, 404), response.data)
        self.assert_no_work()

    def test_foreign_company_cannot_confirm(self):
        payload = self.payload(self.preview())
        other = User.objects.create_user(username="confirm-other", email="confirm-other@example.com", password="pass")
        other_business = Business.objects.create(owner=other, name="Other", slug="confirm-other")
        BusinessMember.objects.create(business=other_business, user=other, role=BusinessMember.Roles.OWNER)
        self.api.force_authenticate(other)
        response = self.api.post(self.url, payload, format="json")
        self.assertIn(response.status_code, (403, 404), response.data)
        self.assert_no_work()

    def test_service_rejects_unconfirmed_or_automatic_writes(self):
        with self.assertRaises(PermissionDenied):
            run_conversation_pipeline(conversation=self.conversation, source="auto_pipeline", confirmed_actions=["create_lead", "create_deal", "create_task"])
        with self.assertRaises(ValidationError):
            run_conversation_pipeline(conversation=self.conversation, actor=self.owner)
        self.assert_no_work()
        self.assertFalse(Client.objects.exists())

    def test_every_legacy_confirmation_mode_only_proposes_work(self):
        public = APIClient()
        for mode in ("auto_lead_task", "draft_deal", "appointment_explicit"):
            with self.subTest(mode=mode):
                self.channel.config_json = {"auto_crm_pipeline": {"enabled": True, "confirmation_mode": mode, "require_review_on_fallback": False, "min_deal_confidence": .7, "auto_send_reply": True}}
                self.channel.save()
                response = public.post(f"/api/public/website-chat/{self.channel.public_token}/conversations/", {"external_user_id": mode, "message": "Хочу записаться на консультацию и узнать цену"}, format="json")
                self.assertEqual(response.status_code, 201, response.data)
                conversation = BotConversation.objects.get(public_id=response.data["conversation_id"])
                self.assertIsNotNone(conversation.client_id)
                self.assertTrue(conversation.messages.filter(direction="outbound").exists())
                policy = conversation.metadata_json["auto_crm_pipeline"]["confirmation_policy"]
                self.assertEqual(policy["allowed_auto_actions"], ["create_client"])
                self.assertIn("create_lead", policy["requires_explicit_confirmation"])
                self.assert_no_work()

    def test_triage_auto_reply_does_not_require_crm_creation(self):
        self.channel.config_json = {"auto_crm_pipeline": {"enabled": True, "mode": "triage", "auto_send_reply": True, "require_review_on_fallback": False}}
        self.channel.save()
        response = APIClient().post(f"/api/public/website-chat/{self.channel.public_token}/conversations/", {"external_user_id": "triage-only", "message": "Хочу узнать цену"}, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        conversation = BotConversation.objects.get(public_id=response.data["conversation_id"])
        self.assertTrue(conversation.messages.filter(direction="outbound").exists())
        self.assertIsNone(conversation.client_id)
        self.assert_no_work()
