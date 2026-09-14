from unittest.mock import patch

from django.test import TestCase
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.ai_core.models import AgentProfile, BusinessKnowledgeItem
from apps.bots.lifecycle import update_bot_channel
from apps.bots.models import Bot, BotChannel, BotConversation, BotMessage
from apps.businesses.models import Business, BusinessMember
from apps.core.domain_errors import OwnershipConflict
from apps.integrations.bot_channel_credentials import (
    find_telegram_channel_by_webhook_secret,
    get_telegram_bot_token,
    store_telegram_webhook_secret,
)
from apps.integrations.connectors import create_or_update_credential
from apps.integrations.instagram_oauth import resolve_instagram_oauth_channel
from apps.integrations.models import BusinessConnector, BusinessEvent
from apps.integrations.serializers import BusinessConnectorSerializer
from apps.integrations.whatsapp.embedded_signup import resolve_embedded_signup_channel
from apps.integrations.whatsapp_credentials import (
    find_whatsapp_channel_by_webhook_secret,
    store_whatsapp_webhook_secret,
)


class ChannelOwnershipFixture(TestCase):
    secret = "test-only-channel-secret-C7g_R8p-N2k_F6x-W9m_T4q"

    @classmethod
    def setUpTestData(cls):
        cls.owner = User.objects.create_user(username="boundary-owner", email="boundary-owner@example.com", role=User.Roles.BUSINESS_OWNER)
        cls.other_owner = User.objects.create_user(username="boundary-other", email="boundary-other@example.com", role=User.Roles.BUSINESS_OWNER)
        cls.business = Business.objects.create(owner=cls.owner, name="Boundary A", slug="boundary-a")
        cls.other_business = Business.objects.create(owner=cls.other_owner, name="Boundary B", slug="boundary-b")
        for business, owner in ((cls.business, cls.owner), (cls.other_business, cls.other_owner)):
            BusinessMember.objects.create(business=business, user=owner, role=BusinessMember.Roles.OWNER)
            bot = Bot.objects.create(business=business, name="Agent", status=Bot.Statuses.ACTIVE)
            AgentProfile.objects.create(business=business, bot=bot, name="Profile", is_active=True)
            BusinessKnowledgeItem.objects.create(business=business, title="Rules", content="Grounded", is_active=True)
            BotChannel.objects.create(bot=bot, channel="telegram", status=BotChannel.Statuses.ACTIVE)
        cls.bot = cls.business.bots.get()
        cls.channel = cls.bot.channels.get()
        cls.foreign_channel = cls.other_business.bots.get().channels.get()
        store_telegram_webhook_secret(cls.channel, cls.secret)
        cls.connector = BusinessConnector.objects.get(business=cls.business, provider="telegram")

    def setUp(self):
        self.api = APIClient()
        self.api.force_authenticate(self.owner)
        network = patch("socket.socket.connect", side_effect=AssertionError("Real network is forbidden in boundary tests"))
        network.start()
        self.addCleanup(network.stop)

    def patch_channel(self, data, channel=None):
        return self.api.patch(f"/api/bot-channels/{(channel or self.channel).id}/", data, format="json")


