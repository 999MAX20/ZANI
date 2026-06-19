import json
import hashlib
import hmac
from io import StringIO
from unittest.mock import patch

from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.bots.models import Bot, BotChannel, BotConversation, BotMessage
from apps.businesses.models import Business, BusinessMember
from apps.accounts.models import User
from apps.integrations.connectors import create_or_update_credential, decrypt_credential_value
from apps.integrations.models import BusinessConnector, ConnectorCredential, IntegrationEventLog
from apps.integrations.kaspi.base import fetch_kaspi_orders
from apps.integrations.instagram_oauth import fetch_meta_json as fetch_instagram_meta_json
from apps.integrations.moysklad.base import fetch_moysklad_json
from apps.integrations.ozon.base import fetch_ozon_json
from apps.integrations.providers import get_provider, send_message
from apps.integrations.providers.instagram import InstagramProvider
from apps.integrations.providers.whatsapp import WhatsAppProvider
from apps.integrations.instagram import send_instagram_message
from apps.integrations.telegram import send_telegram_message, set_telegram_webhook
from apps.integrations.whatsapp import send_whatsapp_message
from apps.integrations.whatsapp.embedded_signup import exchange_code_for_access_token as exchange_whatsapp_code_for_access_token
from apps.integrations.wildberries.base import fetch_wildberries_json


class MarketplaceLocalRealTestGuardrailTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            username="marketplace-owner",
            email="marketplace-owner@example.com",
            password="pass",
            role=User.Roles.BUSINESS_OWNER,
        )
        self.business = Business.objects.create(owner=self.owner, name="Marketplace Clinic", slug="marketplace-clinic")

    @override_settings(KASPI_ENABLED=True, KASPI_API_BASE_URL="https://127.0.0.1")
    def test_kaspi_local_real_test_rejects_private_api_base_url(self):
        output = StringIO()

        with self.assertRaises(CommandError):
            call_command("kaspi_local_real_test_check", "--fail-on-missing", stdout=output)

        self.assertIn("FAIL kaspi_api_base_url", output.getvalue())

    @override_settings(KASPI_ENABLED=True, KASPI_API_BASE_URL="https://kaspi.example.test")
    def test_kaspi_local_real_test_accepts_public_https_api_base_url(self):
        output = StringIO()

        call_command("kaspi_local_real_test_check", stdout=output)

        self.assertIn("PASS kaspi_api_base_url", output.getvalue())

    @override_settings(KASPI_API_BASE_URL="https://127.0.0.1")
    def test_kaspi_fetch_rejects_private_api_base_url_without_network_call(self):
        connector = BusinessConnector.objects.create(
            business=self.business,
            provider=BusinessConnector.Providers.KASPI,
            capability=BusinessConnector.Capabilities.FINANCE,
            name="Kaspi",
            auth_type=BusinessConnector.AuthTypes.TOKEN,
        )
        create_or_update_credential(connector, "api_token", "kaspi-token")

        with patch("apps.integrations.kaspi.base.urllib_request.urlopen") as urlopen:
            with self.assertRaisesMessage(ValueError, "KASPI_API_BASE_URL must be a public HTTPS URL."):
                fetch_kaspi_orders(connector, page_size=1)

        urlopen.assert_not_called()

    @override_settings(OZON_ENABLED=True, OZON_SELLER_API_BASE_URL="https://127.0.0.1")
    def test_ozon_local_real_test_rejects_private_api_base_url(self):
        output = StringIO()

        with self.assertRaises(CommandError):
            call_command("ozon_local_real_test_check", "--fail-on-missing", stdout=output)

        self.assertIn("FAIL ozon_seller_api_base_url", output.getvalue())

    @override_settings(OZON_ENABLED=True, OZON_SELLER_API_BASE_URL="https://api-seller.ozon.example.test")
    def test_ozon_local_real_test_accepts_public_https_api_base_url(self):
        output = StringIO()

        call_command("ozon_local_real_test_check", stdout=output)

        self.assertIn("PASS ozon_seller_api_base_url", output.getvalue())

    @override_settings(OZON_SELLER_API_BASE_URL="https://127.0.0.1")
    def test_ozon_fetch_rejects_private_api_base_url_without_network_call(self):
        with patch("apps.integrations.ozon.base.urllib_request.urlopen") as urlopen:
            with self.assertRaisesMessage(ValueError, "OZON_SELLER_API_BASE_URL must be a public HTTPS URL."):
                fetch_ozon_json("v1/warehouse/list", {"client_id": "client", "api_key": "key"}, {})

        urlopen.assert_not_called()

    @override_settings(WILDBERRIES_ENABLED=True, WILDBERRIES_STATISTICS_API_BASE_URL="https://127.0.0.1")
    def test_wildberries_local_real_test_rejects_private_api_base_url(self):
        output = StringIO()

        with self.assertRaises(CommandError):
            call_command("wildberries_local_real_test_check", "--fail-on-missing", stdout=output)

        self.assertIn("FAIL wildberries_statistics_api_base_url", output.getvalue())

    @override_settings(WILDBERRIES_ENABLED=True, WILDBERRIES_STATISTICS_API_BASE_URL="https://statistics-api.wildberries.example.test")
    def test_wildberries_local_real_test_accepts_public_https_api_base_url(self):
        output = StringIO()

        call_command("wildberries_local_real_test_check", stdout=output)

        self.assertIn("PASS wildberries_statistics_api_base_url", output.getvalue())

    @override_settings(WILDBERRIES_STATISTICS_API_BASE_URL="https://127.0.0.1")
    def test_wildberries_fetch_rejects_private_api_base_url_without_network_call(self):
        with patch("apps.integrations.wildberries.base.urllib_request.urlopen") as urlopen:
            with self.assertRaisesMessage(ValueError, "WILDBERRIES_STATISTICS_API_BASE_URL must be a public HTTPS URL."):
                fetch_wildberries_json("api/v1/supplier/orders", "token", {"dateFrom": "2026-05-30"})

        urlopen.assert_not_called()

    @override_settings(MOYSKLAD_ENABLED=True, MOYSKLAD_API_BASE_URL="https://127.0.0.1")
    def test_moysklad_local_real_test_rejects_private_api_base_url(self):
        output = StringIO()

        with self.assertRaises(CommandError):
            call_command("moysklad_local_real_test_check", "--fail-on-missing", stdout=output)

        self.assertIn("FAIL moysklad_api_base_url", output.getvalue())

    @override_settings(MOYSKLAD_ENABLED=True, MOYSKLAD_API_BASE_URL="https://api.moysklad.example.test")
    def test_moysklad_local_real_test_accepts_public_https_api_base_url(self):
        output = StringIO()

        call_command("moysklad_local_real_test_check", stdout=output)

        self.assertIn("PASS moysklad_api_base_url", output.getvalue())

    @override_settings(MOYSKLAD_API_BASE_URL="https://127.0.0.1")
    def test_moysklad_fetch_rejects_private_api_base_url_without_network_call(self):
        with patch("apps.integrations.moysklad.base.urllib_request.urlopen") as urlopen:
            with self.assertRaisesMessage(ValueError, "MOYSKLAD_API_BASE_URL must be a public HTTPS URL."):
                fetch_moysklad_json("entity/organization", "token", {"limit": "1"})

        urlopen.assert_not_called()


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
            config_json={"webhook_secret": "telegram-secret-A8v_qR7m-L2p_N9x-T5s_K3u-Y6b_C4d", "bot_token": "merchant-token"},
        )

    @override_settings(TELEGRAM_WEBHOOK_SECRET="telegram-secret-A8v_qR7m-L2p_N9x-T5s_K3u-Y6b_C4d")
    def test_telegram_webhook_saves_inbound_message(self):
        response = self.api.post(
            "/api/integrations/telegram/webhook/",
            {
                "update_id": 1000,
                "api_key": "raw-api-key",
                "message": {
                    "message_id": 5,
                    "from": {"id": 42, "username": "client"},
                    "chat": {"id": 777},
                    "text": "Здравствуйте",
                    "nested": {"access_token": "raw-access-token"},
                },
            },
            format="json",
            HTTP_X_TELEGRAM_BOT_API_SECRET_TOKEN="telegram-secret-A8v_qR7m-L2p_N9x-T5s_K3u-Y6b_C4d",
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
        self.assertEqual(message.payload_json["telegram_update"]["api_key"], "configured")
        self.assertEqual(message.payload_json["telegram_update"]["message"]["nested"]["access_token"], "configured")
        self.assertNotIn("raw-api-key", str(message.payload_json))
        self.assertNotIn("raw-access-token", str(message.payload_json))
        self.assertTrue(
            IntegrationEventLog.objects.filter(
                business=self.business,
                provider="telegram",
                direction=IntegrationEventLog.Directions.INBOUND,
                status=IntegrationEventLog.Statuses.PROCESSED,
            ).exists()
        )

    @override_settings(TELEGRAM_WEBHOOK_SECRET="telegram-secret-A8v_qR7m-L2p_N9x-T5s_K3u-Y6b_C4d")
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
            HTTP_X_TELEGRAM_BOT_API_SECRET_TOKEN="telegram-secret-A8v_qR7m-L2p_N9x-T5s_K3u-Y6b_C4d",
        )
        second_response = self.api.post(
            "/api/integrations/telegram/webhook/",
            payload,
            format="json",
            HTTP_X_TELEGRAM_BOT_API_SECRET_TOKEN="telegram-secret-A8v_qR7m-L2p_N9x-T5s_K3u-Y6b_C4d",
        )

        self.assertEqual(first_response.status_code, 200)
        self.assertEqual(second_response.status_code, 200)
        self.assertEqual(BotConversation.objects.count(), 1)
        self.assertEqual(BotMessage.objects.count(), 1)
        self.assertTrue(IntegrationEventLog.objects.filter(provider="telegram", payload_json__duplicate=True).exists())

    def test_telegram_webhook_smoke_command_posts_local_payload(self):
        output = StringIO()

        call_command("telegram_webhook_smoke", "--channel-id", str(self.channel.id), "--fail-on-error", stdout=output)

        self.assertIn("Telegram webhook smoke: True", output.getvalue())
        self.assertEqual(BotConversation.objects.count(), 1)
        self.assertEqual(BotMessage.objects.count(), 1)

    @override_settings(TELEGRAM_ENABLED=True, TELEGRAM_BASE_API_URL="https://api.telegram.test")
    def test_telegram_local_real_test_rejects_private_public_url(self):
        output = StringIO()

        with patch("apps.integrations.providers.telegram.TelegramProvider.validate_token", return_value={"ok": True, "bot": {"username": "zani_test_bot"}}):
            with self.assertRaises(CommandError):
                call_command(
                    "telegram_local_real_test_check",
                    "--channel-id",
                    str(self.channel.id),
                    "--public-url",
                    "https://127.0.0.1",
                    "--fail-on-missing",
                    stdout=output,
                )

        self.assertIn("FAIL: public_url_https", output.getvalue())

    @override_settings(TELEGRAM_ENABLED=True, TELEGRAM_BASE_API_URL="https://api.telegram.test")
    def test_telegram_local_real_test_accepts_public_https_url(self):
        output = StringIO()

        with patch("apps.integrations.providers.telegram.TelegramProvider.validate_token", return_value={"ok": True, "bot": {"username": "zani_test_bot"}}):
            call_command(
                "telegram_local_real_test_check",
                "--channel-id",
                str(self.channel.id),
                "--public-url",
                "https://api.zani.kz",
                "--fail-on-missing",
                stdout=output,
            )

        self.assertIn("PASS: public_url_https", output.getvalue())

    @override_settings(TELEGRAM_ENABLED=True, TELEGRAM_BASE_API_URL="https://api.telegram.test")
    def test_telegram_local_real_test_rejects_and_redacts_public_url_query(self):
        output = StringIO()

        with patch("apps.integrations.providers.telegram.TelegramProvider.validate_token", return_value={"ok": True, "bot": {"username": "zani_test_bot"}}):
            with self.assertRaises(CommandError):
                call_command(
                    "telegram_local_real_test_check",
                    "--channel-id",
                    str(self.channel.id),
                    "--public-url",
                    "https://api.zani.kz?token=raw-secret-token",
                    "--fail-on-missing",
                    stdout=output,
                )

        text = output.getvalue()
        self.assertIn("FAIL: public_url_https", text)
        self.assertIn("Webhook URL: https://api.zani.kz/api/integrations/telegram/webhook/", text)
        self.assertNotIn("raw-secret-token", text)

    @override_settings(TELEGRAM_WEBHOOK_SECRET="telegram-secret-A8v_qR7m-L2p_N9x-T5s_K3u-Y6b_C4d")
    def test_telegram_webhook_rejects_wrong_secret(self):
        response = self.api.post(
            "/api/integrations/telegram/webhook/",
            {"message": {"chat": {"id": 777}, "text": "Hidden"}},
            format="json",
            HTTP_X_TELEGRAM_BOT_API_SECRET_TOKEN="wrong-secret",
        )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(BotMessage.objects.count(), 0)

    @override_settings(TELEGRAM_WEBHOOK_SECRET="secret")
    def test_telegram_webhook_rejects_weak_global_secret(self):
        response = self.api.post(
            "/api/integrations/telegram/webhook/",
            {"message": {"chat": {"id": 777}, "text": "Hidden"}},
            format="json",
            HTTP_X_TELEGRAM_BOT_API_SECRET_TOKEN="secret",
        )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(BotMessage.objects.count(), 0)

    @override_settings(TELEGRAM_WEBHOOK_SECRET="")
    def test_telegram_webhook_rejects_missing_secret_without_single_channel_fallback(self):
        response = self.api.post(
            "/api/integrations/telegram/webhook/",
            {"message": {"chat": {"id": 777}, "text": "Hidden"}},
            format="json",
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
            HTTP_X_TELEGRAM_BOT_API_SECRET_TOKEN="telegram-secret-A8v_qR7m-L2p_N9x-T5s_K3u-Y6b_C4d",
        )

        self.assertEqual(response.status_code, 200)
        conversation = BotConversation.objects.get()
        self.assertEqual(conversation.bot, self.bot)
        self.assertEqual(conversation.external_user_id, "778")

    @override_settings(TELEGRAM_ENABLED=False)
    def test_outbound_send_fails_closed_when_disabled(self):
        result = send_telegram_message(self.channel, chat_id="777", text="Hello")

        self.assertFalse(result["ok"])
        self.assertEqual(result["reason"], "Telegram integration is disabled.")
        self.assertTrue(
            IntegrationEventLog.objects.filter(
                business=self.business,
                provider="telegram",
                direction=IntegrationEventLog.Directions.OUTBOUND,
                status=IntegrationEventLog.Statuses.FAILED,
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
    def test_merchant_can_configure_telegram_but_disabled_provider_does_not_connect_webhook(self):
        self.api.force_authenticate(self.owner)

        config_response = self.api.post(
            f"/api/bot-channels/{self.channel.id}/telegram-config/",
            {"bot_token": "123456:secret-token", "webhook_secret": "merchant-secret-P9k_L4m-Q8r_T2v-W6x_Y3z-A7b_C5d"},
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
        self.assertFalse(webhook_response.data["ok"])
        status_response_after_webhook = self.api.get(f"/api/bot-channels/{self.channel.id}/telegram-status/")
        self.assertFalse(status_response_after_webhook.data["webhook_configured"])
        self.assertEqual(status_response_after_webhook.data["last_outbound_status"], IntegrationEventLog.Statuses.FAILED)
        log = IntegrationEventLog.objects.filter(provider="telegram", status=IntegrationEventLog.Statuses.FAILED).latest("created_at")
        self.assertNotIn("secret-token", str(log.payload_json))
        connector = BusinessConnector.objects.get(
            business=self.business,
            provider=BusinessConnector.Providers.TELEGRAM,
            name="Telegram",
        )
        self.assertEqual(connector.status, BusinessConnector.Statuses.FAILED)
        self.assertTrue(connector.config_json["token_configured"])
        self.assertTrue(connector.config_json["webhook_secret_configured"])
        self.assertEqual(connector.config_json["bot_channel_id"], self.channel.id)
        self.assertNotIn("secret-token", str(connector.config_json))
        self.assertNotIn("merchant-secret-P9k_L4m-Q8r_T2v-W6x_Y3z-A7b_C5d", str(connector.config_json))

    def test_merchant_cannot_configure_weak_telegram_webhook_secret(self):
        self.api.force_authenticate(self.owner)

        response = self.api.post(
            f"/api/bot-channels/{self.channel.id}/telegram-config/",
            {"bot_token": "123456:secret-token", "webhook_secret": "secret"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("webhook_secret", response.data)

    @override_settings(ALLOWED_HOSTS=["testserver"])
    def test_telegram_status_reports_public_and_backend_readiness(self):
        self.api.force_authenticate(self.owner)
        self.api.post(
            "/api/integrations/telegram/webhook/",
            {
                "update_id": 1001,
                "message": {
                    "message_id": 6,
                    "from": {"id": 42, "username": "client"},
                    "chat": {"id": 777},
                    "text": "Проверка статуса",
                },
            },
            format="json",
            HTTP_X_TELEGRAM_BOT_API_SECRET_TOKEN="telegram-secret-A8v_qR7m-L2p_N9x-T5s_K3u-Y6b_C4d",
        )

        response = self.api.get(f"/api/bot-channels/{self.channel.id}/telegram-status/")

        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data["webhook_public_ready"])
        self.assertTrue(response.data["inbound_backend_ready"])
        self.assertFalse(response.data["inbound_ready"])
        self.assertEqual(response.data["last_inbound_status"], IntegrationEventLog.Statuses.PROCESSED)

    @override_settings(TELEGRAM_ENABLED=False)
    def test_telegram_test_connection_fails_closed_without_leaking_token_when_disabled(self):
        self.api.force_authenticate(self.owner)

        response = self.api.post(f"/api/bot-channels/{self.channel.id}/telegram-test-connection/")

        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data["ok"])
        self.assertTrue(response.data["token_configured"])
        self.assertNotIn("merchant-token", str(response.data))
        self.channel.refresh_from_db()
        self.assertEqual(self.channel.status, BotChannel.Statuses.ERROR)
        connector = BusinessConnector.objects.get(
            business=self.business,
            provider=BusinessConnector.Providers.TELEGRAM,
            name="Telegram",
        )
        self.assertEqual(connector.status, BusinessConnector.Statuses.FAILED)
        self.assertEqual(connector.last_error, "Telegram integration is disabled.")
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
        self.assertEqual(response.data["status"], "failed")
        self.assertEqual(connector.status, BusinessConnector.Statuses.FAILED)
        self.assertEqual(connector.last_error, "Telegram integration is disabled.")

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
        self.assertEqual(captured["payload"]["secret_token"], "telegram-secret-A8v_qR7m-L2p_N9x-T5s_K3u-Y6b_C4d")
        log = IntegrationEventLog.objects.filter(provider="telegram", status=IntegrationEventLog.Statuses.SENT).latest("created_at")
        self.assertTrue(log.payload_json["webhook_secret_configured"])
        self.assertNotIn("telegram-secret-A8v_qR7m-L2p_N9x-T5s_K3u-Y6b_C4d", str(log.payload_json))

    @override_settings(TELEGRAM_ENABLED=True, TELEGRAM_BASE_API_URL="http://api.telegram.test")
    def test_telegram_provider_rejects_non_https_base_api_url(self):
        with patch("apps.integrations.providers.telegram.urllib_request.urlopen") as urlopen:
            result = set_telegram_webhook(self.channel, "https://api.zani.kz/api/integrations/telegram/webhook/")

        self.assertFalse(result["ok"])
        self.assertIn("HTTPS", result["reason"])
        urlopen.assert_not_called()
        log = IntegrationEventLog.objects.filter(provider="telegram", status=IntegrationEventLog.Statuses.FAILED).latest("created_at")
        self.assertNotIn("merchant-token", str(log.payload_json))

    @override_settings(TELEGRAM_ENABLED=True, TELEGRAM_BASE_API_URL="https://api.telegram.test")
    def test_telegram_provider_rejects_private_webhook_url(self):
        with patch("apps.integrations.providers.telegram.urllib_request.urlopen") as urlopen:
            result = set_telegram_webhook(self.channel, "https://127.0.0.1/api/integrations/telegram/webhook/")

        self.assertFalse(result["ok"])
        self.assertIn("public hostname", result["reason"])
        urlopen.assert_not_called()

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
        self.assertEqual(response.data["status"], BotMessage.Statuses.FAILED)
        self.assertTrue(
            IntegrationEventLog.objects.filter(
                business=self.business,
                provider="telegram",
                direction=IntegrationEventLog.Directions.OUTBOUND,
                status=IntegrationEventLog.Statuses.FAILED,
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

    @override_settings(WHATSAPP_WEBHOOK_SECRET="", WHATSAPP_APP_SECRET="")
    def test_whatsapp_webhook_rejects_missing_route_without_single_channel_fallback(self):
        response = self.api.post(
            "/api/integrations/whatsapp/webhook/",
            {
                "message_id": "wamid.hidden",
                "from": {"phone": "+77015550101", "name": "Client"},
                "text": "Hidden",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(BotMessage.objects.count(), 0)

    @override_settings(WHATSAPP_VERIFY_TOKEN="verify-token")
    def test_whatsapp_webhook_get_verification_returns_challenge(self):
        response = self.api.get(
            "/api/integrations/whatsapp/webhook/?hub.mode=subscribe&hub.verify_token=verify-token&hub.challenge=challenge-123"
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content.decode("utf-8"), "challenge-123")

    @override_settings(
        WHATSAPP_ENABLED=True,
        WHATSAPP_VERIFY_TOKEN="strong-whatsapp-verify-token-32-chars-2026",
        WHATSAPP_APP_SECRET="strong-whatsapp-app-secret-32-chars-2026",
        META_APP_ID="meta-app",
        META_APP_SECRET="meta-secret",
        WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID="signup-config",
    )
    def test_whatsapp_local_real_test_rejects_private_public_url(self):
        output = StringIO()

        with self.assertRaises(CommandError):
            call_command(
                "whatsapp_local_real_test_check",
                "--public-url",
                "https://127.0.0.1",
                "--fail-on-missing",
                stdout=output,
            )

        self.assertIn("FAIL public_https_url", output.getvalue())

    @override_settings(
        WHATSAPP_ENABLED=True,
        WHATSAPP_VERIFY_TOKEN="strong-whatsapp-verify-token-32-chars-2026",
        WHATSAPP_APP_SECRET="strong-whatsapp-app-secret-32-chars-2026",
        META_APP_ID="meta-app",
        META_APP_SECRET="meta-secret",
        WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID="signup-config",
    )
    def test_whatsapp_local_real_test_accepts_public_https_url(self):
        output = StringIO()

        call_command(
            "whatsapp_local_real_test_check",
            "--public-url",
            "https://api.zani.kz",
            "--fail-on-missing",
            stdout=output,
        )

        self.assertIn("PASS public_https_url", output.getvalue())

    @override_settings(
        WHATSAPP_ENABLED=True,
        WHATSAPP_VERIFY_TOKEN="strong-whatsapp-verify-token-32-chars-2026",
        WHATSAPP_APP_SECRET="strong-whatsapp-app-secret-32-chars-2026",
        META_APP_ID="meta-app",
        META_APP_SECRET="meta-secret",
        WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID="signup-config",
    )
    def test_whatsapp_local_real_test_rejects_and_redacts_public_url_query(self):
        output = StringIO()

        with self.assertRaises(CommandError):
            call_command(
                "whatsapp_local_real_test_check",
                "--public-url",
                "https://api.zani.kz?token=raw-secret-token",
                "--fail-on-missing",
                stdout=output,
            )

        text = output.getvalue()
        self.assertIn("FAIL public_https_url", text)
        self.assertIn("Webhook callback URL: https://api.zani.kz/api/integrations/whatsapp/webhook/", text)
        self.assertNotIn("raw-secret-token", text)

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
            "api_key": "raw-api-key",
            "entry": [
                {
                    "changes": [
                        {
	                            "value": {
	                                "metadata": {"phone_number_id": "phone-123", "display_phone_number": "77015550101"},
	                                "contacts": [{"profile": {"name": "Meta Client"}, "wa_id": "77015550102"}],
	                                "metadata_secret": {"access_token": "raw-access-token"},
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
        self.assertEqual(message.payload_json["whatsapp_payload"]["api_key"], "configured")
        self.assertEqual(message.payload_json["whatsapp_payload"]["entry"][0]["changes"][0]["value"]["metadata_secret"], "configured")
        self.assertNotIn("raw-api-key", str(message.payload_json))
        self.assertNotIn("raw-access-token", str(message.payload_json))

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
            {"provider_mode": "mock", "webhook_secret": "strong-whatsapp-secret-32-chars-2026", "phone_number_id": "phone-2"},
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
        self.assertNotIn("access_token", channel_response.data["config_json"])
        self.assertTrue(channel_response.data["config_json"]["access_token_configured"])
        self.assertNotIn("meta-access-token", str(channel_response.data))
        connector = BusinessConnector.objects.get(business=self.business, provider=BusinessConnector.Providers.WHATSAPP, name="WhatsApp")
        self.assertEqual(connector.status, BusinessConnector.Statuses.CONNECTED)
        self.assertTrue(connector.config_json["access_token_configured"])
        self.assertNotIn("meta-access-token", str(connector.config_json))
        credential = ConnectorCredential.objects.get(connector=connector, key="access_token")
        self.assertEqual(decrypt_credential_value(credential.encrypted_value), "meta-access-token")

    def test_whatsapp_status_webhook_updates_outbound_message(self):
        self.channel.config_json = {
            "provider_mode": "meta_cloud",
            "phone_number_id": "phone-123",
        }
        self.channel.external_id = "phone-123"
        self.channel.save(update_fields=["config_json", "external_id", "updated_at"])
        conversation = BotConversation.objects.create(
            business=self.business,
            bot=self.bot,
            channel=BotConversation.Channels.WHATSAPP,
            external_user_id="77015550102",
        )
        message = BotMessage.objects.create(
            conversation=conversation,
            direction=BotMessage.Directions.OUTBOUND,
            sender_type=BotMessage.SenderTypes.MANAGER,
            text="Здравствуйте",
            external_message_id="wamid.outbound.1",
            status=BotMessage.Statuses.SENT,
        )

        response = self.api.post(
            "/api/integrations/whatsapp/webhook/",
            {
                "entry": [
                    {
                        "changes": [
                            {
                                "value": {
                                    "metadata": {"phone_number_id": "phone-123"},
                                    "statuses": [{"id": "wamid.outbound.1", "status": "read", "timestamp": "1710000000"}],
                                }
                            }
                        ]
                    }
                ]
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        message.refresh_from_db()
        self.assertIsNotNone(message.delivered_at)
        self.assertIsNotNone(message.read_at)
        self.assertEqual(message.payload_json["whatsapp_status"]["status"], "read")

    @override_settings(WHATSAPP_ENABLED=True, WHATSAPP_GRAPH_BASE_URL="https://graph.facebook.com")
    def test_whatsapp_free_form_outbound_requires_recent_inbound_message(self):
        self.channel.config_json = {
            "provider_mode": "meta_cloud",
            "phone_number_id": "phone-123",
        }
        self.channel.external_id = "phone-123"
        self.channel.save(update_fields=["config_json", "external_id", "updated_at"])
        connector = BusinessConnector.objects.create(
            business=self.business,
            provider=BusinessConnector.Providers.WHATSAPP,
            name="WhatsApp",
            capability=BusinessConnector.Capabilities.COMMUNICATIONS,
            auth_type=BusinessConnector.AuthTypes.OAUTH,
        )
        create_or_update_credential(connector, "access_token", "meta-token")

        result = WhatsAppProvider().send_message(self.channel, "77015550102", "Здравствуйте")

        self.assertFalse(result["ok"])
        self.assertTrue(result["requires_template"])

    @override_settings(WHATSAPP_ENABLED=True, WHATSAPP_GRAPH_BASE_URL="https://graph.facebook.com")
    def test_whatsapp_template_outbound_bypasses_service_window_and_returns_provider_id(self):
        self.channel.config_json = {
            "provider_mode": "meta_cloud",
            "phone_number_id": "phone-123",
        }
        self.channel.external_id = "phone-123"
        self.channel.save(update_fields=["config_json", "external_id", "updated_at"])
        connector = BusinessConnector.objects.create(
            business=self.business,
            provider=BusinessConnector.Providers.WHATSAPP,
            name="WhatsApp",
            capability=BusinessConnector.Capabilities.COMMUNICATIONS,
            auth_type=BusinessConnector.AuthTypes.OAUTH,
        )
        create_or_update_credential(connector, "access_token", "meta-token")

        class FakeResponse:
            def __enter__(self):
                return self

            def __exit__(self, *args):
                return False

            def read(self):
                return json.dumps({"messages": [{"id": "wamid.provider.1"}]}).encode("utf-8")

        with patch("apps.integrations.providers.whatsapp.urllib_request.urlopen", return_value=FakeResponse()):
            result = WhatsAppProvider().send_message(
                self.channel,
                "77015550102",
                "Template text",
                payload={"whatsapp_template_name": "appointment_recall_ru", "whatsapp_template_language": "ru"},
            )

        self.assertTrue(result["ok"])
        self.assertEqual(result["provider_message_id"], "wamid.provider.1")

    @override_settings(WHATSAPP_ENABLED=True, WHATSAPP_GRAPH_BASE_URL="https://127.0.0.1")
    def test_whatsapp_provider_rejects_private_graph_base_url_without_network_call(self):
        self.channel.config_json = {
            "provider_mode": "meta_cloud",
            "phone_number_id": "phone-123",
            "access_token": "meta-token",
        }
        self.channel.external_id = "phone-123"
        self.channel.save(update_fields=["config_json", "external_id", "updated_at"])

        with patch("apps.integrations.providers.whatsapp.urllib_request.urlopen") as urlopen:
            result = WhatsAppProvider().validate_credentials(self.channel)

        self.assertFalse(result["ok"])
        self.assertIn("WHATSAPP_GRAPH_BASE_URL must be a public HTTPS URL.", result["reason"])
        urlopen.assert_not_called()
        log = IntegrationEventLog.objects.filter(provider="whatsapp", status=IntegrationEventLog.Statuses.FAILED).latest("created_at")
        self.assertNotIn("meta-token", str(log.payload_json))

    @override_settings(
        META_APP_ID="app-id",
        META_APP_SECRET="app-secret",
        WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID="config-id",
        CORS_ALLOWED_ORIGINS=["https://app.zani.kz"],
        CSRF_TRUSTED_ORIGINS=["https://app.zani.kz"],
    )
    def test_whatsapp_embedded_signup_start_returns_authorization_url(self):
        self.api.force_authenticate(self.owner)

        response = self.api.post(
            "/api/business-connectors/whatsapp-embedded-signup/start/",
            {"business": self.business.id, "redirect_uri": "https://app.zani.kz/app/integrations"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn("facebook.com/dialog/oauth", response.data["authorization_url"])
        self.assertIn("state=", response.data["authorization_url"])
        self.assertTrue(response.data["app_configured"])
        self.assertTrue(response.data["config_id_configured"])
        self.assertEqual(response.data["app_id"], "app-id")
        self.assertEqual(response.data["config_id"], "config-id")
        self.assertTrue(response.data["graph_api_version"].startswith("v"))

    @override_settings(
        META_APP_ID="meta-app",
        META_APP_SECRET="meta-secret",
        WHATSAPP_GRAPH_BASE_URL="https://127.0.0.1",
    )
    def test_whatsapp_embedded_signup_rejects_private_graph_base_url_without_network_call(self):
        with patch("apps.integrations.whatsapp.embedded_signup.urllib_request.urlopen") as urlopen:
            with self.assertRaisesMessage(ValueError, "WHATSAPP_GRAPH_BASE_URL must be a public HTTPS URL."):
                exchange_whatsapp_code_for_access_token(code="oauth-code", redirect_uri="https://app.zani.kz/integrations")

        urlopen.assert_not_called()

    @override_settings(
        META_APP_ID="app-id",
        META_APP_SECRET="app-secret",
        CORS_ALLOWED_ORIGINS=["https://app.zani.kz"],
        CSRF_TRUSTED_ORIGINS=["https://app.zani.kz"],
    )
    def test_whatsapp_embedded_signup_rejects_untrusted_redirect_uri(self):
        self.api.force_authenticate(self.owner)

        response = self.api.post(
            "/api/business-connectors/whatsapp-embedded-signup/start/",
            {"business": self.business.id, "redirect_uri": "https://evil.example/app/integrations"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)

    @override_settings(
        META_APP_ID="app-id",
        META_APP_SECRET="app-secret",
        CORS_ALLOWED_ORIGINS=["https://app.zani.kz"],
        CSRF_TRUSTED_ORIGINS=["https://app.zani.kz"],
    )
    def test_whatsapp_embedded_signup_complete_saves_channel_and_connector(self):
        self.api.force_authenticate(self.owner)
        start_response = self.api.post(
            "/api/business-connectors/whatsapp-embedded-signup/start/",
            {"business": self.business.id, "redirect_uri": "https://app.zani.kz/app/integrations"},
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
                    "redirect_uri": "https://app.zani.kz/app/integrations",
                    "phone_number_id": "phone-embedded",
                    "waba_id": "waba-embedded",
                    "display_phone_number": "+77015550101",
                },
                format="json",
            )

        self.assertEqual(complete_response.status_code, 200)
        channel = BotChannel.objects.get(channel=BotChannel.Channels.WHATSAPP, external_id="phone-embedded")
        self.assertEqual(channel.config_json["provider_mode"], "meta_cloud")
        self.assertNotIn("access_token", channel.config_json)
        self.assertTrue(channel.config_json["access_token_configured"])
        connector = BusinessConnector.objects.get(business=self.business, provider=BusinessConnector.Providers.WHATSAPP, name="WhatsApp")
        self.assertEqual(connector.status, BusinessConnector.Statuses.CONNECTED)
        self.assertTrue(connector.config_json["embedded_signup"])
        self.assertNotIn("embedded-access-token", str(connector.config_json))
        credential = ConnectorCredential.objects.get(connector=connector, key="access_token")
        self.assertEqual(decrypt_credential_value(credential.encrypted_value), "embedded-access-token")

    @override_settings(
        META_APP_ID="app-id",
        META_APP_SECRET="app-secret",
        CORS_ALLOWED_ORIGINS=["https://app.zani.kz"],
        CSRF_TRUSTED_ORIGINS=["https://app.zani.kz"],
    )
    def test_whatsapp_embedded_signup_complete_rejects_redirect_uri_mismatch(self):
        self.api.force_authenticate(self.owner)
        start_response = self.api.post(
            "/api/business-connectors/whatsapp-embedded-signup/start/",
            {"business": self.business.id, "redirect_uri": "https://app.zani.kz/app/integrations"},
            format="json",
        )

        complete_response = self.api.post(
            "/api/business-connectors/whatsapp-embedded-signup/complete/",
            {
                "business": self.business.id,
                "code": "embedded-code",
                "state": start_response.data["state"],
                "redirect_uri": "https://app.zani.kz/app/integrations/other",
                "phone_number_id": "phone-embedded",
            },
            format="json",
        )

        self.assertEqual(complete_response.status_code, 400)
        self.assertFalse(BotChannel.objects.filter(channel=BotChannel.Channels.WHATSAPP, external_id="phone-embedded").exists())

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


class InstagramIntegrationFoundationTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.owner = User.objects.create_user(
            username="instagram-owner",
            email="instagram-owner@example.com",
            password="pass",
            role=User.Roles.BUSINESS_OWNER,
        )
        self.business = Business.objects.create(owner=self.owner, name="Instagram Clinic", slug="instagram-clinic")
        BusinessMember.objects.create(business=self.business, user=self.owner, role=BusinessMember.Roles.OWNER)
        self.bot = Bot.objects.create(business=self.business, name="Instagram bot", status=Bot.Statuses.ACTIVE)
        self.channel = BotChannel.objects.create(
            bot=self.bot,
            channel=BotChannel.Channels.INSTAGRAM,
            status=BotChannel.Statuses.ACTIVE,
            external_id="ig-123",
            config_json={"provider_mode": "mock", "instagram_user_id": "ig-123"},
        )

    @override_settings(INSTAGRAM_VERIFY_TOKEN="verify-token")
    def test_instagram_webhook_get_verification_returns_challenge(self):
        response = self.api.get(
            "/api/integrations/instagram/webhook/?hub.mode=subscribe&hub.verify_token=verify-token&hub.challenge=challenge-ig"
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content.decode("utf-8"), "challenge-ig")

    @override_settings(
        INSTAGRAM_ENABLED=True,
        INSTAGRAM_VERIFY_TOKEN="verify-token",
        META_APP_ID="meta-app",
        META_APP_SECRET="meta-secret",
        INSTAGRAM_APP_SECRET="instagram-secret",
    )
    def test_instagram_local_real_test_rejects_private_public_url(self):
        output = StringIO()

        with self.assertRaises(CommandError):
            call_command(
                "instagram_local_real_test_check",
                "--public-url",
                "https://127.0.0.1",
                "--fail-on-missing",
                stdout=output,
            )

        self.assertIn("FAIL public_https_url", output.getvalue())

    @override_settings(
        INSTAGRAM_ENABLED=True,
        INSTAGRAM_VERIFY_TOKEN="verify-token",
        META_APP_ID="meta-app",
        META_APP_SECRET="meta-secret",
        INSTAGRAM_APP_SECRET="instagram-secret",
    )
    def test_instagram_local_real_test_accepts_public_https_url(self):
        output = StringIO()

        call_command(
            "instagram_local_real_test_check",
            "--public-url",
            "https://api.zani.kz",
            "--fail-on-missing",
            stdout=output,
        )

        self.assertIn("PASS public_https_url", output.getvalue())

    @override_settings(
        INSTAGRAM_ENABLED=True,
        INSTAGRAM_VERIFY_TOKEN="verify-token",
        META_APP_ID="meta-app",
        META_APP_SECRET="meta-secret",
        INSTAGRAM_APP_SECRET="instagram-secret",
    )
    def test_instagram_local_real_test_rejects_and_redacts_public_url_query(self):
        output = StringIO()

        with self.assertRaises(CommandError):
            call_command(
                "instagram_local_real_test_check",
                "--public-url",
                "https://api.zani.kz?token=raw-secret-token",
                "--fail-on-missing",
                stdout=output,
            )

        text = output.getvalue()
        self.assertIn("FAIL public_https_url", text)
        self.assertIn("Webhook callback URL: https://api.zani.kz/api/integrations/instagram/webhook/", text)
        self.assertNotIn("raw-secret-token", text)

    @override_settings(INSTAGRAM_APP_SECRET="app-secret")
    def test_instagram_webhook_routes_by_instagram_user_id_and_signature(self):
        payload = {
            "object": "instagram",
            "api_key": "raw-api-key",
            "entry": [
                {
                    "id": "ig-123",
                    "time": 1710000000,
                    "messaging": [
                        {
                            "sender": {"id": "client-ig-1"},
                            "recipient": {"id": "ig-123"},
                            "timestamp": 1710000000,
                            "message": {"mid": "mid.1", "text": "Хочу записаться из Instagram", "access_token": "raw-access-token"},
                        }
                    ],
                }
            ],
        }
        raw_payload = json.dumps(payload).encode("utf-8")
        signature = "sha256=" + hmac.new(b"app-secret", raw_payload, hashlib.sha256).hexdigest()

        response = self.api.generic(
            "POST",
            "/api/integrations/instagram/webhook/",
            raw_payload,
            content_type="application/json",
            HTTP_X_HUB_SIGNATURE_256=signature,
        )

        self.assertEqual(response.status_code, 200)
        conversation = BotConversation.objects.get(channel=BotConversation.Channels.INSTAGRAM)
        message = BotMessage.objects.get(conversation=conversation)
        self.assertEqual(conversation.external_user_id, "client-ig-1")
        self.assertEqual(message.text, "Хочу записаться из Instagram")
        self.assertEqual(message.external_message_id, "mid.1")
        self.assertEqual(message.payload_json["instagram_user_id"], "ig-123")
        self.assertEqual(message.payload_json["instagram_payload"]["api_key"], "configured")
        self.assertEqual(message.payload_json["instagram_payload"]["entry"][0]["messaging"][0]["message"]["access_token"], "configured")
        self.assertNotIn("raw-api-key", str(message.payload_json))
        self.assertNotIn("raw-access-token", str(message.payload_json))

    @override_settings(INSTAGRAM_APP_SECRET="", META_APP_SECRET="")
    def test_instagram_webhook_rejects_missing_account_id_without_single_channel_fallback(self):
        response = self.api.post(
            "/api/integrations/instagram/webhook/",
            {
                "from": {"id": "client-ig-1"},
                "message": "Hidden",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(BotMessage.objects.count(), 0)

    def test_instagram_outbound_uses_provider_layer(self):
        result = send_instagram_message(self.channel, recipient_id="client-ig-1", text="Здравствуйте")

        self.assertTrue(result["ok"])
        self.assertTrue(result["mock"])
        self.assertTrue(
            IntegrationEventLog.objects.filter(
                business=self.business,
                provider="instagram",
                direction=IntegrationEventLog.Directions.OUTBOUND,
                status=IntegrationEventLog.Statuses.MOCKED,
            ).exists()
        )

    @override_settings(INSTAGRAM_ENABLED=False)
    def test_merchant_can_configure_instagram_credentials_and_test_mock(self):
        self.api.force_authenticate(self.owner)

        config_response = self.api.post(
            f"/api/bot-channels/{self.channel.id}/instagram-config/",
            {
                "provider_mode": "meta_graph",
                "instagram_user_id": "ig-456",
                "access_token": "instagram-access-token",
                "page_id": "page-123",
                "username": "zani_test",
            },
            format="json",
        )
        test_response = self.api.post(f"/api/bot-channels/{self.channel.id}/instagram-test-connection/")
        status_response = self.api.get(f"/api/bot-channels/{self.channel.id}/instagram-status/")

        self.assertEqual(config_response.status_code, 200)
        self.assertTrue(config_response.data["instagram_user_id_configured"])
        self.assertTrue(config_response.data["access_token_configured"])
        self.assertEqual(test_response.status_code, 200)
        self.assertTrue(test_response.data["ok"])
        self.assertTrue(test_response.data["mock"])
        self.assertIn("/api/integrations/instagram/webhook/", status_response.data["webhook_url"])
        channel_response = self.api.get(f"/api/bot-channels/{self.channel.id}/")
        self.assertEqual(channel_response.data["config_json"]["access_token"], "configured")
        self.assertNotIn("instagram-access-token", str(channel_response.data))
        connector = BusinessConnector.objects.get(business=self.business, provider=BusinessConnector.Providers.INSTAGRAM, name="Instagram")
        self.assertEqual(connector.status, BusinessConnector.Statuses.CONNECTED)
        self.assertTrue(connector.config_json["access_token_configured"])
        self.assertTrue(connector.config_json["instagram_user_id_configured"])
        self.assertNotIn("instagram-access-token", str(connector.config_json))

    @override_settings(INSTAGRAM_ENABLED=True, INSTAGRAM_GRAPH_BASE_URL="https://127.0.0.1")
    def test_instagram_provider_rejects_private_graph_base_url_without_network_call(self):
        self.channel.config_json = {
            "provider_mode": "meta_graph",
            "instagram_user_id": "ig-456",
            "access_token": "instagram-access-token",
        }
        self.channel.external_id = "ig-456"
        self.channel.save(update_fields=["config_json", "external_id", "updated_at"])

        with patch("apps.integrations.providers.instagram.urllib_request.urlopen") as urlopen:
            result = InstagramProvider().validate_credentials(self.channel)

        self.assertFalse(result["ok"])
        self.assertIn("INSTAGRAM_GRAPH_BASE_URL must be a public HTTPS URL.", result["reason"])
        urlopen.assert_not_called()
        log = IntegrationEventLog.objects.filter(provider="instagram", status=IntegrationEventLog.Statuses.FAILED).latest("created_at")
        self.assertNotIn("instagram-access-token", str(log.payload_json))

    @override_settings(META_APP_ID="meta-app", META_APP_SECRET="meta-secret", DEBUG=True)
    def test_instagram_oauth_start_returns_authorization_url(self):
        self.api.force_authenticate(self.owner)

        response = self.api.post(
            "/api/business-connectors/instagram-oauth/start/",
            {"business": self.business.id, "redirect_uri": "http://localhost:5174/app/integrations?zani_provider=instagram"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["app_configured"])
        self.assertIn("dialog/oauth", response.data["authorization_url"])
        self.assertIn("instagram_manage_messages", response.data["authorization_url"])

    @override_settings(INSTAGRAM_GRAPH_BASE_URL="https://127.0.0.1")
    def test_instagram_oauth_rejects_private_graph_base_url_without_network_call(self):
        with patch("apps.integrations.instagram_oauth.urllib_request.urlopen") as urlopen:
            with self.assertRaisesMessage(ValueError, "INSTAGRAM_GRAPH_BASE_URL must be a public HTTPS URL."):
                fetch_instagram_meta_json("oauth/access_token", {"access_token": "instagram-access-token"})

        urlopen.assert_not_called()

    @override_settings(
        META_APP_ID="meta-app",
        META_APP_SECRET="meta-secret",
        CORS_ALLOWED_ORIGINS=["https://app.zani.kz"],
        CSRF_TRUSTED_ORIGINS=["https://app.zani.kz"],
    )
    def test_instagram_oauth_rejects_untrusted_redirect_uri(self):
        self.api.force_authenticate(self.owner)

        response = self.api.post(
            "/api/business-connectors/instagram-oauth/start/",
            {"business": self.business.id, "redirect_uri": "https://evil.example/app/integrations"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)

    @override_settings(META_APP_ID="meta-app", META_APP_SECRET="meta-secret", DEBUG=True)
    @patch("apps.integrations.instagram_oauth.exchange_code_for_instagram_access_token", return_value={"access_token": "user-token"})
    @patch("apps.integrations.instagram_oauth.exchange_for_long_lived_user_token", return_value="long-token")
    @patch(
        "apps.integrations.instagram_oauth.fetch_instagram_pages",
        return_value={
            "data": [
                {
                    "id": "page-1",
                    "name": "Page",
                    "access_token": "page-token",
                    "instagram_business_account": {"id": "ig-oauth-1", "username": "zani"},
                }
            ]
        },
    )
    def test_instagram_oauth_complete_saves_channel_and_connector(self, *_mocks):
        self.api.force_authenticate(self.owner)
        start = self.api.post(
            "/api/business-connectors/instagram-oauth/start/",
            {"business": self.business.id, "redirect_uri": "http://localhost:5174/app/integrations?zani_provider=instagram"},
            format="json",
        )

        response = self.api.post(
            "/api/business-connectors/instagram-oauth/complete/",
            {
                "business": self.business.id,
                "code": "oauth-code",
                "state": start.data["state"],
                "redirect_uri": "http://localhost:5174/app/integrations?zani_provider=instagram",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        channel = BotChannel.objects.get(id=response.data["channel_id"])
        self.assertEqual(channel.external_id, "ig-oauth-1")
        self.assertEqual(channel.config_json["access_token"], "page-token")
        connector = BusinessConnector.objects.get(business=self.business, provider=BusinessConnector.Providers.INSTAGRAM, name="Instagram")
        self.assertEqual(connector.status, BusinessConnector.Statuses.CONNECTED)
        self.assertTrue(connector.config_json["access_token_configured"])
        self.assertNotIn("page-token", str(response.data["connector"]["config_json"]))
