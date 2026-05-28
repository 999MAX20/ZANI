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

    @override_settings(SECRET_KEY="x" * 64)
    def test_audit_rejects_low_entropy_secret_key(self):
        audit = run_production_readiness_audit()

        secret_item = next(item for item in audit["items"] if item["key"] == "environment.secret_key")
        self.assertEqual(secret_item["status"], "fail")

    @override_settings(SECRET_KEY="vZ9!rQ2#mN8$kL4%pT6@wX1&bC7?gH3+sD5^yF0")
    def test_audit_accepts_high_entropy_secret_key(self):
        audit = run_production_readiness_audit()

        secret_item = next(item for item in audit["items"] if item["key"] == "environment.secret_key")
        self.assertEqual(secret_item["status"], "pass")

    @override_settings(CELERY_BROKER_URL="rediss://default:password@redis.example.com:6379/0")
    def test_audit_accepts_tls_redis_urls(self):
        audit = run_production_readiness_audit()

        queue_item = next(item for item in audit["items"] if item["key"] == "queue.redis")
        self.assertEqual(queue_item["status"], "pass")

    @override_settings(CELERY_BROKER_URL="redis://redis.example.com:6379/0")
    def test_audit_rejects_plaintext_redis_urls(self):
        audit = run_production_readiness_audit()

        queue_item = next(item for item in audit["items"] if item["key"] == "queue.redis")
        self.assertEqual(queue_item["status"], "fail")

    @override_settings(
        REST_FRAMEWORK={
            "DEFAULT_THROTTLE_RATES": {
                "auth_login": "1000/min",
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
        }
    )
    def test_audit_fails_when_rate_limits_are_too_permissive(self):
        audit = run_production_readiness_audit()

        rate_item = next(item for item in audit["items"] if item["key"] == "api.rate_limits")
        self.assertEqual(rate_item["status"], "fail")

    @override_settings(
        CORS_ALLOWED_ORIGINS=["http://localhost:5173", "https://app.example.com"],
        CSRF_TRUSTED_ORIGINS=["https://192.168.1.10"],
    )
    def test_audit_rejects_local_and_private_production_origins(self):
        audit = run_production_readiness_audit()

        cors_item = next(item for item in audit["items"] if item["key"] == "environment.cors")
        self.assertEqual(cors_item["status"], "fail")

    @override_settings(
        CORS_ALLOWED_ORIGINS=["https://app.example.com"],
        CSRF_TRUSTED_ORIGINS=["https://app.example.com", "https://api.example.com"],
    )
    def test_audit_accepts_public_https_origins(self):
        audit = run_production_readiness_audit()

        cors_item = next(item for item in audit["items"] if item["key"] == "environment.cors")
        self.assertEqual(cors_item["status"], "pass")

    @override_settings(
        USE_S3=True,
        AWS_STORAGE_BUCKET_NAME="",
        AWS_QUERYSTRING_AUTH=False,
        AWS_DEFAULT_ACL="public-read",
        STORAGES={"default": {"BACKEND": "django.core.files.storage.FileSystemStorage"}},
    )
    def test_audit_rejects_incomplete_or_public_object_storage(self):
        audit = run_production_readiness_audit()

        storage_item = next(item for item in audit["items"] if item["key"] == "storage.object_storage")
        self.assertEqual(storage_item["status"], "fail")

    @override_settings(
        USE_S3=True,
        AWS_STORAGE_BUCKET_NAME="zani-private-files",
        AWS_QUERYSTRING_AUTH=True,
        AWS_DEFAULT_ACL=None,
        STORAGES={"default": {"BACKEND": "storages.backends.s3.S3Storage"}},
    )
    def test_audit_accepts_private_object_storage(self):
        audit = run_production_readiness_audit()

        storage_item = next(item for item in audit["items"] if item["key"] == "storage.object_storage")
        self.assertEqual(storage_item["status"], "pass")

    @override_settings(DATABASES={"default": {"ENGINE": "django.db.backends.postgresql", "CONN_MAX_AGE": 60}})
    def test_audit_rejects_postgres_without_tls(self):
        audit = run_production_readiness_audit()

        database_item = next(item for item in audit["items"] if item["key"] == "database.managed_postgres")
        self.assertEqual(database_item["status"], "fail")

    @override_settings(
        DATABASES={
            "default": {
                "ENGINE": "django.db.backends.postgresql",
                "CONN_MAX_AGE": 60,
                "OPTIONS": {"sslmode": "require"},
            }
        }
    )
    def test_audit_accepts_tls_postgres(self):
        audit = run_production_readiness_audit()

        database_item = next(item for item in audit["items"] if item["key"] == "database.managed_postgres")
        self.assertEqual(database_item["status"], "pass")

    @override_settings(
        EMAIL_HOST="smtp.example.net",
        DEFAULT_FROM_EMAIL="Zani <no-reply@zani.local>",
        EMAIL_USE_TLS=True,
        EMAIL_USE_SSL=False,
    )
    def test_audit_rejects_local_sender_email_domain(self):
        audit = run_production_readiness_audit()

        email_item = next(item for item in audit["items"] if item["key"] == "email.transactional")
        self.assertEqual(email_item["status"], "warn")

    @override_settings(
        EMAIL_HOST="smtp.example.net",
        DEFAULT_FROM_EMAIL="Zani <no-reply@zani.example.net>",
        EMAIL_USE_TLS=False,
        EMAIL_USE_SSL=False,
    )
    def test_audit_rejects_unencrypted_transactional_email(self):
        audit = run_production_readiness_audit()

        email_item = next(item for item in audit["items"] if item["key"] == "email.transactional")
        self.assertEqual(email_item["status"], "warn")

    @override_settings(
        EMAIL_HOST="smtp.example.net",
        DEFAULT_FROM_EMAIL="Zani <no-reply@zani.example.net>",
        EMAIL_USE_TLS=True,
        EMAIL_USE_SSL=False,
    )
    def test_audit_accepts_secure_transactional_email(self):
        audit = run_production_readiness_audit()

        email_item = next(item for item in audit["items"] if item["key"] == "email.transactional")
        self.assertEqual(email_item["status"], "pass")

    @override_settings(SENTRY_DSN="http://public@example.com/1", RELEASE="release-20260528", SENTRY_TRACES_SAMPLE_RATE=0.05)
    def test_audit_rejects_non_https_sentry_dsn(self):
        audit = run_production_readiness_audit()

        sentry_item = next(item for item in audit["items"] if item["key"] == "observability.sentry")
        self.assertEqual(sentry_item["status"], "fail")

    @override_settings(SENTRY_DSN="https://public@example.com/1", RELEASE="local", SENTRY_TRACES_SAMPLE_RATE=0.05)
    def test_audit_rejects_local_release_for_sentry(self):
        audit = run_production_readiness_audit()

        sentry_item = next(item for item in audit["items"] if item["key"] == "observability.sentry")
        self.assertEqual(sentry_item["status"], "fail")

    @override_settings(SENTRY_DSN="https://public@example.com/1", RELEASE="release-20260528", SENTRY_TRACES_SAMPLE_RATE=1.0)
    def test_audit_rejects_excessive_sentry_trace_sample_rate(self):
        audit = run_production_readiness_audit()

        sentry_item = next(item for item in audit["items"] if item["key"] == "observability.sentry")
        self.assertEqual(sentry_item["status"], "fail")

    @override_settings(SENTRY_DSN="https://public@example.com/1", RELEASE="release-20260528", SENTRY_TRACES_SAMPLE_RATE=0.05)
    def test_audit_accepts_safe_sentry_observability(self):
        audit = run_production_readiness_audit()

        sentry_item = next(item for item in audit["items"] if item["key"] == "observability.sentry")
        self.assertEqual(sentry_item["status"], "pass")

    @override_settings(
        SECURE_SSL_REDIRECT=True,
        SESSION_COOKIE_SECURE=True,
        CSRF_COOKIE_SECURE=True,
        SECURE_HSTS_SECONDS=31536000,
        SECURE_HSTS_INCLUDE_SUBDOMAINS=True,
        SECURE_HSTS_PRELOAD=True,
        SECURE_PROXY_SSL_HEADER=None,
    )
    def test_audit_rejects_https_without_proxy_header(self):
        audit = run_production_readiness_audit()

        https_item = next(item for item in audit["items"] if item["key"] == "security.https")
        self.assertEqual(https_item["status"], "fail")

    @override_settings(
        SECURE_SSL_REDIRECT=True,
        SESSION_COOKIE_SECURE=True,
        CSRF_COOKIE_SECURE=True,
        SECURE_HSTS_SECONDS=31536000,
        SECURE_HSTS_INCLUDE_SUBDOMAINS=True,
        SECURE_HSTS_PRELOAD=True,
        SECURE_PROXY_SSL_HEADER=("HTTP_X_FORWARDED_PROTO", "https"),
    )
    def test_audit_accepts_full_https_security(self):
        audit = run_production_readiness_audit()

        https_item = next(item for item in audit["items"] if item["key"] == "security.https")
        self.assertEqual(https_item["status"], "pass")
