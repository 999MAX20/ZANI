from django.conf import settings
from django.core.management.base import BaseCommand, CommandError


PRODUCTION_ENVIRONMENTS = {"staging", "production"}


class Command(BaseCommand):
    help = "Check observability settings and optionally send a safe Sentry smoke message."

    def add_arguments(self, parser):
        parser.add_argument("--fail-on-missing", action="store_true", help="Exit with an error when SENTRY_DSN is missing.")
        parser.add_argument("--capture-test-message", action="store_true", help="Send a low-risk Sentry smoke message.")

    def handle(self, *args, **options):
        sentry_configured = bool(settings.SENTRY_DSN)
        self.stdout.write("Zani observability runtime check")
        self.stdout.write(f"Environment: {settings.ENVIRONMENT}")
        self.stdout.write(f"Release: {settings.RELEASE}")
        self.stdout.write(f"Sentry configured: {sentry_configured}")
        self.stdout.write(f"Sentry traces sample rate: {settings.SENTRY_TRACES_SAMPLE_RATE}")
        self.stdout.write("PII policy: send_default_pii=False")

        if settings.ENVIRONMENT in PRODUCTION_ENVIRONMENTS and settings.RELEASE == "local":
            raise CommandError("RELEASE must be set to a deploy identifier in staging/production.")

        if not sentry_configured:
            message = "SENTRY_DSN is not configured."
            if options["fail_on_missing"] or options["capture_test_message"]:
                raise CommandError(message)
            self.stdout.write(self.style.WARNING(message))
            return

        if options["capture_test_message"]:
            import sentry_sdk

            sentry_sdk.set_tag("zani.check", "observability_runtime_check")
            sentry_sdk.set_tag("zani.environment", settings.ENVIRONMENT)
            sentry_sdk.set_tag("zani.release", settings.RELEASE)
            event_id = sentry_sdk.capture_message("ZANI observability smoke", level="info")
            self.stdout.write(self.style.SUCCESS(f"Sentry smoke message captured: {event_id}"))
        else:
            self.stdout.write(self.style.SUCCESS("Observability configuration is present."))
