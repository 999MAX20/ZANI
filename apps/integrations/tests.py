import json
import hashlib
import hmac
from unittest.mock import patch

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.bots.models import Bot, BotChannel, BotConversation, BotMessage
from apps.businesses.models import Business, BusinessMember
from apps.accounts.models import User
from apps.integrations.models import BusinessConnector, IntegrationEventLog
from apps.integrations.providers import get_provider, send_message
from apps.integrations.telegram import send_telegram_message, set_telegram_webhook
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
        self.assertEqual(message.external_message_id, "5")
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
    def test_telegram_webhook_is_idempotent_for_repeated_message(self):
        payload = {
            "update_id": 1000,
            "message": {
                "message_id": 5,
                "from": {"id": 42, "username": "client"},
                "chat": {"id": 777},
                "text": "Здравствуйте",
            },
        }

        first_response = self.api.post(
            "/api/integrations/telegram/webhook/",
            payload,
            format="json",
            HTTP_X_TELEGRAM_BOT_API_SECRET_TOKEN="telegram-secret",
        )
        second_response = self.api.post(
            "/api/integrations/telegram/webhook/",
            payload,
            format="json",
            HTTP_X_TELEGRAM_BOT_API_SECRET_TOKEN="telegram-secret",
        )

        self.assertEqual(first_response.status_code, 200)
        self.assertEqual(second_response.status_code, 200)
        self.assertEqual(BotConversation.objects.count(), 1)
        self.assertEqual(BotMessage.objects.count(), 1)
        self.assertTrue(IntegrationEventLog.objects.filter(provider="telegram", payload_json__duplicate=True).exists())

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

    @override_settings(TELEGRAM_WEBHOOK_SECRET="platform-secret")
    def test_telegram_webhook_accepts_merchant_channel_secret(self):
        response = self.api.post(
            "/api/integrations/telegram/webhook/",
            {
                "update_id": 1001,
                "message": {
                    "message_id": 6,
                    "from": {"id": 43, "username": "merchant_client"},
                    "chat": {"id": 778},
                    "text": "Сообщение в бот мерчанта",
                },
            },
            format="json",
            HTTP_X_TELEGRAM_BOT_API_SECRET_TOKEN="telegram-secret",
        )

        self.assertEqual(response.status_code, 200)
        conversation = BotConversation.objects.get()
        self.assertEqual(conversation.bot, self.bot)
        self.assertEqual(conversation.external_user_id, "778")

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
        status_response_after_webhook = self.api.get(f"/api/bot-channels/{self.channel.id}/telegram-status/")
        self.assertTrue(status_response_after_webhook.data["webhook_configured"])
        self.assertEqual(status_response_after_webhook.data["last_outbound_status"], IntegrationEventLog.Statuses.MOCKED)
        log = IntegrationEventLog.objects.filter(provider="telegram", status=IntegrationEventLog.Statuses.MOCKED).latest("created_at")
        self.assertNotIn("secret-token", str(log.payload_json))
        connector = BusinessConnector.objects.get(
            business=self.business,
            provider=BusinessConnector.Providers.TELEGRAM,
            name="Telegram",
        )
        self.assertEqual(connector.status, BusinessConnector.Statuses.CONNECTED)
        self.assertTrue(connector.config_json["token_configured"])
        self.assertTrue(connector.config_json["webhook_secret_configured"])
        self.assertEqual(connector.config_json["bot_channel_id"], self.channel.id)
        self.assertNotIn("secret-token", str(connector.config_json))
        self.assertNotIn("merchant-secret", str(connector.config_json))

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
        connector = BusinessConnector.objects.get(
            business=self.business,
            provider=BusinessConnector.Providers.TELEGRAM,
            name="Telegram",
        )
        self.assertEqual(connector.status, BusinessConnector.Statuses.CONNECTED)
        self.assertEqual(connector.last_error, "")
        self.assertIsNotNone(connector.connected_at)
        self.assertNotIn("merchant-token", str(connector.config_json))

    @override_settings(TELEGRAM_ENABLED=False)
    def test_telegram_connector_health_uses_bot_channel_token_config(self):
        self.api.force_authenticate(self.owner)
        self.api.post(f"/api/bot-channels/{self.channel.id}/telegram-test-connection/")
        connector = BusinessConnector.objects.get(
            business=self.business,
            provider=BusinessConnector.Providers.TELEGRAM,
            name="Telegram",
        )

        response = self.api.post(f"/api/business-connectors/{connector.id}/health-check/")

        self.assertEqual(response.status_code, 200)
        connector.refresh_from_db()
        self.assertEqual(response.data["status"], "succeeded")
        self.assertEqual(connector.status, BusinessConnector.Statuses.CONNECTED)
        self.assertEqual(connector.last_error, "")

    @override_settings(TELEGRAM_ENABLED=True, TELEGRAM_BASE_API_URL="https://api.telegram.test")
    def test_set_telegram_webhook_sends_channel_secret_token(self):
        captured = {}

        class FakeResponse:
            def __enter__(self):
                return self

            def __exit__(self, exc_type, exc, traceback):
                return False

            def read(self):
                return json.dumps({"ok": True, "result": True}).encode("utf-8")

        def fake_urlopen(request, timeout):
            captured["url"] = request.full_url
            captured["payload"] = json.loads(request.data.decode("utf-8"))
            captured["timeout"] = timeout
            return FakeResponse()

        with patch("apps.integrations.providers.telegram.urllib_request.urlopen", side_effect=fake_urlopen):
            result = set_telegram_webhook(self.channel, "https://api.zani.kz/api/integrations/telegram/webhook/")

        self.assertTrue(result["ok"])
        self.assertEqual(captured["url"], "https://api.telegram.test/botmerchant-token/setWebhook")
        self.assertEqual(captured["payload"]["url"], "https://api.zani.kz/api/integrations/telegram/webhook/")
        self.assertEqual(captured["payload"]["secret_token"], "telegram-secret")
        log = IntegrationEventLog.objects.filter(provider="telegram", status=IntegrationEventLog.Statuses.SENT).latest("created_at")
        self.assertTrue(log.payload_json["webhook_secret_configured"])
        self.assertNotIn("telegram-secret", str(log.payload_json))

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

    @override_settings(WHATSAPP_VERIFY_TOKEN="verify-token")
    def test_whatsapp_webhook_get_verification_returns_challenge(self):
        response = self.api.get(
            "/api/integrations/whatsapp/webhook/?hub.mode=subscribe&hub.verify_token=verify-token&hub.challenge=challenge-123"
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content.decode("utf-8"), "challenge-123")

    @override_settings(WHATSAPP_APP_SECRET="app-secret")
    def test_meta_whatsapp_webhook_routes_by_phone_number_id_and_signature(self):
        self.channel.config_json = {
            "provider_mode": "meta_cloud",
            "phone_number_id": "phone-123",
            "access_token": "meta-token",
        }
        self.channel.external_id = "phone-123"
        self.channel.save(update_fields=["config_json", "external_id", "updated_at"])
        payload = {
            "object": "whatsapp_business_account",
            "entry": [
                {
                    "changes": [
                        {
                            "value": {
                                "metadata": {"phone_number_id": "phone-123", "display_phone_number": "77015550101"},
                                "contacts": [{"profile": {"name": "Meta Client"}, "wa_id": "77015550102"}],
                                "messages": [
                                    {
                                        "from": "77015550102",
                                        "id": "wamid.1",
                                        "timestamp": "1710000000",
                                        "type": "text",
                                        "text": {"body": "Meta Cloud hello"},
                                    }
                                ],
                            }
                        }
                    ]
                }
            ],
        }
        raw_payload = json.dumps(payload).encode("utf-8")
        signature = "sha256=" + hmac.new(b"app-secret", raw_payload, hashlib.sha256).hexdigest()

        response = self.api.generic(
            "POST",
            "/api/integrations/whatsapp/webhook/",
            raw_payload,
            content_type="application/json",
            HTTP_X_HUB_SIGNATURE_256=signature,
        )

        self.assertEqual(response.status_code, 200)
        conversation = BotConversation.objects.get(channel=BotConversation.Channels.WHATSAPP)
        message = BotMessage.objects.get(conversation=conversation)
        self.assertEqual(conversation.external_user_id, "77015550102")
        self.assertEqual(message.text, "Meta Cloud hello")
        self.assertEqual(message.external_message_id, "wamid.1")
        self.assertEqual(message.payload_json["whatsapp_phone_number_id"], "phone-123")

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

    @override_settings(WHATSAPP_ENABLED=False)
    def test_merchant_can_configure_meta_cloud_credentials_and_test_mock(self):
        self.api.force_authenticate(self.owner)

        config_response = self.api.post(
            f"/api/bot-channels/{self.channel.id}/whatsapp-config/",
            {
                "provider_mode": "meta_cloud",
                "phone_number_id": "phone-123",
                "access_token": "meta-access-token",
                "business_account_id": "waba-123",
                "display_phone_number": "+77015550101",
            },
            format="json",
        )
        test_response = self.api.post(f"/api/bot-channels/{self.channel.id}/whatsapp-test-connection/")

        self.assertEqual(config_response.status_code, 200)
        self.assertEqual(config_response.data["provider_mode"], "meta_cloud")
        self.assertTrue(config_response.data["phone_number_id_configured"])
        self.assertTrue(config_response.data["access_token_configured"])
        self.assertEqual(test_response.status_code, 200)
        self.assertTrue(test_response.data["ok"])
        self.assertTrue(test_response.data["mock"])
        channel_response = self.api.get(f"/api/bot-channels/{self.channel.id}/")
        self.assertEqual(channel_response.data["config_json"]["access_token"], "configured")
        self.assertNotIn("meta-access-token", str(channel_response.data))
        connector = BusinessConnector.objects.get(business=self.business, provider=BusinessConnector.Providers.WHATSAPP, name="WhatsApp")
        self.assertEqual(connector.status, BusinessConnector.Statuses.CONNECTED)
        self.assertTrue(connector.config_json["access_token_configured"])
        self.assertNotIn("meta-access-token", str(connector.config_json))

    @override_settings(META_APP_ID="app-id", META_APP_SECRET="app-secret", WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID="config-id")
    def test_whatsapp_embedded_signup_start_returns_authorization_url(self):
        self.api.force_authenticate(self.owner)

        response = self.api.post(
            "/api/business-connectors/whatsapp-embedded-signup/start/",
            {"business": self.business.id, "redirect_uri": "https://app.zani.kz/dashboard/integrations"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn("facebook.com/dialog/oauth", response.data["authorization_url"])
        self.assertIn("state=", response.data["authorization_url"])
        self.assertTrue(response.data["app_configured"])
        self.assertTrue(response.data["config_id_configured"])

    @override_settings(META_APP_ID="app-id", META_APP_SECRET="app-secret")
    def test_whatsapp_embedded_signup_complete_saves_channel_and_connector(self):
        self.api.force_authenticate(self.owner)
        start_response = self.api.post(
            "/api/business-connectors/whatsapp-embedded-signup/start/",
            {"business": self.business.id, "redirect_uri": "https://app.zani.kz/dashboard/integrations"},
            format="json",
        )

        with patch(
            "apps.integrations.whatsapp.embedded_signup.exchange_code_for_access_token",
            return_value={"access_token": "embedded-access-token"},
        ):
            complete_response = self.api.post(
                "/api/business-connectors/whatsapp-embedded-signup/complete/",
                {
                    "business": self.business.id,
                    "code": "embedded-code",
                    "state": start_response.data["state"],
                    "redirect_uri": "https://app.zani.kz/dashboard/integrations",
                    "phone_number_id": "phone-embedded",
                    "waba_id": "waba-embedded",
                    "display_phone_number": "+77015550101",
                },
                format="json",
            )

        self.assertEqual(complete_response.status_code, 200)
        channel = BotChannel.objects.get(channel=BotChannel.Channels.WHATSAPP, external_id="phone-embedded")
        self.assertEqual(channel.config_json["provider_mode"], "meta_cloud")
        self.assertEqual(channel.config_json["access_token"], "embedded-access-token")
        connector = BusinessConnector.objects.get(business=self.business, provider=BusinessConnector.Providers.WHATSAPP, name="WhatsApp")
        self.assertEqual(connector.status, BusinessConnector.Statuses.CONNECTED)
        self.assertTrue(connector.config_json["embedded_signup"])
        self.assertNotIn("embedded-access-token", str(connector.config_json))

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
