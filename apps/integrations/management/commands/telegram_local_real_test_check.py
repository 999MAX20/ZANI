from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from apps.bots.models import BotChannel
from apps.core.production_rules import is_safe_public_https_url, redact_url_for_display
from apps.integrations.bot_channel_credentials import has_telegram_bot_token
from apps.integrations.providers.telegram import TelegramProvider


class Command(BaseCommand):
    help = "Check whether a merchant Telegram channel is ready for a local real test."

    def add_arguments(self, parser):
        parser.add_argument("--channel-id", type=int, help="BotChannel id to check. Defaults to the latest Telegram channel with a token.")
        parser.add_argument("--public-url", default="", help="Public HTTPS base URL or full Telegram webhook URL.")
        parser.add_argument("--set-webhook", action="store_true", help="Call Telegram setWebhook when public-url is provided.")
        parser.add_argument("--fail-on-missing", action="store_true", help="Exit with an error when any required readiness check fails.")

    def handle(self, *args, **options):
        channel = self._resolve_channel(options.get("channel_id"))
        checks = []
        checks.append(self._check("TELEGRAM_ENABLED", bool(settings.TELEGRAM_ENABLED), "Set TELEGRAM_ENABLED=True for real Telegram API calls."))
        checks.append(self._check("telegram_channel_exists", channel is not None, "Create/connect a Telegram channel in /app/integrations."))

        if channel is None:
            result = self._result(checks)
            self._print(result)
            if options["fail_on_missing"]:
                raise CommandError("Telegram channel is not available.")
            return

        config = channel.config_json or {}
        token_configured = has_telegram_bot_token(channel)
        checks.append(self._check("bot_token_saved", token_configured, "Paste the BotFather token into the Telegram connector."))
        checks.append(self._check("webhook_secret_saved", bool(config.get("webhook_secret")), "Save/generate a webhook secret before setting Telegram webhook."))
        checks.append(self._check("channel_active", channel.status == BotChannel.Statuses.ACTIVE, "Set Telegram channel status to active."))
        checks.append(self._check("bot_active", channel.bot.status == "active", "Set the bot status to active."))

        provider = TelegramProvider()
        token_result = provider.validate_token(channel) if token_configured else {"ok": False, "reason": "Token is missing."}
        checks.append(self._check("telegram_get_me", bool(token_result.get("ok") and not token_result.get("mock")), token_result.get("reason") or token_result.get("bot", {}).get("username") or "Telegram getMe must return ok=true."))

        public_url = (options.get("public_url") or "").strip()
        webhook_url = self._webhook_url(public_url) if public_url else ""
        public_url_safe = bool(public_url and is_safe_public_https_url(public_url) and is_safe_public_https_url(webhook_url))
        if public_url:
            checks.append(
                self._check(
                    "public_url_https",
                    public_url_safe,
                    "Telegram requires a public HTTPS webhook URL, not localhost or a private network address.",
                )
            )
        else:
            checks.append(self._check("public_url_https", False, "Pass --public-url=https://your-tunnel-domain to test webhook setup."))

        webhook_result = None
        if options["set_webhook"] and public_url_safe:
            webhook_result = provider.set_webhook(channel, webhook_url)
            checks.append(self._check("telegram_set_webhook", bool(webhook_result.get("ok") and not webhook_result.get("mock")), webhook_result.get("description") or webhook_result.get("reason") or "Telegram setWebhook must return ok=true."))
        elif options["set_webhook"]:
            checks.append(self._check("telegram_set_webhook", False, "Cannot set webhook without public HTTPS URL."))

        result = self._result(
            checks,
            channel={
                "id": channel.id,
                "bot_id": channel.bot_id,
                "business_id": channel.bot.business_id,
                "status": channel.status,
                "token_configured": token_configured,
                "webhook_secret_configured": bool(config.get("webhook_secret")),
            },
            telegram_get_me={
                "ok": bool(token_result.get("ok")),
                "mock": bool(token_result.get("mock")),
                "bot_username": (token_result.get("bot") or {}).get("username", ""),
            },
            webhook_url=webhook_url,
            webhook_result={"ok": webhook_result.get("ok"), "mock": webhook_result.get("mock", False)} if webhook_result else None,
        )
        self._print(result)
        if options["fail_on_missing"] and not result["ready_for_local_real_test"]:
            raise CommandError("Telegram local real-test is not ready.")

    def _resolve_channel(self, channel_id):
        queryset = BotChannel.objects.select_related("bot", "bot__business").filter(channel=BotChannel.Channels.TELEGRAM)
        if channel_id:
            return queryset.filter(id=channel_id).first()
        configured_channel_ids = []
        for channel in queryset.order_by("-updated_at", "-id"):
            if has_telegram_bot_token(channel):
                configured_channel_ids.append(channel.id)
        return queryset.filter(id__in=configured_channel_ids).order_by("-updated_at", "-id").first()

    def _webhook_url(self, public_url):
        value = redact_url_for_display(public_url).rstrip("/")
        if value.endswith("/api/integrations/telegram/webhook"):
            return f"{value}/"
        if value.endswith("/api/integrations/telegram/webhook/"):
            return value
        return f"{value}/api/integrations/telegram/webhook/"

    def _check(self, name, passed, detail):
        return {"name": name, "status": "pass" if passed else "fail", "detail": detail}

    def _result(self, checks, **extra):
        payload = {
            "provider": "telegram",
            "ready_for_local_real_test": all(check["status"] == "pass" for check in checks),
            "checks": checks,
        }
        payload.update(extra)
        return payload

    def _print(self, result):
        self.stdout.write(f"Telegram local real-test ready: {result['ready_for_local_real_test']}")
        if result.get("channel"):
            channel = result["channel"]
            self.stdout.write(
                f"Channel: id={channel['id']} bot_id={channel['bot_id']} business_id={channel['business_id']} status={channel['status']}"
            )
        if result.get("telegram_get_me", {}).get("bot_username"):
            self.stdout.write(f"Telegram bot: @{result['telegram_get_me']['bot_username']}")
        if result.get("webhook_url"):
            self.stdout.write(f"Webhook URL: {result['webhook_url']}")
        for check in result["checks"]:
            style = self.style.SUCCESS if check["status"] == "pass" else self.style.ERROR
            self.stdout.write(style(f"{check['status'].upper()}: {check['name']} - {check['detail']}"))
