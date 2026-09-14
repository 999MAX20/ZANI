from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.ai_core.models import AgentProfile, BusinessKnowledgeItem
from apps.bots.models import Bot, BotChannel
from apps.businesses.access import Actions, Resources
from apps.businesses.models import Business, BusinessMember, BusinessRole, RolePermission
from apps.core.models import AuditLog


class BotReadinessAPITests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.owner = User.objects.create_user(
            username="readiness-owner",
            email="readiness-owner@example.com",
            password="pass",
            role=User.Roles.BUSINESS_OWNER,
        )
        self.other_owner = User.objects.create_user(
            username="readiness-other-owner",
            email="readiness-other-owner@example.com",
            password="pass",
            role=User.Roles.BUSINESS_OWNER,
        )
        self.business = Business.objects.create(owner=self.owner, name="Ready Clinic", slug="ready-clinic")
        self.other_business = Business.objects.create(owner=self.other_owner, name="Other Clinic", slug="other-ready-clinic")
        BusinessMember.objects.create(business=self.business, user=self.owner, role=BusinessMember.Roles.OWNER)
        BusinessMember.objects.create(business=self.other_business, user=self.other_owner, role=BusinessMember.Roles.OWNER)
        self.bot = Bot.objects.create(business=self.business, name="Draft agent")
        self.api.force_authenticate(self.owner)

    def test_bot_response_exposes_structural_readiness(self):
        response = self.api.get(f"/api/bots/{self.bot.id}/")

        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data["readiness"]["is_ready"])
        self.assertEqual(response.data["readiness"]["missing"], ["profile", "channel", "knowledge"])

    def test_bot_cannot_be_created_active(self):
        response = self.api.post(
            "/api/bots/",
            {
                "business": self.business.id,
                "name": "Unsafe active agent",
                "status": Bot.Statuses.ACTIVE,
                "default_language": "ru",
                "settings_json": {},
            },
            format="json",
        )

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data["code"], "invalid_transition")
        self.assertFalse(Bot.objects.filter(name="Unsafe active agent").exists())

    def test_activate_requires_profile_channel_and_knowledge(self):
        blocked = self.api.post(f"/api/bots/{self.bot.id}/activate/")

        self.assertEqual(blocked.status_code, 409)
        self.assertEqual(blocked.data["errors"]["readiness"]["missing"], ["profile", "channel", "knowledge"])

        AgentProfile.objects.create(business=self.business, bot=self.bot, name="Ready profile", is_active=True)
        BotChannel.objects.create(
            bot=self.bot,
            channel=BotChannel.Channels.WEBSITE,
            status=BotChannel.Statuses.ACTIVE,
        )
        BusinessKnowledgeItem.objects.create(
            business=self.business,
            title="Booking rules",
            content="Use only confirmed slots.",
            is_active=True,
        )

        activated = self.api.post(f"/api/bots/{self.bot.id}/activate/")

        self.assertEqual(activated.status_code, 200)
        self.assertEqual(activated.data["status"], Bot.Statuses.ACTIVE)
        self.assertTrue(activated.data["readiness"]["is_ready"])
        self.assertTrue(
            AuditLog.objects.filter(
                business=self.business,
                entity_type="Bot",
                entity_id=str(self.bot.id),
                metadata__kind="lifecycle",
                metadata__to_status=Bot.Statuses.ACTIVE,
            ).exists()
        )

    def test_generic_status_patch_is_rejected(self):
        response = self.api.patch(
            f"/api/bots/{self.bot.id}/",
            {"status": Bot.Statuses.PAUSED},
            format="json",
        )

        self.assertEqual(response.status_code, 409)
        self.bot.refresh_from_db()
        self.assertEqual(self.bot.status, Bot.Statuses.DRAFT)

    def test_foreign_bot_activation_is_tenant_safe(self):
        foreign_bot = Bot.objects.create(business=self.other_business, name="Foreign agent")

        response = self.api.post(f"/api/bots/{foreign_bot.id}/activate/")

        self.assertEqual(response.status_code, 404)

    def test_ai_manager_without_integration_permission_cannot_create_channel(self):
        manager = User.objects.create_user(
            username="ai-manager",
            email="ai-manager@example.com",
            password="pass",
            role=User.Roles.STAFF,
        )
        role = BusinessRole.objects.create(business=self.business, name="AI manager")
        for action in (Actions.VIEW, Actions.MANAGE):
            RolePermission.objects.create(
                business_role=role,
                resource=Resources.AI_AUTOMATION,
                action=action,
                scope=RolePermission.Scopes.BUSINESS,
            )
        BusinessMember.objects.create(
            business=self.business,
            user=manager,
            role=BusinessMember.Roles.STAFF,
            business_role=role,
        )
        self.api.force_authenticate(manager)

        bots_response = self.api.get("/api/bots/")
        channel_response = self.api.post(
            "/api/bot-channels/",
            {
                "bot": self.bot.id,
                "channel": BotChannel.Channels.TELEGRAM,
                "status": BotChannel.Statuses.DRAFT,
                "external_id": "",
                "config_json": {},
            },
            format="json",
        )

        self.assertEqual(bots_response.status_code, 200)
        self.assertEqual(bots_response.data["count"], 1)
        self.assertEqual(channel_response.status_code, 403)

    def test_integration_viewer_cannot_configure_channel_credentials(self):
        viewer = User.objects.create_user(
            username="integration-viewer",
            email="integration-viewer@example.com",
            password="pass",
            role=User.Roles.STAFF,
        )
        role = BusinessRole.objects.create(business=self.business, name="Integration viewer")
        RolePermission.objects.create(
            business_role=role,
            resource=Resources.INTEGRATIONS,
            action=Actions.VIEW,
            scope=RolePermission.Scopes.BUSINESS,
        )
        BusinessMember.objects.create(
            business=self.business,
            user=viewer,
            role=BusinessMember.Roles.STAFF,
            business_role=role,
        )
        channel = BotChannel.objects.create(
            bot=self.bot,
            channel=BotChannel.Channels.TELEGRAM,
            status=BotChannel.Statuses.DRAFT,
        )
        self.api.force_authenticate(viewer)

        response = self.api.post(
            f"/api/bot-channels/{channel.id}/telegram-config/",
            {"bot_token": "123456:example-token"},
            format="json",
        )

        self.assertEqual(response.status_code, 403)
        channel.refresh_from_db()
        self.assertEqual(channel.config_json, {})

    def test_messenger_channel_cannot_be_silently_reassigned_to_another_bot(self):
        BotChannel.objects.create(bot=self.bot, channel=BotChannel.Channels.INSTAGRAM)
        other_bot = Bot.objects.create(business=self.business, name="Second agent")

        response = self.api.post(
            "/api/bot-channels/",
            {
                "bot": other_bot.id,
                "channel": BotChannel.Channels.INSTAGRAM,
                "status": BotChannel.Statuses.DRAFT,
                "external_id": "",
                "config_json": {},
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(BotChannel.objects.filter(bot__business=self.business, channel=BotChannel.Channels.INSTAGRAM).count(), 1)

    def test_ensure_channel_is_idempotent_and_bound_to_requested_bot(self):
        first = self.api.post(
            f"/api/bots/{self.bot.id}/channels/ensure/",
            {"channel": BotChannel.Channels.TELEGRAM},
            format="json",
        )
        second = self.api.post(
            f"/api/bots/{self.bot.id}/channels/ensure/",
            {"channel": BotChannel.Channels.TELEGRAM},
            format="json",
        )

        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(first.data["id"], second.data["id"])
        self.assertEqual(first.data["bot"], self.bot.id)
        self.assertEqual(BotChannel.objects.filter(bot=self.bot, channel=BotChannel.Channels.TELEGRAM).count(), 1)

    def test_public_widget_transport_ignores_ai_readiness_but_rejects_draft_channel(self):
        channel = BotChannel.objects.create(
            bot=self.bot,
            channel=BotChannel.Channels.WEBSITE,
            status=BotChannel.Statuses.ACTIVE,
        )

        draft_bot_response = self.api.get(f"/api/public/website-chat/{channel.public_token}/")
        self.bot.status = Bot.Statuses.ACTIVE
        self.bot.save(update_fields=["status", "updated_at"])
        unready_active_response = self.api.get(f"/api/public/website-chat/{channel.public_token}/")
        channel.status = BotChannel.Statuses.DRAFT
        channel.save(update_fields=["status", "updated_at"])
        draft_channel_response = self.api.get(f"/api/public/website-chat/{channel.public_token}/")

        self.assertEqual(draft_bot_response.status_code, 200)
        self.assertEqual(unready_active_response.status_code, 200)
        self.assertEqual(draft_channel_response.status_code, 403)

    def test_public_widget_accepts_runtime_ready_agent(self):
        channel = BotChannel.objects.create(
            bot=self.bot,
            channel=BotChannel.Channels.WEBSITE,
            status=BotChannel.Statuses.ACTIVE,
        )
        AgentProfile.objects.create(business=self.business, bot=self.bot, name="Website profile", is_active=True)
        BusinessKnowledgeItem.objects.create(
            business=self.business,
            title="Website knowledge",
            content="Grounded answer",
            is_active=True,
        )
        self.bot.status = Bot.Statuses.ACTIVE
        self.bot.save(update_fields=["status", "updated_at"])

        response = self.api.get(f"/api/public/website-chat/{channel.public_token}/")

        self.assertEqual(response.status_code, 200)
