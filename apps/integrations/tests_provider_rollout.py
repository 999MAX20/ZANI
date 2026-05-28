from io import StringIO

from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import SimpleTestCase, override_settings

from apps.integrations.provider_rollout import run_provider_rollout_readiness_check


class ProviderRolloutReadinessTests(SimpleTestCase):
    def test_disabled_real_providers_do_not_block_local_readiness(self):
        result = run_provider_rollout_readiness_check()

        providers = {item["provider"]: item for item in result["providers"]}
        self.assertEqual(providers["telegram"]["status"], "ready")
        self.assertEqual(providers["excel_csv"]["status"], "ready")
        self.assertEqual(providers["whatsapp"]["status"], "ready")
        self.assertEqual(providers["instagram"]["status"], "ready")

    @override_settings(
        TELEGRAM_ENABLED=True,
        TELEGRAM_WEBHOOK_SECRET="",
        CELERY_BROKER_URL="redis://localhost:6379/0",
        AUTOMATIONS_RUN_INLINE=False,
        SENTRY_DSN="https://example@sentry.invalid/1",
    )
    def test_telegram_real_mode_requires_webhook_secret(self):
        result = run_provider_rollout_readiness_check(provider="telegram")

        telegram = result["providers"][0]
        self.assertEqual(telegram["status"], "blocked")
        self.assertIn("telegram.webhook_secret", {gate["key"] for gate in telegram["gates"] if gate["status"] == "fail"})

    @override_settings(
        TELEGRAM_ENABLED=True,
        TELEGRAM_WEBHOOK_SECRET="secret",
        CELERY_BROKER_URL="rediss://redis.example.com:6379/0",
        AUTOMATIONS_RUN_INLINE=False,
        SENTRY_DSN="https://example@sentry.invalid/1",
    )
    def test_telegram_real_mode_passes_with_runtime_gates(self):
        result = run_provider_rollout_readiness_check(provider="telegram")

        self.assertEqual(result["providers"][0]["status"], "ready")

    @override_settings(
        OPENAI_API_KEY="sk-test",
        CELERY_BROKER_URL="redis://localhost:6379/0",
        AUTOMATIONS_RUN_INLINE=True,
        SENTRY_DSN="https://example@sentry.invalid/1",
    )
    def test_ai_provider_requires_queue_backed_runtime_when_enabled(self):
        result = run_provider_rollout_readiness_check(provider="openai")

        openai = result["providers"][0]
        self.assertEqual(openai["status"], "blocked")
        self.assertIn("openai.queue_runtime", {gate["key"] for gate in openai["gates"] if gate["status"] == "fail"})

    @override_settings(
        WHATSAPP_ENABLED=True,
        CELERY_BROKER_URL="redis://localhost:6379/0",
        AUTOMATIONS_RUN_INLINE=False,
        SENTRY_DSN="https://example@sentry.invalid/1",
    )
    def test_whatsapp_real_mode_requires_meta_webhook_security(self):
        result = run_provider_rollout_readiness_check(provider="whatsapp")

        whatsapp = result["providers"][0]
        self.assertEqual(whatsapp["status"], "blocked")
        self.assertIn("whatsapp.meta_cloud_security", {gate["key"] for gate in whatsapp["gates"] if gate["status"] == "fail"})

    @override_settings(
        WHATSAPP_ENABLED=True,
        WHATSAPP_VERIFY_TOKEN="verify",
        WHATSAPP_APP_SECRET="app-secret",
        CELERY_BROKER_URL="rediss://redis.example.com:6379/0",
        AUTOMATIONS_RUN_INLINE=False,
        SENTRY_DSN="https://example@sentry.invalid/1",
    )
    def test_whatsapp_real_mode_passes_with_meta_security_and_runtime(self):
        result = run_provider_rollout_readiness_check(provider="whatsapp")

        self.assertEqual(result["providers"][0]["status"], "ready")

    @override_settings(
        INSTAGRAM_ENABLED=True,
        CELERY_BROKER_URL="redis://localhost:6379/0",
        AUTOMATIONS_RUN_INLINE=False,
        SENTRY_DSN="https://example@sentry.invalid/1",
        META_APP_SECRET="",
        INSTAGRAM_APP_SECRET="",
    )
    def test_instagram_real_mode_requires_meta_webhook_security(self):
        result = run_provider_rollout_readiness_check(provider="instagram")

        instagram = result["providers"][0]
        self.assertEqual(instagram["status"], "blocked")
        self.assertIn("instagram.meta_graph_security", {gate["key"] for gate in instagram["gates"] if gate["status"] == "fail"})

    @override_settings(
        INSTAGRAM_ENABLED=True,
        INSTAGRAM_VERIFY_TOKEN="verify",
        INSTAGRAM_APP_SECRET="app-secret",
        CELERY_BROKER_URL="rediss://redis.example.com:6379/0",
        AUTOMATIONS_RUN_INLINE=False,
        SENTRY_DSN="https://example@sentry.invalid/1",
    )
    def test_instagram_real_mode_passes_with_meta_security_and_runtime(self):
        result = run_provider_rollout_readiness_check(provider="instagram")

        self.assertEqual(result["providers"][0]["status"], "ready")

    def test_management_command_can_fail_on_blockers(self):
        with override_settings(OPENAI_API_KEY="sk-test", AUTOMATIONS_RUN_INLINE=True):
            with self.assertRaises(CommandError):
                call_command("provider_rollout_readiness_check", "--provider=openai", "--fail-on-blockers", stdout=StringIO())

    def test_management_command_json_output(self):
        output = StringIO()
        call_command("provider_rollout_readiness_check", "--provider=website", "--format=json", stdout=output)

        self.assertIn('"provider": "website"', output.getvalue())

    def test_excel_csv_readiness_is_available_as_next_data_connector(self):
        result = run_provider_rollout_readiness_check(provider="excel_csv")

        excel_csv = result["providers"][0]
        self.assertEqual(excel_csv["status"], "ready")
        self.assertIn("excel_csv.import_entities", {gate["key"] for gate in excel_csv["gates"]})
