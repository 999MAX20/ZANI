from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.bots.models import Bot, BotChannel, BotConversation, BotMessage
from apps.businesses.models import Business
from apps.accounts.models import User
from apps.integrations.telegram import send_telegram_message


class TelegramIntegrationSkeletonTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.owner = User.objects.create_user(
            username="telegram-owner",
            email="telegram-owner@example.com",
            password="pass",
            role=User.Roles.BUSINESS_OWNER,
        )
        self.business = Business.objects.create(owner=self.owner, name="Telegram Clinic", slug="telegram-clinic")
        self.bot = Bot.objects.create(business=self.business, name="Telegram bot", status=Bot.Statuses.ACTIVE)
        self.channel = BotChannel.objects.create(
            bot=self.bot,
            channel=BotChannel.Channels.TELEGRAM,
            status=BotChannel.Statuses.ACTIVE,
            config_json={"webhook_secret": "telegram-secret", "bot_token": "merchant-token"},
        )

    @override_settings(TELEGRAM_WEBHOOK_SECRET="telegram-secret")
    def test_telegram_webhook_saves_inbound_message(self):
        response = self.api.post(
            "/api/integrations/telegram/webhook/",
            {
                "update_id": 1000,
                "message": {
                    "message_id": 5,
                    "from": {"id": 42, "username": "client"},
                    "chat": {"id": 777},
                    "text": "Здравствуйте",
                },
            },
            format="json",
            HTTP_X_TELEGRAM_BOT_API_SECRET_TOKEN="telegram-secret",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(BotConversation.objects.count(), 1)
        self.assertEqual(BotMessage.objects.count(), 1)
        conversation = BotConversation.objects.get()
        message = BotMessage.objects.get()
        self.assertEqual(conversation.bot, self.bot)
        self.assertEqual(conversation.channel, BotConversation.Channels.TELEGRAM)
        self.assertEqual(conversation.external_user_id, "777")
        self.assertEqual(message.text, "Здравствуйте")
        self.assertEqual(message.payload_json["telegram_username"], "client")

    @override_settings(TELEGRAM_WEBHOOK_SECRET="telegram-secret")
    def test_telegram_webhook_rejects_wrong_secret(self):
        response = self.api.post(
            "/api/integrations/telegram/webhook/",
            {"message": {"chat": {"id": 777}, "text": "Hidden"}},
            format="json",
            HTTP_X_TELEGRAM_BOT_API_SECRET_TOKEN="wrong-secret",
        )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(BotMessage.objects.count(), 0)

    @override_settings(TELEGRAM_ENABLED=False)
    def test_outbound_send_is_mock_when_disabled(self):
        result = send_telegram_message(self.channel, chat_id="777", text="Hello")

        self.assertTrue(result["ok"])
        self.assertTrue(result["mock"])
