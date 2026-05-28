import json
from urllib.parse import urljoin

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.test import Client


REQUIRED_SETTINGS = [
    "INSTAGRAM_VERIFY_TOKEN",
    "META_APP_ID",
    "META_APP_SECRET",
]


class Command(BaseCommand):
    help = "Checks local readiness for a real Instagram Meta Graph webhook test."

    def add_arguments(self, parser):
        parser.add_argument("--public-url", default="", help="Public HTTPS tunnel URL for Django, for example https://example.ngrok-free.app.")
        parser.add_argument("--format", choices=["text", "json"], default="text")
        parser.add_argument("--fail-on-missing", action="store_true")

    def handle(self, *args, **options):
        public_url = options["public_url"].rstrip("/")
        checks = self._build_checks(public_url)
        result = {
            "ready_for_local_real_test": all(check["status"] == "pass" for check in checks),
            "webhook_callback_url": urljoin(f"{public_url}/", "api/integrations/instagram/webhook/") if public_url else "",
            "checks": checks,
        }
        if options["format"] == "json":
            self.stdout.write(json.dumps(result, ensure_ascii=False, indent=2))
        else:
            self._write_text(result)
        if options["fail_on_missing"] and not result["ready_for_local_real_test"]:
            raise CommandError("Instagram local real-test prerequisites are missing.")

    def _build_checks(self, public_url):
        checks = [
            {
                "key": "public_https_url",
                "status": "pass" if public_url.startswith("https://") else "fail",
                "detail": public_url or "not provided",
                "action": "Start a public HTTPS tunnel to Django and pass it as --public-url.",
            },
            {
                "key": "instagram_enabled",
                "status": "pass" if settings.INSTAGRAM_ENABLED else "fail",
                "detail": f"INSTAGRAM_ENABLED={settings.INSTAGRAM_ENABLED}",
                "action": "Set INSTAGRAM_ENABLED=True for real Meta Graph validation and outbound sends.",
            },
        ]
        for setting_name in REQUIRED_SETTINGS:
            value = getattr(settings, setting_name, "")
            checks.append(
                {
                    "key": setting_name.lower(),
                    "status": "pass" if bool(value) else "fail",
                    "detail": "configured" if value else "missing",
                    "action": f"Set {setting_name} in the local Django environment.",
                }
            )
        checks.append(
            {
                "key": "instagram_app_secret",
                "status": "pass" if bool(settings.INSTAGRAM_APP_SECRET or settings.META_APP_SECRET) else "fail",
                "detail": "configured" if bool(settings.INSTAGRAM_APP_SECRET or settings.META_APP_SECRET) else "missing",
                "action": "Set INSTAGRAM_APP_SECRET or META_APP_SECRET for X-Hub-Signature-256 validation.",
            }
        )
        checks.append(self._webhook_verify_check())
        return checks

    def _webhook_verify_check(self):
        if not settings.INSTAGRAM_VERIFY_TOKEN:
            return {
                "key": "webhook_verify_endpoint",
                "status": "fail",
                "detail": "INSTAGRAM_VERIFY_TOKEN is missing.",
                "action": "Set INSTAGRAM_VERIFY_TOKEN before testing Meta webhook verification.",
            }
        challenge = "zani-instagram-local-check"
        response = Client().get(
            "/api/integrations/instagram/webhook/",
            {
                "hub.mode": "subscribe",
                "hub.verify_token": settings.INSTAGRAM_VERIFY_TOKEN,
                "hub.challenge": challenge,
            },
            HTTP_HOST="localhost",
        )
        ok = response.status_code == 200 and response.content.decode("utf-8") == challenge
        return {
            "key": "webhook_verify_endpoint",
            "status": "pass" if ok else "fail",
            "detail": f"status={response.status_code}",
            "action": "Meta webhook GET verification must return the hub.challenge body.",
        }

    def _write_text(self, result):
        self.stdout.write(f"Instagram local real-test ready: {result['ready_for_local_real_test']}")
        self.stdout.write(f"Webhook callback URL: {result['webhook_callback_url'] or 'pass --public-url'}")
        for check in result["checks"]:
            self.stdout.write(f"- {check['status'].upper()} {check['key']}: {check['detail']} | action: {check['action']}")
