from django.test import TestCase
from django.test import override_settings
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.ai_core.models import AIRequestLog, AgentProfile, BusinessKnowledgeItem
from apps.bots.models import Bot, BotChannel, BotConversation, BotMessage
from apps.businesses.models import Business, BusinessMember
from apps.crm.models import Deal, Pipeline, PipelineStage
from apps.leads.models import Lead
from apps.tasks.models import Task


class BotsFoundationTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.owner = User.objects.create_user(
            username="bot-owner",
            email="bot-owner@example.com",
            password="pass",
            role=User.Roles.BUSINESS_OWNER,
        )
        self.other_owner = User.objects.create_user(
            username="other-bot-owner",
            email="other-bot-owner@example.com",
            password="pass",
            role=User.Roles.BUSINESS_OWNER,
        )
        self.business = Business.objects.create(owner=self.owner, name="Bot Clinic", slug="bot-clinic")
        self.other_business = Business.objects.create(owner=self.other_owner, name="Other Bot Clinic", slug="other-bot-clinic")
        BusinessMember.objects.create(business=self.business, user=self.owner, role=BusinessMember.Roles.OWNER)
        BusinessMember.objects.create(business=self.other_business, user=self.other_owner, role=BusinessMember.Roles.OWNER)

    def test_merchant_can_create_and_list_own_bot(self):
        self.api.force_authenticate(self.owner)

        create_response = self.api.post(
            "/api/bots/",
            {
                "business": self.business.id,
                "name": "Website assistant",
                "status": "draft",
                "default_language": "ru",
                "settings_json": {"tone": "friendly"},
            },
            format="json",
        )
        self.assertEqual(create_response.status_code, 201)

        list_response = self.api.get("/api/bots/")
        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(list_response.data["count"], 1)
        self.assertEqual(list_response.data["results"][0]["name"], "Website assistant")

    def test_merchant_cannot_create_bot_for_other_business(self):
        self.api.force_authenticate(self.owner)

        response = self.api.post(
            "/api/bots/",
            {"business": self.other_business.id, "name": "Foreign bot"},
            format="json",
        )

        self.assertEqual(response.status_code, 403)

    def test_bot_channels_are_tenant_filtered(self):
        own_bot = Bot.objects.create(business=self.business, name="Own bot")
        other_bot = Bot.objects.create(business=self.other_business, name="Other bot")
        BotChannel.objects.create(bot=own_bot, channel=BotChannel.Channels.WEBSITE)
        BotChannel.objects.create(bot=other_bot, channel=BotChannel.Channels.TELEGRAM)
        self.api.force_authenticate(self.owner)

        response = self.api.get("/api/bot-channels/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["bot"], own_bot.id)

    def test_bot_conversation_and_message_are_tenant_filtered(self):
        own_bot = Bot.objects.create(business=self.business, name="Own bot")
        other_bot = Bot.objects.create(business=self.other_business, name="Other bot")
        own_conversation = BotConversation.objects.create(
            business=self.business,
            bot=own_bot,
            channel=BotConversation.Channels.WEBSITE,
            external_user_id="visitor-1",
        )
        other_conversation = BotConversation.objects.create(
            business=self.other_business,
            bot=other_bot,
            channel=BotConversation.Channels.WHATSAPP,
            external_user_id="visitor-2",
        )
        BotMessage.objects.create(conversation=own_conversation, direction=BotMessage.Directions.INBOUND, text="Hello")
        BotMessage.objects.create(conversation=other_conversation, direction=BotMessage.Directions.INBOUND, text="Hidden")
        self.api.force_authenticate(self.owner)

        conversations_response = self.api.get("/api/bot-conversations/")
        messages_response = self.api.get("/api/bot-messages/")

        self.assertEqual(conversations_response.status_code, 200)
        self.assertEqual(messages_response.status_code, 200)
        self.assertEqual(conversations_response.data["count"], 1)
        self.assertEqual(messages_response.data["count"], 1)
        self.assertEqual(messages_response.data["results"][0]["text"], "Hello")

    def test_public_website_chat_creates_conversation_message_client_and_lead(self):
        bot = Bot.objects.create(business=self.business, name="Website bot", status=Bot.Statuses.ACTIVE)
        channel = BotChannel.objects.create(
            bot=bot,
            channel=BotChannel.Channels.WEBSITE,
            status=BotChannel.Statuses.ACTIVE,
        )

        response = self.api.post(
            f"/api/public/website-chat/{channel.public_token}/conversations/",
            {
                "full_name": "Website Lead",
                "phone": "+77015550101",
                "message": "Хочу записаться",
                "external_user_id": "visitor-100",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertIsNotNone(response.data["conversation_id"])
        self.assertIsNotNone(response.data["client_id"])
        self.assertIsNotNone(response.data["lead_id"])
        self.assertEqual(BotConversation.objects.count(), 1)
        self.assertEqual(BotMessage.objects.count(), 1)
        conversation = BotConversation.objects.get()
        self.assertEqual(conversation.business, self.business)
        self.assertEqual(conversation.client.full_name, "Website Lead")
        self.assertEqual(conversation.lead.source, "website")

    def test_public_website_chat_can_append_message_to_conversation(self):
        bot = Bot.objects.create(business=self.business, name="Website bot", status=Bot.Statuses.ACTIVE)
        channel = BotChannel.objects.create(
            bot=bot,
            channel=BotChannel.Channels.WEBSITE,
            status=BotChannel.Statuses.ACTIVE,
        )
        conversation = BotConversation.objects.create(
            business=self.business,
            bot=bot,
            channel=BotConversation.Channels.WEBSITE,
            external_user_id="visitor-100",
        )

        response = self.api.post(
            f"/api/public/website-chat/{channel.public_token}/conversations/{conversation.public_id}/messages/",
            {"message": "Второе сообщение"},
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["conversation_id"], str(conversation.public_id))
        self.assertEqual(BotMessage.objects.count(), 1)
        self.assertEqual(BotMessage.objects.get().text, "Второе сообщение")

    def test_public_website_chat_rejects_non_website_channel(self):
        bot = Bot.objects.create(business=self.business, name="Telegram bot", status=Bot.Statuses.ACTIVE)
        channel = BotChannel.objects.create(
            bot=bot,
            channel=BotChannel.Channels.TELEGRAM,
            status=BotChannel.Statuses.ACTIVE,
        )

        response = self.api.get(f"/api/public/website-chat/{channel.public_token}/")

        self.assertEqual(response.status_code, 404)

    @override_settings(OPENAI_API_KEY="")
    def test_suggest_reply_returns_suggestion_without_sending_message(self):
        BusinessKnowledgeItem.objects.create(
            business=self.business,
            title="Booking policy",
            content="Offer two nearest appointment slots.",
            category="bot",
        )
        bot = Bot.objects.create(business=self.business, name="Website bot", status=Bot.Statuses.ACTIVE)
        conversation = BotConversation.objects.create(
            business=self.business,
            bot=bot,
            channel=BotConversation.Channels.WEBSITE,
            external_user_id="visitor-100",
        )
        BotMessage.objects.create(
            conversation=conversation,
            direction=BotMessage.Directions.INBOUND,
            text="Можно записаться сегодня?",
        )
        self.api.force_authenticate(self.owner)

        response = self.api.post(f"/api/bot-conversations/{conversation.id}/suggest-reply/")

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["is_mock"])
        self.assertIn("suggested_reply", response.data)
        self.assertEqual(BotMessage.objects.count(), 1)
        log = AIRequestLog.objects.get(prompt_type="bot_suggest_reply")
        self.assertEqual(log.business, self.business)
        self.assertEqual(log.source, AIRequestLog.Sources.BOT)
        self.assertEqual(log.input_json["conversation_id"], conversation.id)
        self.assertEqual(log.input_json["context"][0]["title"], "Booking policy")

    @override_settings(OPENAI_API_KEY="")
    def test_suggest_reply_uses_bot_agent_profile_when_present(self):
        bot = Bot.objects.create(business=self.business, name="Website bot", status=Bot.Statuses.ACTIVE)
        AgentProfile.objects.create(
            business=self.business,
            bot=bot,
            name="Clinic sales agent",
            role_description="Qualify leads and offer appointment slots.",
            tone=AgentProfile.Tones.SALES,
            language="ru",
            system_prompt="Always be concise.",
        )
        conversation = BotConversation.objects.create(
            business=self.business,
            bot=bot,
            channel=BotConversation.Channels.WEBSITE,
            external_user_id="visitor-agent",
        )
        BotMessage.objects.create(conversation=conversation, direction=BotMessage.Directions.INBOUND, text="Хочу записаться")
        self.api.force_authenticate(self.owner)

        response = self.api.post(f"/api/bot-conversations/{conversation.id}/suggest-reply/")

        self.assertEqual(response.status_code, 200)
        log = AIRequestLog.objects.get(prompt_type="bot_suggest_reply")
        self.assertEqual(log.input_json["agent_profile"]["name"], "Clinic sales agent")
        self.assertIn("Clinic sales agent", log.input_json["user_input"])

    @override_settings(OPENAI_API_KEY="")
    def test_suggest_reply_rejects_foreign_conversation(self):
        bot = Bot.objects.create(business=self.other_business, name="Other bot", status=Bot.Statuses.ACTIVE)
        conversation = BotConversation.objects.create(
            business=self.other_business,
            bot=bot,
            channel=BotConversation.Channels.WEBSITE,
            external_user_id="visitor-200",
        )
        self.api.force_authenticate(self.owner)

        response = self.api.post(f"/api/bot-conversations/{conversation.id}/suggest-reply/")

        self.assertEqual(response.status_code, 404)


class InboxBackendTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.owner = User.objects.create_user(
            username="inbox-owner",
            email="inbox-owner@example.com",
            password="pass",
            role=User.Roles.BUSINESS_OWNER,
        )
        self.manager = User.objects.create_user(
            username="inbox-manager",
            email="inbox-manager@example.com",
            password="pass",
            role=User.Roles.BUSINESS_MANAGER,
        )
        self.other_owner = User.objects.create_user(
            username="other-inbox-owner",
            email="other-inbox-owner@example.com",
            password="pass",
            role=User.Roles.BUSINESS_OWNER,
        )
        self.platform_user = User.objects.create_user(
            username="inbox-platform",
            email="inbox-platform@example.com",
            password="pass",
            role=User.Roles.PLATFORM_ADMIN,
        )
        self.business = Business.objects.create(owner=self.owner, name="Inbox Clinic", slug="inbox-clinic")
        self.other_business = Business.objects.create(owner=self.other_owner, name="Other Inbox", slug="other-inbox")
        BusinessMember.objects.create(business=self.business, user=self.owner, role=BusinessMember.Roles.OWNER)
        BusinessMember.objects.create(business=self.business, user=self.manager, role=BusinessMember.Roles.MANAGER)
        BusinessMember.objects.create(business=self.other_business, user=self.other_owner, role=BusinessMember.Roles.OWNER)
        self.bot = Bot.objects.create(business=self.business, name="Inbox bot", status=Bot.Statuses.ACTIVE)
        self.other_bot = Bot.objects.create(business=self.other_business, name="Other inbox bot", status=Bot.Statuses.ACTIVE)
        self.client = self.business.clients.create(full_name="Алия Иванова", phone="+77015550101", email="aliya@example.com")
        self.conversation = BotConversation.objects.create(
            business=self.business,
            bot=self.bot,
            channel=BotConversation.Channels.WEBSITE,
            external_user_id="visitor-1",
            client=self.client,
            priority=BotConversation.Priorities.HIGH,
        )
        self.other_conversation = BotConversation.objects.create(
            business=self.other_business,
            bot=self.other_bot,
            channel=BotConversation.Channels.TELEGRAM,
            external_user_id="visitor-2",
        )

    def test_inbox_conversations_are_tenant_filtered(self):
        BotMessage.objects.create(
            conversation=self.conversation,
            direction=BotMessage.Directions.INBOUND,
            text="Need consultation",
        )
        BotMessage.objects.create(
            conversation=self.other_conversation,
            direction=BotMessage.Directions.INBOUND,
            text="Hidden message",
        )
        self.api.force_authenticate(self.owner)

        response = self.api.get("/api/inbox/conversations/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["id"], self.conversation.id)

    def test_platform_and_anonymous_users_cannot_open_merchant_inbox(self):
        self.api.force_authenticate(self.platform_user)
        platform_response = self.api.get("/api/inbox/conversations/")
        self.api.force_authenticate(None)
        anonymous_response = self.api.get("/api/inbox/conversations/")

        self.assertEqual(platform_response.status_code, 403)
        self.assertIn(anonymous_response.status_code, [401, 403])

    def test_bot_message_api_updates_inbox_timestamps_and_unread_counter(self):
        self.api.force_authenticate(self.owner)

        response = self.api.post(
            "/api/bot-messages/",
            {
                "conversation": self.conversation.id,
                "direction": BotMessage.Directions.INBOUND,
                "sender_type": BotMessage.SenderTypes.CLIENT,
                "text": "Можно записаться?",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.conversation.refresh_from_db()
        self.assertEqual(self.conversation.unread_count, 1)
        self.assertIsNotNone(self.conversation.last_message_at)
        self.assertIsNotNone(self.conversation.last_inbound_at)

        inbox_response = self.api.get("/api/inbox/conversations/?unread=true&search=записаться")
        self.assertEqual(inbox_response.status_code, 200)
        self.assertEqual(inbox_response.data["count"], 1)

    def test_inbox_messages_assign_handoff_and_mark_read_actions_work(self):
        self.api.force_authenticate(self.owner)
        message_response = self.api.post(
            "/api/bot-messages/",
            {
                "conversation": self.conversation.id,
                "direction": BotMessage.Directions.INBOUND,
                "sender_type": BotMessage.SenderTypes.CLIENT,
                "text": "Hello inbox",
            },
            format="json",
        )
        self.assertEqual(message_response.status_code, 201)

        messages_response = self.api.get(f"/api/inbox/conversations/{self.conversation.id}/messages/")
        self.assertEqual(messages_response.status_code, 200)
        self.assertEqual(len(messages_response.data), 1)
        self.assertEqual(messages_response.data[0]["text"], "Hello inbox")

        assign_response = self.api.post(
            f"/api/inbox/conversations/{self.conversation.id}/assign/",
            {"user_id": self.manager.id},
            format="json",
        )
        self.assertEqual(assign_response.status_code, 200)
        self.assertEqual(assign_response.data["assigned_to"], self.manager.id)

        handoff_response = self.api.post(
            f"/api/inbox/conversations/{self.conversation.id}/handoff/",
            {"reason": "Manager review"},
            format="json",
        )
        self.assertEqual(handoff_response.status_code, 200)
        self.assertTrue(handoff_response.data["handoff_required"])
        self.assertFalse(handoff_response.data["bot_enabled"])

        handoff_filter_response = self.api.get("/api/inbox/conversations/?handoff_required=true&q=Hello")
        self.assertEqual(handoff_filter_response.status_code, 200)
        self.assertEqual(handoff_filter_response.data["count"], 1)

        mark_read_response = self.api.post(f"/api/inbox/conversations/{self.conversation.id}/mark-read/")
        self.assertEqual(mark_read_response.status_code, 200)
        self.assertEqual(mark_read_response.data["unread_count"], 0)

    def test_manager_can_send_outbound_message_from_inbox(self):
        self.api.force_authenticate(self.owner)

        response = self.api.post(
            f"/api/inbox/conversations/{self.conversation.id}/messages/",
            {"text": "Здравствуйте, можем записать вас на завтра", "sender_type": "manager"},
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["direction"], BotMessage.Directions.OUTBOUND)
        self.assertEqual(response.data["sender_type"], BotMessage.SenderTypes.MANAGER)
        self.assertEqual(response.data["status"], BotMessage.Statuses.QUEUED)
        self.conversation.refresh_from_db()
        self.assertIsNotNone(self.conversation.last_outbound_at)

    def test_inbox_suggest_reply_uses_conversation_context(self):
        BotMessage.objects.create(
            conversation=self.conversation,
            direction=BotMessage.Directions.INBOUND,
            sender_type=BotMessage.SenderTypes.CLIENT,
            text="Хочу записаться на консультацию завтра",
        )
        self.api.force_authenticate(self.owner)

        response = self.api.post(f"/api/inbox/conversations/{self.conversation.id}/suggest-reply/")

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["suggested_reply"])
        self.assertEqual(response.data["messages_used"], 1)
        self.assertEqual(response.data["client_id"], self.client.id)
        self.assertIsNone(response.data["lead_id"])
        log = AIRequestLog.objects.filter(prompt_type="bot_suggest_reply").latest("id")
        self.assertEqual(log.input_json["crm_context"]["client"]["id"], self.client.id)

    def test_legacy_bot_suggest_reply_endpoint_still_works(self):
        BotMessage.objects.create(
            conversation=self.conversation,
            direction=BotMessage.Directions.INBOUND,
            sender_type=BotMessage.SenderTypes.CLIENT,
            text="Нужна цена",
        )
        self.api.force_authenticate(self.owner)

        response = self.api.post(f"/api/bot-conversations/{self.conversation.id}/suggest-reply/")

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["suggested_reply"])
        self.assertEqual(response.data["messages_used"], 1)

    def test_inbox_can_create_task_and_lead_from_conversation(self):
        BotMessage.objects.create(
            conversation=self.conversation,
            direction=BotMessage.Directions.INBOUND,
            text="Нужна консультация",
        )
        self.api.force_authenticate(self.owner)

        lead_response = self.api.post(
            f"/api/inbox/conversations/{self.conversation.id}/create-lead/",
            {"message": "Lead from inbox"},
            format="json",
        )
        self.assertEqual(lead_response.status_code, 201)
        self.conversation.refresh_from_db()
        self.assertEqual(self.conversation.lead_id, lead_response.data["id"])

        task_response = self.api.post(
            f"/api/inbox/conversations/{self.conversation.id}/create-task/",
            {"title": "Перезвонить из inbox", "priority": "high"},
            format="json",
        )
        self.assertEqual(task_response.status_code, 201)
        self.assertEqual(task_response.data["lead"], self.conversation.lead_id)
        self.assertEqual(task_response.data["client"], self.client.id)
        self.assertEqual(Task.objects.get(id=task_response.data["id"]).business, self.business)

    def test_inbox_can_link_existing_lead_and_reject_foreign_lead(self):
        lead = Lead.objects.create(business=self.business, client=self.client, source=Lead.Sources.WEBSITE)
        foreign_client = self.other_business.clients.create(full_name="Foreign client")
        foreign_lead = Lead.objects.create(business=self.other_business, client=foreign_client)
        self.api.force_authenticate(self.owner)

        foreign_response = self.api.post(
            f"/api/inbox/conversations/{self.conversation.id}/link-lead/",
            {"lead_id": foreign_lead.id},
            format="json",
        )
        self.assertEqual(foreign_response.status_code, 400)

        response = self.api.post(
            f"/api/inbox/conversations/{self.conversation.id}/link-lead/",
            {"lead_id": lead.id},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["lead"], lead.id)

    def test_inbox_can_create_and_link_client_from_conversation(self):
        conversation = BotConversation.objects.create(
            business=self.business,
            bot=self.bot,
            channel=BotConversation.Channels.WEBSITE,
            external_user_id="new-visitor",
        )
        duplicate = self.business.clients.create(full_name="Existing visitor", phone="+77010000000")
        self.api.force_authenticate(self.owner)

        duplicate_response = self.api.post(
            f"/api/inbox/conversations/{conversation.id}/create-client/",
            {"full_name": "New visitor", "phone": "+7 701 000 00 00"},
            format="json",
        )
        self.assertEqual(duplicate_response.status_code, 200)
        self.assertTrue(duplicate_response.data["requires_confirmation"])
        self.assertEqual(duplicate_response.data["duplicates"][0]["id"], duplicate.id)

        link_response = self.api.post(
            f"/api/inbox/conversations/{conversation.id}/link-client/",
            {"client_id": duplicate.id},
            format="json",
        )
        self.assertEqual(link_response.status_code, 200)
        self.assertEqual(link_response.data["client"], duplicate.id)

        conversation.refresh_from_db()
        conversation.client = None
        conversation.save(update_fields=["client"])
        create_response = self.api.post(
            f"/api/inbox/conversations/{conversation.id}/create-client/",
            {"full_name": "Forced visitor", "phone": "+7 701 000 00 00", "force_create": True},
            format="json",
        )
        self.assertEqual(create_response.status_code, 201)
        self.assertTrue(create_response.data["created"])
        self.assertEqual(create_response.data["client"]["full_name"], "Forced visitor")

    def test_inbox_can_create_and_link_deal_from_conversation(self):
        self.api.force_authenticate(self.owner)

        create_response = self.api.post(
            f"/api/inbox/conversations/{self.conversation.id}/create-deal/",
            {"title": "Inbox deal", "amount": "15000.00"},
            format="json",
        )
        self.assertEqual(create_response.status_code, 201)
        self.assertEqual(create_response.data["title"], "Inbox deal")
        self.conversation.refresh_from_db()
        self.assertEqual(self.conversation.deal_id, create_response.data["id"])

        pipeline = Pipeline.objects.get(business=self.business)
        stage = PipelineStage.objects.get(pipeline=pipeline)
        other_deal = Deal.objects.create(
            business=self.business,
            client=self.client,
            pipeline=pipeline,
            stage=stage,
            title="Existing linked deal",
        )
        link_response = self.api.post(
            f"/api/inbox/conversations/{self.conversation.id}/link-deal/",
            {"deal_id": other_deal.id},
            format="json",
        )
        self.assertEqual(link_response.status_code, 200)
        self.assertEqual(link_response.data["deal"], other_deal.id)
