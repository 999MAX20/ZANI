import json
from io import StringIO

from django.core.management import call_command, CommandError
from django.test import TestCase, override_settings

from apps.core.backup_readiness import run_backup_restore_readiness_check


class BackupRestoreReadinessTests(TestCase):
    @override_settings(
        ENVIRONMENT="development",
        USE_S3=False,
        DATABASES={"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": ":memory:", "CONN_MAX_AGE": 0}},
    )
    def test_backup_readiness_reports_paid_beta_blockers(self):
        report = run_backup_restore_readiness_check()

        self.assertGreater(report["summary"]["paid_beta_blockers"], 0)
        failed_keys = {item["key"] for item in report["items"] if item["status"] == "fail"}
        self.assertIn("database.managed_postgres", failed_keys)
        self.assertIn("storage.object_storage", failed_keys)

    @override_settings(
        ENVIRONMENT="staging",
        USE_S3=True,
        AWS_STORAGE_BUCKET_NAME="zani-staging",
        AWS_S3_ENDPOINT_URL="https://storage.example.com",
        DATABASES={"default": {"ENGINE": "django.db.backends.postgresql", "NAME": "zani", "CONN_MAX_AGE": 60}},
    )
    def test_backup_readiness_can_pass_for_production_like_settings(self):
        report = run_backup_restore_readiness_check()

        self.assertEqual(report["summary"]["paid_beta_blockers"], 0)

    def test_backup_readiness_command_outputs_json(self):
        output = StringIO()

        call_command("backup_restore_readiness_check", "--format=json", stdout=output)

        payload = json.loads(output.getvalue())
        self.assertIn("summary", payload)
        self.assertIn("items", payload)

    @override_settings(
        USE_S3=False,
        DATABASES={"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": ":memory:", "CONN_MAX_AGE": 0}},
    )
    def test_backup_readiness_command_can_fail_on_blockers(self):
        with self.assertRaises(CommandError):
            call_command("backup_restore_readiness_check", "--fail-on-blockers", stdout=StringIO())
