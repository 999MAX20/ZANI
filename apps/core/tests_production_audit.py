import json
from io import StringIO

from django.core.management import call_command, CommandError
from django.test import TestCase, override_settings

from apps.core.production_audit import run_production_readiness_audit


class ProductionReadinessAuditTests(TestCase):
    @override_settings(
        ENVIRONMENT="production",
        DEBUG=True,
        SECRET_KEY="short",
        ALLOWED_HOSTS=["*"],
        CORS_ALLOWED_ORIGINS=[],
        CSRF_TRUSTED_ORIGINS=[],
        SECURE_SSL_REDIRECT=False,
        SESSION_COOKIE_SECURE=False,
        CSRF_COOKIE_SECURE=False,
        SECURE_HSTS_SECONDS=0,
        SUPPORT_REQUIRES_GRANT=False,
        USE_S3=False,
        SENTRY_DSN="",
        AUTOMATIONS_RUN_INLINE=True,
    )
    def test_audit_reports_critical_failures_for_unsafe_production_settings(self):
        audit = run_production_readiness_audit()

        self.assertGreater(audit["summary"]["fail"], 0)
        failed_keys = {item["key"] for item in audit["items"] if item["status"] == "fail"}
        self.assertIn("environment.debug", failed_keys)
        self.assertIn("database.managed_postgres", failed_keys)
        self.assertIn("storage.object_storage", failed_keys)

    @override_settings(
        ENVIRONMENT="production",
        DEBUG=True,
        SECRET_KEY="short",
        ALLOWED_HOSTS=["*"],
        CORS_ALLOWED_ORIGINS=[],
        CSRF_TRUSTED_ORIGINS=[],
        SUPPORT_REQUIRES_GRANT=False,
        USE_S3=False,
        SENTRY_DSN="",
        AUTOMATIONS_RUN_INLINE=True,
    )
    def test_management_command_can_fail_on_critical_findings(self):
        with self.assertRaises(CommandError):
            call_command("production_readiness_audit", "--fail-on-critical", stdout=StringIO())

    def test_management_command_outputs_json(self):
        output = StringIO()

        call_command("production_readiness_audit", "--format=json", stdout=output)

        payload = json.loads(output.getvalue())
        self.assertIn("summary", payload)
        self.assertIn("items", payload)
