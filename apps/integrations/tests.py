from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.bots.models import Bot, BotChannel, BotConversation, BotMessage
from apps.businesses.models import Business, BusinessMember
from apps.accounts.models import User
from apps.integrations.models import IntegrationEventLog
from apps.integrations.providers import get_provider, send_message
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
        BusinessMember.objects.create(business=self.business, user=self.owner, role=BusinessMember.Roles.OWNER)
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
        self.assertTrue(
            IntegrationEventLog.objects.filter(
                business=self.business,
                provider="telegram",
                direction=IntegrationEventLog.Directions.INBOUND,
                status=IntegrationEventLog.Statuses.PROCESSED,
            ).exists()
        )

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
        self.assertTrue(
            IntegrationEventLog.objects.filter(
                business=self.business,
                provider="telegram",
                direction=IntegrationEventLog.Directions.OUTBOUND,
                status=IntegrationEventLog.Statuses.MOCKED,
            ).exists()
        )

    def test_mock_providers_are_registered_and_log_outbound_events(self):
        self.channel.channel = BotChannel.Channels.WHATSAPP
        result = send_message(self.channel, recipient_id="client-1", text="Hello mock")

        self.assertTrue(result["ok"])
        self.assertTrue(result["mock"])
        self.assertEqual(get_provider("instagram").provider, "instagram")
        self.assertTrue(IntegrationEventLog.objects.filter(provider="whatsapp", status=IntegrationEventLog.Statuses.MOCKED).exists())

    @override_settings(TELEGRAM_ENABLED=False)
    def test_merchant_can_configure_telegram_and_set_mock_webhook(self):
        self.api.force_authenticate(self.owner)

        config_response = self.api.post(
            f"/api/bot-channels/{self.channel.id}/telegram-config/",
            {"bot_token": "123456:secret-token", "webhook_secret": "merchant-secret"},
            format="json",
        )
        status_response = self.api.get(f"/api/bot-channels/{self.channel.id}/telegram-status/")
        webhook_response = self.api.post(
            f"/api/bot-channels/{self.channel.id}/set-telegram-webhook/",
            {"webhook_url": "https://api.zani.kz/api/integrations/telegram/webhook/"},
            format="json",
        )

        self.assertEqual(config_response.status_code, 200)
        self.assertTrue(config_response.data["token_configured"])
        self.assertEqual(status_response.status_code, 200)
        self.assertTrue(status_response.data["webhook_secret_configured"])
        self.assertEqual(webhook_response.status_code, 200)
        self.assertTrue(webhook_response.data["mock"])
        log = IntegrationEventLog.objects.filter(provider="telegram", status=IntegrationEventLog.Statuses.MOCKED).latest("created_at")
        self.assertNotIn("secret-token", str(log.payload_json))

    @override_settings(TELEGRAM_ENABLED=False)
    def test_inbox_outbound_telegram_reply_uses_provider_layer(self):
        conversation = BotConversation.objects.create(
            business=self.business,
            bot=self.bot,
            channel=BotConversation.Channels.TELEGRAM,
            external_user_id="777",
        )
        self.api.force_authenticate(self.owner)

        response = self.api.post(
            f"/api/inbox/conversations/{conversation.id}/messages/",
            {"text": "Здравствуйте", "sender_type": "manager"},
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["status"], BotMessage.Statuses.QUEUED)
        self.assertTrue(
            IntegrationEventLog.objects.filter(
                business=self.business,
                provider="telegram",
                direction=IntegrationEventLog.Directions.OUTBOUND,
                status=IntegrationEventLog.Statuses.MOCKED,
            ).exists()
        )
