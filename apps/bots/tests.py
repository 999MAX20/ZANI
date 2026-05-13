from django.test import TestCase
from django.test import override_settings
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.ai_core.models import AIRequestLog, BusinessKnowledgeItem
from apps.bots.models import Bot, BotChannel, BotConversation, BotMessage
from apps.businesses.models import Business, BusinessMember


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
