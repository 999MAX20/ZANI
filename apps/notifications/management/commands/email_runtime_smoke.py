from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from apps.notifications.email import email_is_configured, send_email_smoke


class Command(BaseCommand):
    help = "Check transactional email configuration and optionally send a safe smoke email."

    def add_arguments(self, parser):
        parser.add_argument("--to", help="Recipient email for a smoke message.")
        parser.add_argument("--send", action="store_true", help="Send a smoke email.")
        parser.add_argument("--fail-on-missing", action="store_true", help="Exit with an error when email provider settings are missing.")

    def handle(self, *args, **options):
        configured = email_is_configured()
        self.stdout.write("Zani email runtime check")
        self.stdout.write(f"Backend: {settings.EMAIL_BACKEND}")
        self.stdout.write(f"Host configured: {bool(settings.EMAIL_HOST)}")
        self.stdout.write(f"Default from: {settings.DEFAULT_FROM_EMAIL}")
        self.stdout.write(f"Configured: {configured}")

        if not configured:
            message = "Transactional email provider is not configured."
            if options["fail_on_missing"] or options["send"]:
                raise CommandError(message)
            self.stdout.write(self.style.WARNING(message))
            return

        if options["send"]:
            if not options.get("to"):
                raise CommandError("--to is required when --send is used.")
            sent = send_email_smoke(options["to"])
            self.stdout.write(self.style.SUCCESS(f"Email smoke sent: {sent} message(s)."))
        else:
            self.stdout.write(self.style.SUCCESS("Email configuration is present."))
