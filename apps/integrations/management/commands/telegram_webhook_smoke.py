from uuid import uuid4

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.test import override_settings
from rest_framework.test import APIClient

from apps.bots.models import BotChannel, BotConversation, BotMessage
from apps.integrations.models import IntegrationEventLog


class Command(BaseCommand):
    help = "Post a safe local Telegram webhook payload into Django and verify that Inbox receives it."

    def add_arguments(self, parser):
        parser.add_argument("--channel-id", type=int, help="BotChannel id to use. Defaults to latest active Telegram channel with webhook secret.")
        parser.add_argument("--text", default="ZANI Telegram webhook smoke", help="Inbound message text.")
        parser.add_argument("--fail-on-error", action="store_true", help="Exit with an error when smoke check fails.")

    def handle(self, *args, **options):
        channel = self._resolve_channel(options.get("channel_id"))
        checks = []
        checks.append(self._check("telegram_channel_exists", channel is not None, "Telegram channel with webhook_secret must exist."))
        if channel is None:
            self._finish({"ok": False, "checks": checks}, options)
            return

        webhook_secret = (channel.config_json or {}).get("webhook_secret", "")
        checks.append(self._check("webhook_secret_saved", bool(webhook_secret), "Telegram channel must have webhook_secret."))
        if not webhook_secret:
            self._finish({"ok": False, "checks": checks, "channel_id": channel.id}, options)
            return

        update_id = int(uuid4().int % 10_000_000_000)
        chat_id = int(uuid4().int % 1_000_000_000)
        message_id = int(uuid4().int % 1_000_000)
        payload = {
            "update_id": update_id,
            "message": {
                "message_id": message_id,
                "from": {"id": chat_id, "username": "zani_smoke_client"},
                "chat": {"id": chat_id},
                "text": options["text"],
            },
        }

        api = APIClient()
        post = override_settings(ALLOWED_HOSTS=list(getattr(settings, "ALLOWED_HOSTS", [])) + ["testserver"])(
            lambda: api.post(
                "/api/integrations/telegram/webhook/",
                payload,
                format="json",
                HTTP_X_TELEGRAM_BOT_API_SECRET_TOKEN=webhook_secret,
            )
        )()
        checks.append(self._check("webhook_post_accepted", post.status_code == 200, f"status={post.status_code}"))

        response_data = getattr(post, "data", {}) if hasattr(post, "data") else {}
        conversation = BotConversation.objects.filter(id=response_data.get("conversation_id"), bot=channel.bot).first()
        message = BotMessage.objects.filter(id=response_data.get("message_id"), conversation=conversation).first() if conversation else None
        checks.append(self._check("conversation_created", conversation is not None, f"conversation_id={response_data.get('conversation_id')}"))
        checks.append(self._check("message_created", message is not None and message.text == options["text"], f"message_id={response_data.get('message_id')}"))
        checks.append(
            self._check(
                "integration_log_written",
                IntegrationEventLog.objects.filter(business=channel.bot.business, provider="telegram", direction=IntegrationEventLog.Directions.INBOUND, status=IntegrationEventLog.Statuses.PROCESSED).exists(),
                "processed inbound IntegrationEventLog should exist.",
            )
        )

        self._finish(
            {
                "ok": all(check["status"] == "pass" for check in checks),
                "channel_id": channel.id,
                "business_id": channel.bot.business_id,
                "conversation_id": conversation.id if conversation else None,
                "message_id": message.id if message else None,
                "checks": checks,
            },
            options,
        )

    def _resolve_channel(self, channel_id):
        queryset = BotChannel.objects.select_related("bot", "bot__business").filter(channel=BotChannel.Channels.TELEGRAM)
        if channel_id:
            return queryset.filter(id=channel_id).first()
        return queryset.exclude(config_json__webhook_secret="").order_by("-updated_at", "-id").first()

    def _check(self, name, passed, detail):
        return {"name": name, "status": "pass" if passed else "fail", "detail": detail}

    def _finish(self, result, options):
        self.stdout.write(f"Telegram webhook smoke: {result['ok']}")
        if result.get("channel_id"):
            self.stdout.write(f"Channel: id={result['channel_id']} business_id={result.get('business_id')}")
        if result.get("conversation_id"):
            self.stdout.write(f"Conversation: id={result['conversation_id']} message_id={result.get('message_id')}")
        for check in result["checks"]:
            style = self.style.SUCCESS if check["status"] == "pass" else self.style.ERROR
            self.stdout.write(style(f"{check['status'].upper()}: {check['name']} - {check['detail']}"))
        if options["fail_on_error"] and not result["ok"]:
            raise CommandError("Telegram webhook smoke failed.")
