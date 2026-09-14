import json
from contextlib import ExitStack
from unittest.mock import MagicMock, patch
from urllib.error import HTTPError

from django.test import override_settings
from rest_framework.exceptions import ValidationError

from apps.bots import services
from apps.bots.models import Bot, BotChannel
from apps.bots.serializers import BotChannelSerializer
from apps.core.domain_errors import InvalidTransition, OwnershipConflict
from apps.integrations.bot_channel_credentials import (
    get_instagram_access_token, get_telegram_bot_token, store_instagram_access_token,
)
from apps.integrations.connectors import create_or_update_credential
from apps.integrations.instagram_oauth import build_instagram_oauth_url, complete_instagram_oauth
from apps.integrations.models import BusinessConnector
from apps.integrations.serializers import BusinessConnectorSerializer, ConnectorCredentialSerializer
from apps.integrations.tests_channel_ownership import ChannelOwnershipFixture
from apps.integrations.whatsapp.embedded_signup import (
    build_embedded_signup_state, complete_embedded_signup, validate_signup_phone_number,
)
from apps.integrations.whatsapp_credentials import get_whatsapp_access_token, store_whatsapp_access_token


class ChannelSetupConsistencyTests(ChannelOwnershipFixture):
    def test_pending_request_edit_cannot_erase_new_channel_binding(self):
        connector = BusinessConnector.objects.create(business=self.business, provider="whatsapp", name="WhatsApp")
        pending = BusinessConnectorSerializer(connector, data={"config_json": {"request_status": "pending_request", "form": {"comment": "Request"}}}, partial=True)
        self.assertTrue(pending.is_valid(), pending.errors)
        channel = BotChannel.objects.create(bot=self.bot, channel="whatsapp")
        services.configure_whatsapp_channel(channel, {"access_token": "current-token", "provider_mode": "mock"})
        with self.assertRaises(ValidationError):
            pending.save()
        connector.refresh_from_db()
        self.assertEqual(connector.config_json["bot_channel_id"], channel.id)

    def test_two_prevalidated_creates_cannot_claim_one_provider(self):
        other = Bot.objects.create(business=self.business, name="Another")
        serializers = [BotChannelSerializer(data={"bot": bot.id, "channel": "whatsapp", "status": "draft"}) for bot in (self.bot, other)]
        for serializer in serializers:
            self.assertTrue(serializer.is_valid(), serializer.errors)
        serializers[0].save()
        with self.assertRaises(OwnershipConflict):
            serializers[1].save()
        self.assertEqual(BotChannel.objects.filter(bot__business=self.business, channel="whatsapp").count(), 1)

    def test_prevalidated_credential_writes_recheck_current_binding(self):
        for provider, update in (("whatsapp", False), ("instagram", True)):
            with self.subTest(provider=provider):
                channel = BotChannel.objects.create(bot=self.bot, channel=provider)
                connector = BusinessConnector.objects.create(business=self.business, provider=provider, name=provider.title())
                if update:
                    credential = create_or_update_credential(connector, "access_token", "initial")
                    pending = ConnectorCredentialSerializer(credential, data={"value": "late-token"}, partial=True)
                else:
                    pending = ConnectorCredentialSerializer(data={"connector": connector.id, "key": "access_token", "value": "late-token"})
                self.assertTrue(pending.is_valid(), pending.errors)
                configure = getattr(services, f"configure_{provider}_channel")
                # WhatsApp's canonical display name is not str.title().
                if provider == "whatsapp":
                    connector.name = "WhatsApp"
                    connector.save(update_fields=["name"])
                configure(channel, {"provider_mode": "mock", "access_token": "current-token"})
                with self.assertRaises(ValidationError):
                    pending.save()
                getter = get_whatsapp_access_token if provider == "whatsapp" else get_instagram_access_token
                self.assertEqual(getter(channel), "current-token")

    def test_late_provider_results_cannot_verify_rotated_credentials(self):
        for provider in ("telegram", "whatsapp", "instagram"):
            channel, _ = BotChannel.objects.get_or_create(bot=self.bot, channel=provider)
            configure = getattr(services, f"configure_{provider}_channel")
            test_connection = getattr(services, f"test_{provider}_channel_connection")
            config = {"bot_token": "old-token"} if provider == "telegram" else {"provider_mode": "mock", "access_token": "old-token"}
            for result_ok in (True, False):
                with self.subTest(provider=provider, result_ok=result_ok):
                    configure(channel, config)

                    def late_result(*args):
                        changed = {**config, "bot_token" if provider == "telegram" else "access_token": "rotated-token"}
                        configure(channel, changed)
                        return {"ok": result_ok, "mock": True}

                    with ExitStack() as stack:
                        if provider == "telegram":
                            stack.enter_context(patch("apps.bots.services.validate_telegram_token", side_effect=late_result))
                        else:
                            mocked = stack.enter_context(patch("apps.bots.services.get_provider"))
                            mocked.return_value.validate_credentials.side_effect = late_result
                        with self.assertRaises(InvalidTransition):
                            test_connection(channel)
                    channel.refresh_from_db()
                    self.assertEqual(channel.status, "draft")
                    self.assertFalse(channel.config_json["token_verified" if provider == "telegram" else "connection_verified"])

    def test_late_telegram_webhook_result_cannot_restore_old_readiness(self):
        services.configure_telegram_channel(self.channel, {"bot_token": "old-token"})

        def late_result(*args):
            services.configure_telegram_channel(self.channel, {"bot_token": "rotated-token"})
            return {"ok": True}

        with patch("apps.bots.services.set_telegram_webhook", side_effect=late_result):
            with self.assertRaises(InvalidTransition):
                services.set_telegram_channel_webhook(self.channel, "https://example.com/webhook")
        self.channel.refresh_from_db()
        self.assertFalse(self.channel.config_json["webhook_configured"])
        self.assertEqual(get_telegram_bot_token(self.channel), "rotated-token")

    def test_bound_secret_delete_is_denied_and_missing_secret_repair_resets_webhook(self):
        services.configure_telegram_channel(self.channel, {"bot_token": "test-token"})
        self.channel.refresh_from_db()
        self.channel.config_json.update(token_verified=True, webhook_configured=True)
        self.channel.save(update_fields=["config_json"])
        credential = self.connector.credentials.get(key="webhook_secret")
        self.assertEqual(self.api.delete(f"/api/connector-credentials/{credential.id}/").status_code, 400)
        credential.delete()  # Simulate an externally missing credential, not a permitted API path.
        services.configure_telegram_channel(self.channel, {})
        self.channel.refresh_from_db()
        self.assertFalse(self.channel.config_json["webhook_configured"])
        self.assertEqual(self.patch_channel({"status": "active"}).status_code, 409)

    def test_request_metadata_cannot_smuggle_provider_authority(self):
        for extra in ({"token_verified": True}, {"bot_channel_id": self.foreign_channel.id}, {"nested": {"webhook_configured": True}}):
            with self.subTest(extra=extra):
                response = self.api.post("/api/business-connectors/", {
                    "business": self.business.id, "provider": "whatsapp", "name": "Request",
                    "config_json": {"request_status": "pending_request", "form": {"company_name": "Clinic", **extra}},
                }, format="json")
                self.assertEqual(response.status_code, 400)

    @override_settings(WHATSAPP_GRAPH_BASE_URL="https://graph.facebook.com")
    def test_signup_phone_validation_rejects_unrelated_identity_and_provider_denial(self):
        for payload in ({"id": "other-phone", "display_phone_number": "+77010000000"}, {"id": "own-phone"}):
            with self.subTest(payload=payload):
                response = MagicMock()
                response.__enter__.return_value.read.return_value = json.dumps(payload).encode()
                with patch("apps.integrations.whatsapp.embedded_signup.urllib_request.urlopen", return_value=response):
                    with self.assertRaises(ValueError):
                        validate_signup_phone_number("private-token", "own-phone")
        with patch("apps.integrations.whatsapp.embedded_signup.urllib_request.urlopen", side_effect=HTTPError("https://graph.facebook.com", 403, "Denied", {}, None)):
            with self.assertRaises(ValueError):
                validate_signup_phone_number("private-token", "own-phone")

    @override_settings(WHATSAPP_GRAPH_BASE_URL="https://graph.facebook.com")
    def test_signup_phone_validation_uses_bearer_header_and_exact_identity(self):
        response = MagicMock()
        response.__enter__.return_value.read.return_value = b'{"id":"own-phone","display_phone_number":"+77010000000"}'
        with patch("apps.integrations.whatsapp.embedded_signup.urllib_request.urlopen", return_value=response) as fetch:
            validate_signup_phone_number("private-token", "own-phone")
        request = fetch.call_args.args[0]
        self.assertEqual(request.get_header("Authorization"), "Bearer private-token")
        self.assertNotIn("private-token", request.full_url)

    def test_oauth_reconnect_reuses_renamed_bound_connector(self):
        redirect = "https://example.com/oauth"
        for provider in ("whatsapp", "instagram"):
            with self.subTest(provider=provider):
                channel = BotChannel.objects.create(bot=self.bot, channel=provider)
                store = store_whatsapp_access_token if provider == "whatsapp" else store_instagram_access_token
                getter = get_whatsapp_access_token if provider == "whatsapp" else get_instagram_access_token
                store(channel, "old-token")
                connector = BusinessConnector.objects.get(business=self.business, provider=provider)
                connector.name = "Zzz renamed"
                connector.save(update_fields=["name"])
                common = {"business": self.business, "user": self.owner, "redirect_uri": redirect, "code": "test-code"}
                with ExitStack() as stack:
                    if provider == "whatsapp":
                        state = build_embedded_signup_state(business=self.business, user=self.owner, redirect_uri=redirect, bot_channel=channel)
                        stack.enter_context(patch("apps.integrations.whatsapp.embedded_signup.exchange_code_for_access_token", return_value={"access_token": "new-token"}))
                        stack.enter_context(patch("apps.integrations.whatsapp.embedded_signup.validate_signup_phone_number", return_value=None))
                        _, result = complete_embedded_signup(**common, state=state, phone_number_id="own-phone")
                    else:
                        _, state = build_instagram_oauth_url(business=self.business, user=self.owner, redirect_uri=redirect, bot_channel=channel)
                        stack.enter_context(patch("apps.integrations.instagram_oauth.exchange_code_for_instagram_access_token", return_value={"access_token": "user-token"}))
                        stack.enter_context(patch("apps.integrations.instagram_oauth.exchange_for_long_lived_user_token", return_value="user-token"))
                        stack.enter_context(patch("apps.integrations.instagram_oauth.fetch_instagram_pages", return_value={"data": [{"id": "page", "access_token": "new-token", "instagram_business_account": {"id": "own-ig"}}]}))
                        _, result = complete_instagram_oauth(**common, state=state)
                self.assertEqual(result.pk, connector.pk)
                self.assertEqual(BusinessConnector.objects.filter(business=self.business, provider=provider).count(), 1)
                self.assertEqual(getter(channel), "new-token")

    def test_oauth_account_rejection_preserves_existing_setup(self):
        channel = BotChannel.objects.create(bot=self.bot, channel="whatsapp", status="draft", config_json={"safe": True})
        state = build_embedded_signup_state(business=self.business, user=self.owner, redirect_uri="https://example.com/oauth", bot_channel=channel)
        with patch("apps.integrations.whatsapp.embedded_signup.exchange_code_for_access_token", return_value={"access_token": "test-token"}), patch("apps.integrations.whatsapp.embedded_signup.validate_signup_phone_number", side_effect=ValueError("Denied")):
            with self.assertRaises(ValueError):
                complete_embedded_signup(business=self.business, user=self.owner, redirect_uri="https://example.com/oauth", state=state, code="test", phone_number_id="foreign-phone")
        channel.refresh_from_db()
        self.assertEqual(channel.config_json, {"safe": True})
        self.assertEqual(channel.status, "draft")
        self.assertFalse(BusinessConnector.objects.filter(business=self.business, provider="whatsapp").exists())
