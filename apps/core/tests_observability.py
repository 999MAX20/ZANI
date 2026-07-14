from io import StringIO
from unittest.mock import patch

from django.core.management import call_command, CommandError
from django.test import TestCase, override_settings


class ObservabilityRuntimeCheckTests(TestCase):
    @override_settings(SENTRY_DSN="", ENVIRONMENT="staging", RELEASE="release-20260528", SENTRY_TRACES_SAMPLE_RATE=0.05)
    def test_observability_check_warns_without_sentry(self):
        output = StringIO()

        call_command("observability_runtime_check", stdout=output)

        self.assertIn("Sentry configured: False", output.getvalue())
        self.assertIn("Sentry traces sample rate: 0.05", output.getvalue())
        self.assertIn("SENTRY_DSN is not configured", output.getvalue())

    @override_settings(SENTRY_DSN="", ENVIRONMENT="staging", RELEASE="release-20260528", SENTRY_TRACES_SAMPLE_RATE=0.05)
    def test_observability_check_can_fail_when_sentry_missing(self):
        with self.assertRaises(CommandError):
            call_command("observability_runtime_check", "--fail-on-missing", stdout=StringIO())

    @override_settings(SENTRY_DSN="https://public@example.com/1", ENVIRONMENT="staging", RELEASE="local", SENTRY_TRACES_SAMPLE_RATE=0.05)
    def test_observability_check_requires_release_in_staging(self):
        with self.assertRaises(CommandError):
            call_command("observability_runtime_check", stdout=StringIO())

    @override_settings(SENTRY_DSN="https://public@example.com/1", ENVIRONMENT="staging", RELEASE="test", SENTRY_TRACES_SAMPLE_RATE=0.05)
    def test_observability_check_rejects_test_release_in_staging(self):
        with self.assertRaises(CommandError):
            call_command("observability_runtime_check", stdout=StringIO())

    @override_settings(SENTRY_DSN="http://public@example.com/1", ENVIRONMENT="staging", RELEASE="release-20260528", SENTRY_TRACES_SAMPLE_RATE=0.05)
    def test_observability_check_rejects_non_https_dsn_in_staging(self):
        with self.assertRaises(CommandError):
            call_command("observability_runtime_check", stdout=StringIO())

    @override_settings(SENTRY_DSN="https://public@example.com/1", ENVIRONMENT="staging", RELEASE="release-20260528", SENTRY_TRACES_SAMPLE_RATE=1.0)
    def test_observability_check_rejects_excessive_trace_sample_rate(self):
        with self.assertRaises(CommandError):
            call_command("observability_runtime_check", stdout=StringIO())

    @override_settings(SENTRY_DSN="https://public@example.com/1", ENVIRONMENT="staging", RELEASE="release-20260528", SENTRY_TRACES_SAMPLE_RATE=0.05)
    def test_observability_check_can_capture_safe_test_message(self):
        output = StringIO()

        with (
            patch("sentry_sdk.capture_message", return_value="event-id-1") as capture_message,
            patch("sentry_sdk.set_tag") as set_tag,
        ):
            call_command("observability_runtime_check", "--capture-test-message", stdout=output)

        capture_message.assert_called_once_with("ZANI observability smoke", level="info")
        set_tag.assert_any_call("zani.check", "observability_runtime_check")
        set_tag.assert_any_call("zani.environment", "staging")
        set_tag.assert_any_call("zani.release", "release-20260528")
        self.assertIn("Sentry smoke message captured: event-id-1", output.getvalue())
