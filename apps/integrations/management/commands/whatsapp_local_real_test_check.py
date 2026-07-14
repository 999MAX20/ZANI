import json
from urllib.parse import urljoin

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.test import Client

from apps.core.production_rules import is_safe_public_https_url, redact_url_for_display


REQUIRED_SETTINGS = [
    "WHATSAPP_VERIFY_TOKEN",
    "WHATSAPP_APP_SECRET",
    "META_APP_ID",
    "META_APP_SECRET",
    "WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID",
]


class Command(BaseCommand):
    help = "Checks local readiness for a real WhatsApp Meta Cloud webhook and Embedded Signup test."

    def add_arguments(self, parser):
        parser.add_argument(
            "--public-url",
            default="",
            help="Public HTTPS tunnel URL for the Django API, for example https://example.ngrok-free.app.",
        )
        parser.add_argument(
            "--format",
            choices=["text", "json"],
            default="text",
            help="Output format.",
        )
        parser.add_argument(
            "--fail-on-missing",
            action="store_true",
            help="Exit with an error if required Meta/WhatsApp settings are missing.",
        )

    def handle(self, *args, **options):
        raw_public_url = options["public_url"].rstrip("/")
        display_public_url = redact_url_for_display(raw_public_url)
        checks = self._build_checks(raw_public_url, display_public_url)
        result = {
            "ready_for_local_real_test": all(check["status"] == "pass" for check in checks),
            "webhook_callback_url": urljoin(f"{display_public_url}/", "api/integrations/whatsapp/webhook/") if display_public_url else "",
            "embedded_signup_redirect_uri": urljoin(f"{display_public_url}/", "app/integrations") if display_public_url else "",
            "checks": checks,
        }

        if options["format"] == "json":
            self.stdout.write(json.dumps(result, ensure_ascii=False, indent=2))
        else:
            self._write_text(result)

        if options["fail_on_missing"] and not result["ready_for_local_real_test"]:
            raise CommandError("WhatsApp local real-test prerequisites are missing.")

    def _build_checks(self, public_url, display_public_url):
        checks = [
            {
                "key": "public_https_url",
                "status": "pass" if is_safe_public_https_url(public_url) else "fail",
                "detail": display_public_url or "not provided",
                "action": "Start a public HTTPS tunnel to Django and pass it as --public-url; localhost and private network URLs are not valid.",
            },
            {
                "key": "whatsapp_enabled",
                "status": "pass" if settings.WHATSAPP_ENABLED else "fail",
                "detail": f"WHATSAPP_ENABLED={settings.WHATSAPP_ENABLED}",
                "action": "Set WHATSAPP_ENABLED=True for real Meta Cloud API validation and outbound sends.",
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
        checks.append(self._webhook_verify_check())
        return checks

    def _webhook_verify_check(self):
        if not settings.WHATSAPP_VERIFY_TOKEN:
            return {
                "key": "webhook_verify_endpoint",
                "status": "fail",
                "detail": "WHATSAPP_VERIFY_TOKEN is missing.",
                "action": "Set WHATSAPP_VERIFY_TOKEN before testing Meta webhook verification.",
            }

        challenge = "zani-whatsapp-local-check"
        response = Client().get(
            "/api/integrations/whatsapp/webhook/",
            {
                "hub.mode": "subscribe",
                "hub.verify_token": settings.WHATSAPP_VERIFY_TOKEN,
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
        self.stdout.write(f"WhatsApp local real-test ready: {result['ready_for_local_real_test']}")
        self.stdout.write(f"Webhook callback URL: {result['webhook_callback_url'] or 'pass --public-url'}")
        self.stdout.write(f"Embedded Signup redirect URI: {result['embedded_signup_redirect_uri'] or 'pass --public-url'}")
        for check in result["checks"]:
            self.stdout.write(f"- {check['status'].upper()} {check['key']}: {check['detail']} | action: {check['action']}")