class ChannelOwnershipBoundaryTests(ChannelOwnershipFixture):
    def test_connector_config_rejects_foreign_binding_and_variants_without_side_effects(self):
        original = self.connector.config_json.copy()
        for payload in (
            {**original, "bot_channel_id": self.foreign_channel.id},
            {"botChannelId": self.foreign_channel.id},
            {"nested": [{"Bot-Channel-ID": self.foreign_channel.id}]},
            {},
        ):
            with self.subTest(payload=payload):
                response = self.api.patch(f"/api/business-connectors/{self.connector.id}/", {"config_json": payload}, format="json")
                self.assertEqual(response.status_code, 400)
                self.connector.refresh_from_db()
                self.assertEqual(self.connector.config_json, original)

    def test_connector_create_cannot_seed_a_binding(self):
        response = self.api.post("/api/business-connectors/", {
            "business": self.business.id, "provider": "whatsapp", "name": "Forged",
            "config_json": {"bot_channel_id": self.foreign_channel.id},
        }, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertFalse(BusinessConnector.objects.filter(name="Forged").exists())

    def test_connector_provider_conversion_is_rejected(self):
        custom = BusinessConnector.objects.create(business=self.business, provider="custom", name="Custom", config_json={"bot_channel_id": self.foreign_channel.id})
        for connector, provider in ((custom, "telegram"), (self.connector, "custom")):
            with self.subTest(provider=provider):
                response = self.api.patch(f"/api/business-connectors/{connector.id}/", {"provider": provider}, format="json")
                self.assertEqual(response.status_code, 400)

    def test_exact_echo_and_name_update_preserve_server_owned_config(self):
        response = self.api.patch(f"/api/business-connectors/{self.connector.id}/", {
            "name": "Telegram label", "config_json": self.connector.config_json,
        }, format="json")
        self.assertEqual(response.status_code, 200)
        self.connector.refresh_from_db()
        self.assertEqual(self.connector.config_json["bot_channel_id"], self.channel.id)
        self.assertEqual(self.connector.auth_type, BusinessConnector.AuthTypes.TOKEN)
        self.assertEqual(self.patch_channel({"config_json": self.channel.config_json}).status_code, 200)

    def test_channel_flags_and_account_identity_are_not_public_writable_config(self):
        original = self.channel.config_json.copy()
        for config in (
            {"token_verified": True, "webhook_configured": True},
            {"connection_verified": True},
            {"nested": [{"Token-Verified": True}]},
            {"phone_number_id": "foreign-account"},
            {"instagram_user_id": "foreign-account"},
            {"provider_mode": "meta_cloud"},
        ):
            with self.subTest(config=config):
                self.assertEqual(self.patch_channel({"config_json": config}).status_code, 400)
                self.channel.refresh_from_db()
                self.assertEqual(self.channel.config_json, original)

    def test_connector_echo_cannot_overwrite_concurrent_setup(self):
        serializer = BusinessConnectorSerializer(self.connector, data={"name": "Renamed", "config_json": self.connector.config_json}, partial=True)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        changed = {**self.connector.config_json, "webhook_configured": False, "last_operation": "new_setup"}
        BusinessConnector.objects.filter(pk=self.connector.pk).update(config_json=changed)
        serializer.save()
        self.connector.refresh_from_db()
        self.assertEqual(self.connector.config_json, changed)

    def test_stale_channel_instance_cannot_activate_after_verification_reset(self):
        channel = BotChannel.objects.create(bot=self.bot, channel="whatsapp", status="paused", config_json={"connection_verified": True})
        BusinessConnector.objects.create(business=self.business, provider="whatsapp", name="WhatsApp", status="connected", config_json={"bot_channel_id": channel.id})
        BotChannel.objects.filter(pk=channel.pk).update(config_json={"connection_verified": False})
        from apps.core.domain_errors import InvalidTransition
        with self.assertRaises(InvalidTransition):
            update_bot_channel(channel=channel, validated_data={"status": "active"})

    def test_generic_create_and_put_reject_verified_config(self):
        payload = {"bot": self.bot.id, "channel": "whatsapp", "status": "draft", "config_json": {"connection_verified": True}}
        self.assertEqual(self.api.post("/api/bot-channels/", payload, format="json").status_code, 400)
        payload.update(channel="telegram", config_json={"token_verified": True, "webhook_configured": True})
        self.assertEqual(self.api.put(f"/api/bot-channels/{self.channel.id}/", payload, format="json").status_code, 400)

    def test_empty_and_legacy_mock_draft_creation_remain_supported(self):
        for provider, config in (("whatsapp", {"provider_mode": "mock"}), ("instagram", {})):
            with self.subTest(provider=provider):
                response = self.api.post("/api/bot-channels/", {
                    "bot": self.bot.id, "channel": provider, "status": "draft", "config_json": config, "external_id": "",
                }, format="json")
                self.assertEqual(response.status_code, 201)
                self.assertEqual(response.data["status"], "draft")

    def test_channel_identity_cannot_change_even_when_active(self):
        website = BotChannel.objects.create(bot=self.bot, channel="website", status="active")
        other_bot = Bot.objects.create(business=self.business, name="Another agent")
        for channel, payload in ((website, {"channel": "instagram"}), (self.channel, {"bot": other_bot.id}), (self.channel, {"external_id": "foreign-account"})):
            with self.subTest(payload=payload):
                self.assertEqual(self.patch_channel(payload, channel).status_code, 400)
        with self.assertRaises(ValidationError):
            update_bot_channel(channel=website, validated_data={"channel": "instagram", "status": "active"})
        with self.assertRaises(ValidationError):
            update_bot_channel(channel=self.channel, validated_data={"config_json": {"token_verified": True}})

    def test_foreign_channel_and_connector_are_hidden(self):
        foreign_connector = BusinessConnector.objects.create(business=self.other_business, provider="telegram", name="Foreign")
        self.assertEqual(self.patch_channel({"status": "paused"}, self.foreign_channel).status_code, 404)
        self.assertEqual(self.api.patch(f"/api/business-connectors/{foreign_connector.id}/", {"name": "Changed"}, format="json").status_code, 404)

    def test_operator_cannot_mutate_channel(self):
        operator = User.objects.create_user(username="boundary-operator", email="boundary-operator@example.com", role=User.Roles.BUSINESS_OPERATOR)
        BusinessMember.objects.create(business=self.business, user=operator, role=BusinessMember.Roles.OPERATOR)
        self.api.force_authenticate(operator)
        self.assertIn(self.patch_channel({"status": "paused"}).status_code, (403, 404))

    def test_poisoned_connector_never_resolves_a_foreign_channel_or_persists_inbound(self):
        self.connector.config_json = {**self.connector.config_json, "bot_channel_id": self.foreign_channel.id}
        self.connector.save(update_fields=["config_json"])
        self.assertIsNone(find_telegram_channel_by_webhook_secret(self.secret))
        response = APIClient().post("/api/integrations/telegram/webhook/", {
            "update_id": 987, "message": {"message_id": 987, "chat": {"id": 987}, "text": "Must not reach another business"},
        }, format="json", HTTP_X_TELEGRAM_BOT_API_SECRET_TOKEN=self.secret)
        self.assertIn(response.status_code, (400, 403))
        self.assertFalse(BotConversation.objects.exists())
        self.assertFalse(BotMessage.objects.exists())
        self.assertFalse(BusinessEvent.objects.exists())

    def test_malformed_bindings_fail_closed_without_orm_coercion(self):
        for value in (True, False, 1.0, 1.5, str(self.channel.id), [], {}, -1, 0, 2**80, None, "bad"):
            with self.subTest(value=value):
                BusinessConnector.objects.filter(pk=self.connector.pk).update(config_json={**self.connector.config_json, "bot_channel_id": value})
                self.assertIsNone(find_telegram_channel_by_webhook_secret(self.secret))

    def test_valid_telegram_binding_and_wrong_provider_control(self):
        self.assertEqual(find_telegram_channel_by_webhook_secret(self.secret), self.channel)
        website = BotChannel.objects.create(bot=self.bot, channel="website", status="active")
        BusinessConnector.objects.filter(pk=self.connector.pk).update(config_json={**self.connector.config_json, "bot_channel_id": website.id})
        self.assertIsNone(find_telegram_channel_by_webhook_secret(self.secret))

    def test_whatsapp_credential_binding_is_tenant_scoped(self):
        own = BotChannel.objects.create(bot=self.bot, channel="whatsapp", status="active")
        foreign = BotChannel.objects.create(bot=self.foreign_channel.bot, channel="whatsapp", status="active")
        store_whatsapp_webhook_secret(own, self.secret)
        self.assertEqual(find_whatsapp_channel_by_webhook_secret(self.secret), own)
        connector = BusinessConnector.objects.get(business=self.business, provider="whatsapp")
        connector.config_json = {**connector.config_json, "bot_channel_id": foreign.id}
        connector.save(update_fields=["config_json"])
        self.assertIsNone(find_whatsapp_channel_by_webhook_secret(self.secret))

    def test_unbound_connector_cannot_supply_another_channels_token(self):
        unbound = BusinessConnector.objects.create(business=self.business, provider="telegram", name="AAA unbound")
        create_or_update_credential(unbound, "bot_token", "test-only-unbound-token")
        self.assertEqual(get_telegram_bot_token(self.channel), "")

    def test_generic_rotation_of_bound_credentials_is_rejected(self):
        credential = self.connector.credentials.get(key="webhook_secret")
        for method, url, payload in (
            (self.api.post, "/api/connector-credentials/", {"connector": self.connector.id, "key": "webhook_secret", "value": "replacement"}),
            (self.api.patch, f"/api/connector-credentials/{credential.id}/", {"value": "replacement"}),
        ):
            with self.subTest(url=url):
                self.assertEqual(method(url, payload, format="json").status_code, 400)
        self.assertEqual(find_telegram_channel_by_webhook_secret(self.secret), self.channel)

    def test_meta_activation_requires_provider_verification_not_generic_connect(self):
        for provider in ("whatsapp", "instagram"):
            with self.subTest(provider=provider):
                channel = BotChannel.objects.create(bot=self.bot, channel=provider, status="draft")
                configured = self.api.post(f"/api/bot-channels/{channel.id}/{provider}-config/", {"provider_mode": "mock"}, format="json")
                self.assertEqual(configured.status_code, 200)
                connector = BusinessConnector.objects.get(business=self.business, provider=provider)
                self.assertEqual(self.api.post(f"/api/business-connectors/{connector.id}/connect/").status_code, 200)
                self.assertEqual(self.patch_channel({"status": "active"}, channel).status_code, 409)
                with patch("apps.bots.services.get_provider") as get_provider:
                    get_provider.return_value.validate_credentials.return_value = {"ok": True, "mock": True}
                    tested = self.api.post(f"/api/bot-channels/{channel.id}/{provider}-test-connection/")
                self.assertEqual(tested.status_code, 200)
                self.assertEqual(self.patch_channel({"status": "paused"}, channel).status_code, 200)
                self.assertEqual(self.patch_channel({"status": "active"}, channel).status_code, 200)
                self.api.post(f"/api/bot-channels/{channel.id}/{provider}-config/", {"provider_mode": "mock"}, format="json")
                self.api.post(f"/api/business-connectors/{connector.id}/connect/")
                self.assertEqual(self.patch_channel({"status": "active"}, channel).status_code, 409)

    def test_telegram_setup_and_rotation_preserve_validation_boundary(self):
        url = f"/api/bot-channels/{self.channel.id}"
        self.assertEqual(self.api.post(f"{url}/telegram-config/", {"bot_token": "test-only-token"}, format="json").status_code, 200)
        self.assertEqual(self.patch_channel({"status": "active"}).status_code, 409)
        with patch("apps.bots.services.validate_telegram_token", return_value={"ok": True}), patch("apps.bots.services.set_telegram_webhook", return_value={"ok": True}):
            self.assertEqual(self.api.post(f"{url}/telegram-test-connection/").status_code, 200)
            self.assertEqual(self.api.post(f"{url}/set-telegram-webhook/", {"webhook_url": "https://example.com/webhook"}, format="json").status_code, 200)
        self.assertEqual(self.patch_channel({"status": "paused"}).status_code, 200)
        self.assertEqual(self.patch_channel({"status": "active"}).status_code, 200)
        self.api.post(f"{url}/telegram-config/", {"bot_token": "test-only-rotated-token"}, format="json")
        self.channel.refresh_from_db()
        self.assertFalse(self.channel.config_json["token_verified"])
        self.assertFalse(self.channel.config_json["webhook_configured"])
        self.assertEqual(self.patch_channel({"status": "active"}).status_code, 409)

    def test_legacy_oauth_cannot_duplicate_another_agents_channel(self):
        another = Bot.objects.create(business=self.business, name="Second agent")
        for provider, resolver in (("instagram", resolve_instagram_oauth_channel), ("whatsapp", resolve_embedded_signup_channel)):
            with self.subTest(provider=provider):
                channel = BotChannel.objects.create(bot=another, channel=provider)
                with self.assertRaises(OwnershipConflict):
                    resolver(business=self.business, state_payload={})
                self.assertEqual(resolver(business=self.business, state_payload={"bot_channel_id": channel.id}), channel)
                self.assertEqual(BotChannel.objects.filter(bot__business=self.business, channel=provider).count(), 1)
