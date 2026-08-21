import importlib

from django.apps import apps as django_apps
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.bots.models import Bot, BotChannel
from apps.businesses.models import Business, BusinessMember
from apps.integrations.bot_channel_credentials import (
    find_telegram_channel_by_webhook_secret,
    get_telegram_webhook_secret,
)
from apps.integrations.credential_encryption import decrypt_credential_value
from apps.integrations.models import BusinessConnector, ConnectorCredential
from apps.integrations.whatsapp_credentials import (
    find_whatsapp_channel_by_webhook_secret,
    get_whatsapp_webhook_secret,
)


class EncryptedConfigBoundaryTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.owner = User.objects.create_user(
            username="encrypted-config-owner",
            email="encrypted-config-owner@example.com",
            password="Strong-test-password-2026",
            role=User.Roles.BUSINESS_OWNER,
        )
        self.business = Business.objects.create(owner=self.owner, name="Encrypted Config Clinic", slug="encrypted-config-clinic")
        BusinessMember.objects.create(business=self.business, user=self.owner, role=BusinessMember.Roles.OWNER)
        self.bot = Bot.objects.create(business=self.business, name="Main bot", status=Bot.Statuses.ACTIVE)
        self.telegram = BotChannel.objects.create(
            bot=self.bot,
            channel=BotChannel.Channels.TELEGRAM,
            status=BotChannel.Statuses.ACTIVE,
        )
        self.whatsapp = BotChannel.objects.create(
            bot=self.bot,
            channel=BotChannel.Channels.WHATSAPP,
            status=BotChannel.Statuses.ACTIVE,
        )
        self.api.force_authenticate(self.owner)

    def test_generic_connector_config_rejects_nested_case_variant_secret(self):
        response = self.api.post(
            "/api/business-connectors/",
            {
                "business": self.business.id,
                "provider": BusinessConnector.Providers.CUSTOM,
                "name": "Unsafe custom connector",
                "config_json": {"safe": True, "nested": [{"Client-Secret": "must-not-persist"}]},
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(BusinessConnector.objects.filter(name="Unsafe custom connector").exists())
        self.assertNotIn("must-not-persist", str(response.data))

    def test_generic_channel_config_rejects_authorization_and_preserves_state(self):
        self.telegram.config_json = {"safe_mode": True}
        self.telegram.save(update_fields=["config_json", "updated_at"])

        response = self.api.patch(
            f"/api/bot-channels/{self.telegram.id}/",
            {"config_json": {"safe_mode": False, "Authorization": "Bearer must-not-persist"}},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.telegram.refresh_from_db()
        self.assertEqual(self.telegram.config_json, {"safe_mode": True})
        self.assertNotIn("must-not-persist", str(response.data))

    def test_dedicated_channel_actions_encrypt_webhook_secrets(self):
        telegram_secret = "telegram-webhook-secret-A8v_qR7m-L2p_N9x"
        whatsapp_secret = "whatsapp-webhook-secret-A8v_qR7m-L2p_N9x"

        telegram_response = self.api.post(
            f"/api/bot-channels/{self.telegram.id}/telegram-config/",
            {"bot_token": "123456:telegram-token", "webhook_secret": telegram_secret},
            format="json",
        )
        whatsapp_response = self.api.post(
            f"/api/bot-channels/{self.whatsapp.id}/whatsapp-config/",
            {"provider_mode": "mock", "phone_number_id": "phone-1", "webhook_secret": whatsapp_secret},
            format="json",
        )

        self.assertEqual(telegram_response.status_code, 200)
        self.assertEqual(whatsapp_response.status_code, 200)
        self.telegram.refresh_from_db()
        self.whatsapp.refresh_from_db()
        self.assertNotIn("webhook_secret", self.telegram.config_json)
        self.assertNotIn("webhook_secret", self.whatsapp.config_json)
        self.assertTrue(self.telegram.config_json["webhook_secret_configured"])
        self.assertTrue(self.whatsapp.config_json["webhook_secret_configured"])
        self.assertEqual(get_telegram_webhook_secret(self.telegram), telegram_secret)
        self.assertEqual(get_whatsapp_webhook_secret(self.whatsapp), whatsapp_secret)
        self.assertEqual(find_telegram_channel_by_webhook_secret(telegram_secret), self.telegram)
        self.assertEqual(find_whatsapp_channel_by_webhook_secret(whatsapp_secret), self.whatsapp)

    def test_data_migration_extracts_existing_connector_and_channel_secrets(self):
        connector = BusinessConnector.objects.create(
            business=self.business,
            provider=BusinessConnector.Providers.CUSTOM,
            name="Legacy custom connector",
            config_json={"safe": True},
        )
        BusinessConnector.objects.filter(id=connector.id).update(
            config_json={
                "safe": True,
                "ApiKey": "legacy-api-key",
                "token": "legacy-generic-token",
                "nested": {"password": "legacy-password"},
            }
        )
        BotChannel.objects.filter(id=self.telegram.id).update(
            config_json={"bot_token": "legacy-bot-token", "webhook_secret": "legacy-webhook-secret-32-characters"}
        )

        migration = importlib.import_module("apps.integrations.migrations.0006_encrypt_plaintext_config_credentials")
        migration.migrate_plaintext_config_credentials(django_apps, None)

        connector.refresh_from_db()
        self.telegram.refresh_from_db()
        self.assertEqual(connector.config_json["safe"], True)
        self.assertNotIn("ApiKey", connector.config_json)
        self.assertNotIn("token", connector.config_json)
        self.assertNotIn("password", connector.config_json["nested"])
        self.assertNotIn("bot_token", self.telegram.config_json)
        self.assertNotIn("webhook_secret", self.telegram.config_json)
        self.assertTrue(self.telegram.config_json["token_configured"])
        telegram_connector = BusinessConnector.objects.get(
            business=self.business,
            provider=BusinessConnector.Providers.TELEGRAM,
            name="Telegram",
        )
        token = ConnectorCredential.objects.get(connector=telegram_connector, key="bot_token")
        secret = ConnectorCredential.objects.get(connector=telegram_connector, key="webhook_secret")
        self.assertEqual(decrypt_credential_value(token.encrypted_value), "legacy-bot-token")
        self.assertEqual(decrypt_credential_value(secret.encrypted_value), "legacy-webhook-secret-32-characters")
        self.assertNotIn("legacy-webhook-secret", str(telegram_connector.config_json))
