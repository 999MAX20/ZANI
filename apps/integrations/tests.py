from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.bots.models import Bot, BotChannel, BotConversation, BotMessage
from apps.businesses.models import Business, BusinessMember
from apps.accounts.models import User
from apps.integrations.models import IntegrationEventLog
from apps.integrations.providers import get_provider, send_message
from apps.integrations.telegram import send_telegram_message
from apps.integrations.whatsapp import send_whatsapp_message


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
        channel_response = self.api.get(f"/api/bot-channels/{self.channel.id}/")
        self.assertEqual(channel_response.status_code, 200)
        self.assertEqual(channel_response.data["config_json"]["bot_token"], "configured")
        self.assertEqual(channel_response.data["config_json"]["webhook_secret"], "configured")
        self.assertNotIn("secret-token", str(channel_response.data))
        self.assertEqual(status_response.status_code, 200)
        self.assertTrue(status_response.data["webhook_secret_configured"])
        self.assertEqual(webhook_response.status_code, 200)
        self.assertTrue(webhook_response.data["mock"])
        log = IntegrationEventLog.objects.filter(provider="telegram", status=IntegrationEventLog.Statuses.MOCKED).latest("created_at")
        self.assertNotIn("secret-token", str(log.payload_json))

    @override_settings(TELEGRAM_ENABLED=False)
    def test_telegram_test_connection_uses_controlled_mock_without_leaking_token(self):
        self.api.force_authenticate(self.owner)

        response = self.api.post(f"/api/bot-channels/{self.channel.id}/telegram-test-connection/")

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["ok"])
        self.assertTrue(response.data["mock"])
        self.assertTrue(response.data["token_configured"])
        self.assertNotIn("merchant-token", str(response.data))
        self.channel.refresh_from_db()
        self.assertEqual(self.channel.status, BotChannel.Statuses.ACTIVE)

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


class WhatsAppIntegrationFoundationTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.owner = User.objects.create_user(
            username="whatsapp-owner",
            email="whatsapp-owner@example.com",
            password="pass",
            role=User.Roles.BUSINESS_OWNER,
        )
        self.other_owner = User.objects.create_user(
            username="whatsapp-other",
            email="whatsapp-other@example.com",
            password="pass",
            role=User.Roles.BUSINESS_OWNER,
        )
        self.business = Business.objects.create(owner=self.owner, name="WhatsApp Clinic", slug="whatsapp-clinic")
        self.other_business = Business.objects.create(owner=self.other_owner, name="Other WhatsApp Clinic", slug="other-whatsapp-clinic")
        BusinessMember.objects.create(business=self.business, user=self.owner, role=BusinessMember.Roles.OWNER)
        BusinessMember.objects.create(business=self.other_business, user=self.other_owner, role=BusinessMember.Roles.OWNER)
        self.bot = Bot.objects.create(business=self.business, name="WhatsApp bot", status=Bot.Statuses.ACTIVE)
        self.channel = BotChannel.objects.create(
            bot=self.bot,
            channel=BotChannel.Channels.WHATSAPP,
            status=BotChannel.Statuses.ACTIVE,
            config_json={"webhook_secret": "whatsapp-secret", "provider_mode": "mock", "phone_number_id": "dev-phone"},
        )

    def test_whatsapp_webhook_saves_inbound_message(self):
        response = self.api.post(
            "/api/integrations/whatsapp/webhook/",
            {
                "message_id": "wamid.1",
                "from": {"phone": "+77015550101", "name": "Client"},
                "text": "Хочу записаться через WhatsApp",
            },
            format="json",
            HTTP_X_ZANI_WHATSAPP_SECRET="whatsapp-secret",
        )

        self.assertEqual(response.status_code, 200)
        conversation = BotConversation.objects.get(channel=BotConversation.Channels.WHATSAPP)
        message = BotMessage.objects.get(conversation=conversation)
        self.assertEqual(conversation.external_user_id, "+77015550101")
        self.assertEqual(message.text, "Хочу записаться через WhatsApp")
        self.assertEqual(message.external_message_id, "wamid.1")
        self.assertTrue(
            IntegrationEventLog.objects.filter(
                business=self.business,
                provider="whatsapp",
                direction=IntegrationEventLog.Directions.INBOUND,
                status=IntegrationEventLog.Statuses.PROCESSED,
            ).exists()
        )

    def test_whatsapp_outbound_uses_provider_layer(self):
        result = send_whatsapp_message(self.channel, recipient_id="+77015550101", text="Здравствуйте")

        self.assertTrue(result["ok"])
        self.assertTrue(result["mock"])
        self.assertTrue(
            IntegrationEventLog.objects.filter(
                business=self.business,
                provider="whatsapp",
                direction=IntegrationEventLog.Directions.OUTBOUND,
                status=IntegrationEventLog.Statuses.MOCKED,
            ).exists()
        )

    def test_merchant_can_configure_whatsapp_and_check_status(self):
        self.api.force_authenticate(self.owner)

        config_response = self.api.post(
            f"/api/bot-channels/{self.channel.id}/whatsapp-config/",
            {"provider_mode": "mock", "webhook_secret": "new-secret", "phone_number_id": "phone-2"},
            format="json",
        )
        status_response = self.api.get(f"/api/bot-channels/{self.channel.id}/whatsapp-status/")

        self.assertEqual(config_response.status_code, 200)
        self.assertEqual(config_response.data["provider_mode"], "mock")
        self.assertTrue(config_response.data["webhook_secret_configured"])
        self.assertEqual(status_response.status_code, 200)
        self.assertIn("/api/integrations/whatsapp/webhook/", status_response.data["webhook_url"])

    def test_integration_logs_are_tenant_scoped(self):
        IntegrationEventLog.objects.create(
            business=self.business,
            provider="whatsapp",
            channel="whatsapp",
            direction=IntegrationEventLog.Directions.OUTBOUND,
            status=IntegrationEventLog.Statuses.MOCKED,
            payload_json={"visible": True},
        )
        IntegrationEventLog.objects.create(
            business=self.other_business,
            provider="whatsapp",
            channel="whatsapp",
            direction=IntegrationEventLog.Directions.OUTBOUND,
            status=IntegrationEventLog.Statuses.MOCKED,
            payload_json={"visible": False},
        )
        self.api.force_authenticate(self.owner)

        response = self.api.get("/api/integration-event-logs/?provider=whatsapp")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["results"]), 1)
        self.assertEqual(response.data["results"][0]["business"], self.business.id)
