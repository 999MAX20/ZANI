from io import StringIO

from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase, override_settings

from apps.core.paid_beta_gate import run_paid_beta_gate_check


class PaidBetaGateTests(TestCase):
    def test_paid_beta_is_blocked_by_default_local_settings(self):
        report = run_paid_beta_gate_check()

        self.assertFalse(report["allowed"])
        self.assertGreater(report["summary"]["fail"], 0)
        self.assertIn("support.operations_health", {item["key"] for item in report["items"]})

    @override_settings(
        DEBUG=False,
        SECRET_KEY="vZ9!rQ2#mN8$kL4%pT6@wX1&bC7?gH3+sD5^yF0",
        ALLOWED_HOSTS=["api.zani.test"],
        CORS_ALLOWED_ORIGINS=["https://app.zani.test"],
        CSRF_TRUSTED_ORIGINS=["https://app.zani.test"],
        SECURE_SSL_REDIRECT=True,
        SECURE_PROXY_SSL_HEADER=("HTTP_X_FORWARDED_PROTO", "https"),
        SESSION_COOKIE_SECURE=True,
        CSRF_COOKIE_SECURE=True,
        SECURE_HSTS_SECONDS=31536000,
        SECURE_HSTS_INCLUDE_SUBDOMAINS=True,
        SECURE_HSTS_PRELOAD=True,
        SUPPORT_REQUIRES_GRANT=True,
        DATABASES={
            "default": {
                "ENGINE": "django.db.backends.postgresql",
                "CONN_MAX_AGE": 60,
                "OPTIONS": {"sslmode": "require"},
            }
        },
        CELERY_BROKER_URL="rediss://redis.example.com:6379/0",
        AUTOMATIONS_RUN_INLINE=False,
        USE_S3=True,
        AWS_STORAGE_BUCKET_NAME="zani-private",
        AWS_S3_REGION_NAME="eu-central-1",
        AWS_QUERYSTRING_AUTH=True,
        AWS_DEFAULT_ACL=None,
        STORAGES={"default": {"BACKEND": "storages.backends.s3.S3Storage"}},
        SENTRY_DSN="https://public@sentry.example.net/1",
        SENTRY_TRACES_SAMPLE_RATE=0.05,
        EMAIL_HOST="smtp.zani.example.net",
        DEFAULT_FROM_EMAIL="Zani <no-reply@zani.example.net>",
        EMAIL_USE_TLS=True,
        EMAIL_USE_SSL=False,
        PAID_BETA_STAGING_SMOKE_GREEN=True,
        PAID_BETA_BROWSER_E2E_GREEN=True,
        PAID_BETA_BACKUP_RESTORE_DRILL_DONE=True,
        PAID_BETA_SUPPORT_GRANT_FLOW_TESTED=True,
        ENVIRONMENT="staging",
        RELEASE="release-20260528",
        REST_FRAMEWORK={
            "DEFAULT_THROTTLE_RATES": {
                "auth_login": "10/min",
                "auth_refresh": "30/min",
                "auth_social": "20/min",
                "auth_signup": "10/hour",
                "auth_password_reset": "5/hour",
                "public_api": "120/min",
                "public_form": "60/min",
                "public_widget": "120/min",
                "integration_webhook": "300/min",
                "ai_assistant": "30/min",
            }
        },
    )
    def test_paid_beta_can_pass_when_all_gates_are_green(self):
        report = run_paid_beta_gate_check()

        self.assertTrue(report["allowed"])
        self.assertEqual(report["summary"]["fail"], 0)

    def test_command_can_fail_on_blockers(self):
        with self.assertRaises(CommandError):
            call_command("paid_beta_gate_check", "--fail-on-blockers", stdout=StringIO())

    def test_command_json_output(self):
        output = StringIO()
        call_command("paid_beta_gate_check", "--format=json", stdout=output)

        self.assertIn('"allowed"', output.getvalue())
