from io import StringIO

from django.core import mail
from django.core.management import call_command, CommandError
from django.test import TestCase, override_settings


class EmailRuntimeSmokeTests(TestCase):
    @override_settings(
        EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
        DEFAULT_FROM_EMAIL="Zani <no-reply@test.local>",
        ENVIRONMENT="test",
        RELEASE="test",
    )
    def test_email_runtime_smoke_sends_safe_message(self):
        output = StringIO()

        call_command("email_runtime_smoke", "--send", "--to", "owner@example.com", stdout=output)

        self.assertIn("Email smoke sent: 1 message", output.getvalue())
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ["owner@example.com"])
        self.assertNotIn("client", mail.outbox[0].body.lower())

    @override_settings(
        EMAIL_BACKEND="django.core.mail.backends.smtp.EmailBackend",
        EMAIL_HOST="",
        DEFAULT_FROM_EMAIL="Zani <no-reply@test.local>",
    )
    def test_email_runtime_smoke_can_fail_when_provider_missing(self):
        with self.assertRaises(CommandError):
            call_command("email_runtime_smoke", "--fail-on-missing", stdout=StringIO())
