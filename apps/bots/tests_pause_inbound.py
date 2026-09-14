"""Transport remains usable independently of autonomous AI eligibility."""

import hashlib
import hmac
import json
from types import SimpleNamespace
from unittest.mock import patch

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.ai_core.models import AIRequestLog, AgentProfile, BusinessKnowledgeItem
from apps.bots.models import Bot, BotChannel, BotConversation, BotMessage
from apps.bots.outbound_delivery import deliver_outbound_message
from apps.businesses.models import Business, BusinessMember
from apps.clients.models import Client
from apps.conversations.auto_pipeline import AutoPipelineConfig, AutoPipelineDecision, _send_auto_reply, maybe_run_auto_pipeline
from apps.crm.models import Deal
from apps.integrations.bot_channel_credentials import store_telegram_webhook_secret
from apps.integrations.models import BusinessEvent
from apps.leads.models import Lead
from apps.notifications.models import Notification
from apps.scheduling.models import Appointment
from apps.tasks.models import Task


@override_settings(AI_PROVIDER="mock", TELEGRAM_ENABLED=False, WHATSAPP_ENABLED=False,
                   TELEGRAM_WEBHOOK_SECRET="pause-global-secret-B9v_qR7m-L2p_N9x-T5s_K3u",
                   INSTAGRAM_ENABLED=False, INSTAGRAM_APP_SECRET="pause-test-signing-key",
                   WHATSAPP_APP_SECRET="pause-test-signing-key")
class AIPauseInboundTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.owner = User.objects.create_user(username="pause-owner", email="pause-owner@example.com")
        self.business = Business.objects.create(owner=self.owner, name="Pause test", slug="pause-test")
        BusinessMember.objects.create(business=self.business, user=self.owner, role=BusinessMember.Roles.OWNER)
        self.manager = User.objects.create_user(username="pause-manager", email="pause-manager@example.com")
        BusinessMember.objects.create(business=self.business, user=self.manager, role=BusinessMember.Roles.MANAGER)
        self.bot = Bot.objects.create(
            business=self.business, name="Paused agent", status=Bot.Statuses.PAUSED,
            settings_json={"auto_crm_pipeline": {"enabled": True, "mode": "lead_task",
                "require_review_on_fallback": False, "auto_send_reply": True}},
        )
        self.channel = BotChannel.objects.create(bot=self.bot, channel=BotChannel.Channels.WEBSITE,
                                                 status=BotChannel.Statuses.ACTIVE)

    def _ready(self):
        self.bot.status = Bot.Statuses.ACTIVE
        self.bot.save(update_fields=["status"])
        AgentProfile.objects.create(business=self.business, bot=self.bot, name="Ready profile")
        BusinessKnowledgeItem.objects.create(business=self.business, title="Knowledge", content="Ask the manager.")

    def _post_website(self, **data):
        return self.api.post(f"/api/public/website-chat/{self.channel.public_token}/conversations/",
                             {"message": "Please help", "external_user_id": "visitor", **data}, format="json")

    def _assert_no_ai_effects(self):
        for model in (AIRequestLog, Client, Lead, Deal, Task, Appointment):
            self.assertEqual(model.objects.filter(business=self.business).count(), 0, model.__name__)
        self.assertFalse(BotMessage.objects.filter(sender_type=BotMessage.SenderTypes.BOT).exists())

    def test_website_inbound_is_independent_of_agent_status_and_readiness(self):
        for state in (Bot.Statuses.PAUSED, Bot.Statuses.DRAFT, Bot.Statuses.ACTIVE):
            with self.subTest(state=state), patch("apps.conversations.auto_pipeline.qualify_conversation") as qualify:
                self.bot.status = state
                self.bot.save(update_fields=["status"])
                response = self._post_website()
                self.assertEqual(response.status_code, 201, response.data)
                conversation = BotConversation.objects.get(public_id=response.data["conversation_id"])
                self.assertEqual(conversation.unread_count, 1)
                self.assertTrue(BusinessEvent.objects.filter(business=self.business, event_type="message.received",
                                                            payload_json__conversation_id=conversation.id).exists())
                self.assertTrue(Notification.objects.filter(business=self.business, recipient=self.manager).exists())
                qualify.assert_not_called()
                self._assert_no_ai_effects()

    def test_channel_disable_still_blocks_public_get_create_and_append(self):
        conversation = BotConversation.objects.create(business=self.business, bot=self.bot, channel="website")
        base = f"/api/public/website-chat/{self.channel.public_token}/"
        for state in (BotChannel.Statuses.DRAFT, BotChannel.Statuses.PAUSED, BotChannel.Statuses.ERROR):
            with self.subTest(state=state):
                self.channel.status = state
                self.channel.save(update_fields=["status"])
                self.assertEqual(self.api.get(base).status_code, 403)
                self.assertEqual(self._post_website().status_code, 403)
                self.assertEqual(self.api.post(base + f"conversations/{conversation.public_id}/messages/",
                                               {"message": "Hello"}, format="json").status_code, 403)
        self.assertFalse(BotMessage.objects.exists())

    def test_manager_reply_and_new_inbound_remain_available_after_pause(self):
        self._ready()
        self.api.force_authenticate(self.owner)
        self.assertEqual(self.api.post(f"/api/bots/{self.bot.id}/pause/").status_code, 200)
        self.api.force_authenticate(None)
        response = self._post_website()
        self.assertEqual(response.status_code, 201, response.data)
        conversation = BotConversation.objects.get(public_id=response.data["conversation_id"])
        self.api.force_authenticate(self.manager)
        reply = self.api.post(f"/api/inbox/conversations/{conversation.id}/messages/",
                              {"text": "A manager is here"}, format="json")
        self.assertEqual(reply.status_code, 201, reply.data)
        self.api.force_authenticate(None)
        followup = self.api.post(f"/api/public/website-chat/{self.channel.public_token}/conversations/{conversation.public_id}/messages/",
                                 {"message": "Thank you"}, format="json")
        self.assertEqual(followup.status_code, 201, followup.data)
        self.assertEqual(conversation.messages.filter(direction="inbound").count(), 2)
        self._assert_no_ai_effects()

    def test_foreign_token_cannot_append_to_paused_conversation(self):
        foreign_owner = User.objects.create_user(username="foreign-pause-owner", email="foreign-pause@example.com")
        foreign_business = Business.objects.create(owner=foreign_owner, name="Foreign", slug="foreign-pause")
        foreign_bot = Bot.objects.create(business=foreign_business, name="Foreign")
        foreign_channel = BotChannel.objects.create(bot=foreign_bot, channel="website", status="active")
        conversation = BotConversation.objects.create(business=self.business, bot=self.bot, channel="website")
        response = self.api.post(f"/api/public/website-chat/{foreign_channel.public_token}/conversations/{conversation.public_id}/messages/",
                                  {"message": "Wrong tenant"}, format="json")
        self.assertEqual(response.status_code, 404)
        self.api.force_authenticate(foreign_owner)
        response = self.api.post(f"/api/inbox/conversations/{conversation.id}/messages/", {"text": "Wrong tenant"}, format="json")
        self.assertEqual(response.status_code, 404)
        self.assertFalse(BotMessage.objects.exists())

    def _provider_request(self, provider, message_id="delivery-1", *, valid=True):
        if provider == "telegram":
            payload = {"update_id": 101, "message": {"message_id": message_id,
                "chat": {"id": 123}, "from": {"id": 123}, "text": "Hello"}}
            return self.api.post("/api/integrations/telegram/webhook/", payload, format="json",
                                 HTTP_X_TELEGRAM_BOT_API_SECRET_TOKEN=self.secret if valid else "invalid")
        if provider == "whatsapp":
            payload = {"object": "whatsapp_business_account", "entry": [{"changes": [{"value": {"metadata": {"phone_number_id": "pause-phone"},
                "messages": [{"from": "123", "id": message_id, "type": "text", "text": {"body": "Hello"}}]}}]}]}
        else:
            payload = {"object": "instagram", "entry": [{"id": "pause-instagram", "messaging": [
                {"sender": {"id": "123"}, "recipient": {"id": "pause-instagram"},
                 "message": {"mid": message_id, "text": "Hello"}}]}]}
        body = json.dumps(payload)
        signature = hmac.new(b"pause-test-signing-key", body.encode(), hashlib.sha256).hexdigest()
        return self.api.post(f"/api/integrations/{provider}/webhook/", body, content_type="application/json",
                             HTTP_X_HUB_SIGNATURE_256="sha256=" + (signature if valid else "invalid"))

    def test_authenticated_provider_delivery_survives_pause_without_ai_or_replay(self):
        self.secret = "pause-telegram-secret-A8v_qR7m-L2p_N9x-T5s_K3u"
        for provider, identity in (("telegram", ""), ("whatsapp", "pause-phone"), ("instagram", "pause-instagram")):
            with self.subTest(provider=provider):
                channel = BotChannel.objects.create(bot=self.bot, channel=provider, status="active", external_id=identity)
                if provider == "telegram":
                    store_telegram_webhook_secret(channel, self.secret)
                with patch("apps.conversations.auto_pipeline.qualify_conversation") as qualify:
                    response = self._provider_request(provider)
                    self.assertEqual(response.status_code, 200, response.data)
                    repeated = self._provider_request(provider)
                    self.assertEqual(repeated.status_code, 200, repeated.data)
                    conversation = BotConversation.objects.get(bot=self.bot, channel=provider)
                    self.assertEqual(conversation.messages.count(), 1)
                    self.assertEqual(conversation.unread_count, 1)
                    self.assertEqual(BusinessEvent.objects.filter(source=provider, event_type="message.received").count(), 1)
                    qualify.assert_not_called()
                    self._assert_no_ai_effects()
                rejected = self._provider_request(provider, message_id="invalid", valid=False)
                self.assertEqual(rejected.status_code, 403, rejected.data)
                channel.status = BotChannel.Statuses.PAUSED
                channel.save(update_fields=["status"])
                rejected = self._provider_request(provider, message_id="disabled")
                self.assertIn(rejected.status_code, (400, 403), rejected.data)
                self.assertEqual(conversation.messages.count(), 1)

    def test_direct_auto_pipeline_rechecks_current_agent_before_qualification(self):
        self._ready()
        conversation = BotConversation.objects.create(business=self.business, bot=self.bot, channel="website")
        message = BotMessage.objects.create(conversation=conversation, direction="inbound", text="Help")
        # Simulate a worker holding an old, active related object after an owner pauses it.
        Bot.objects.filter(pk=self.bot.pk).update(status=Bot.Statuses.PAUSED)
        with patch("apps.conversations.auto_pipeline.qualify_conversation") as qualify:
            decision = maybe_run_auto_pipeline(conversation=conversation, message=message, channel=self.channel)
        self.assertEqual(decision.status, "skipped_agent_unready")
        qualify.assert_not_called()
        self._assert_no_ai_effects()

    def test_knowledge_removed_blocks_auto_pipeline_but_not_inbound(self):
        self._ready()
        BusinessKnowledgeItem.objects.filter(business=self.business).update(is_active=False)
        with patch("apps.conversations.auto_pipeline.qualify_conversation") as qualify:
            self.assertEqual(self._post_website().status_code, 201)
        qualify.assert_not_called()
        self._assert_no_ai_effects()

    def test_pause_during_qualification_prevents_crm_actions(self):
        self._ready()
        conversation = BotConversation.objects.create(business=self.business, bot=self.bot, channel="website")
        message = BotMessage.objects.create(conversation=conversation, direction="inbound", text="Help")

        def pause_during_request(**kwargs):
            Bot.objects.filter(pk=self.bot.pk).update(status=Bot.Statuses.PAUSED)
            return None, None

        with patch("apps.conversations.auto_pipeline.qualify_conversation", side_effect=pause_during_request), \
             patch("apps.conversations.auto_pipeline.run_conversation_pipeline") as pipeline:
            decision = maybe_run_auto_pipeline(conversation=conversation, message=message, channel=self.channel)
        self.assertEqual(decision.status, "skipped_agent_unready")
        pipeline.assert_not_called()
        self._assert_no_ai_effects()

    def test_queued_bot_reply_is_stopped_but_manager_delivery_is_not(self):
        self._ready()
        conversation = BotConversation.objects.create(business=self.business, bot=self.bot,
                                                       channel="website", external_user_id="visitor")
        automatic = BotMessage.objects.create(conversation=conversation, direction="outbound",
                                               sender_type="bot", text="Old automatic reply", status="queued")
        manual = BotMessage.objects.create(conversation=conversation, direction="outbound",
                                            sender_type="manager", text="Manager reply", status="queued")
        Bot.objects.filter(pk=self.bot.pk).update(status=Bot.Statuses.PAUSED)
        with patch("apps.bots.outbound_delivery.send_message", return_value={"ok": True}) as provider:
            stopped = deliver_outbound_message(automatic.id)
            self.assertEqual(stopped.status, BotMessage.Statuses.FAILED)
            self.assertIsNone(stopped.delivery_next_retry_at)
            provider.assert_not_called()
            delivered = deliver_outbound_message(manual.id)
            self.assertEqual(delivered.status, BotMessage.Statuses.SENT)
            provider.assert_called_once()

    def test_active_ready_agent_still_qualifies_inbound(self):
        self._ready()
        self.bot.settings_json = {"auto_crm_pipeline": {"enabled": True, "confirmation_mode": "suggest_only"}}
        self.bot.save(update_fields=["settings_json"])
        response = self._post_website()
        self.assertEqual(response.status_code, 201, response.data)
        conversation = BotConversation.objects.get(public_id=response.data["conversation_id"])
        self.assertEqual(conversation.metadata_json["auto_crm_pipeline"]["status"], "qualified_only")
        self.assertTrue(AIRequestLog.objects.filter(business=self.business).exists())

    def test_exact_conversation_channel_must_be_active_for_automatic_work(self):
        self._ready()
        BotChannel.objects.create(bot=self.bot, channel="telegram", status="active")
        self.channel.status = BotChannel.Statuses.PAUSED
        self.channel.save(update_fields=["status"])
        conversation = BotConversation.objects.create(business=self.business, bot=self.bot, channel="website")
        message = BotMessage.objects.create(conversation=conversation, direction="inbound", text="Help")
        with patch("apps.conversations.auto_pipeline.qualify_conversation") as qualify:
            decision = maybe_run_auto_pipeline(conversation=conversation, message=message, channel=self.channel)
        self.assertEqual(decision.status, "skipped_channel_inactive")
        qualify.assert_not_called()
        self._assert_no_ai_effects()

    def test_pause_during_reply_generation_drops_result_before_outbox(self):
        self._ready()
        conversation = BotConversation.objects.create(business=self.business, bot=self.bot, channel="website")
        decision = AutoPipelineDecision(status="created_lead_task", reason="Ready before request")

        def pause_during_reply(**kwargs):
            Bot.objects.filter(pk=self.bot.pk).update(status=Bot.Statuses.PAUSED)
            return SimpleNamespace(output_text="Old generated reply"), None, [], []

        with patch("apps.conversations.auto_pipeline.suggest_bot_reply", side_effect=pause_during_reply), \
             patch("apps.conversations.auto_pipeline.send_outbound_message") as send:
            _send_auto_reply(conversation=conversation, config=AutoPipelineConfig(), decision=decision)
        send.assert_not_called()
        self.assertIsNone(decision.reply_message)
        self.assertIn("no longer eligible", decision.reply_error)
        self._assert_no_ai_effects()
