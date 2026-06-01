import json

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from apps.core.production_rules import is_safe_public_https_url
from apps.integrations.models import BusinessConnector
from apps.integrations.wildberries import validate_wildberries_credentials


class Command(BaseCommand):
    help = "Checks local readiness for a real read-only Wildberries statistics sync test."

    def add_arguments(self, parser):
        parser.add_argument("--connector-id", type=int, default=0, help="Wildberries BusinessConnector id to validate.")
        parser.add_argument("--format", choices=["text", "json"], default="text")
        parser.add_argument("--fail-on-missing", action="store_true")
        parser.add_argument("--validate", action="store_true", help="Call Wildberries Statistics API through the selected connector.")

    def handle(self, *args, **options):
        connector = None
        if options["connector_id"]:
            connector = BusinessConnector.objects.filter(id=options["connector_id"], provider=BusinessConnector.Providers.WILDBERRIES).first()
        checks = self._build_checks(connector, validate=options["validate"])
        result = {
            "ready_for_local_real_test": all(check["status"] == "pass" for check in checks),
            "api_base_url": settings.WILDBERRIES_STATISTICS_API_BASE_URL,
            "connector_id": connector.id if connector else None,
            "checks": checks,
        }
        if options["format"] == "json":
            self.stdout.write(json.dumps(result, ensure_ascii=False, indent=2, default=str))
        else:
            self._write_text(result)
        if options["fail_on_missing"] and not result["ready_for_local_real_test"]:
            raise CommandError("Wildberries local real-test prerequisites are missing.")

    def _build_checks(self, connector, validate=False):
        checks = [
            {
                "key": "wildberries_enabled",
                "status": "pass" if settings.WILDBERRIES_ENABLED else "fail",
                "detail": f"WILDBERRIES_ENABLED={settings.WILDBERRIES_ENABLED}",
                "action": "Set WILDBERRIES_ENABLED=True for real Wildberries API calls.",
            },
            {
                "key": "wildberries_statistics_api_base_url",
                "status": "pass" if is_safe_public_https_url(settings.WILDBERRIES_STATISTICS_API_BASE_URL) else "fail",
                "detail": settings.WILDBERRIES_STATISTICS_API_BASE_URL,
                "action": "Set WILDBERRIES_STATISTICS_API_BASE_URL to the public HTTPS Wildberries Statistics API base URL.",
            },
            {
                "key": "connector",
                "status": "pass" if connector else "fail",
                "detail": f"connector_id={connector.id}" if connector else "not provided or not found",
                "action": "Create/configure Wildberries connector in /dashboard/integrations and pass --connector-id.",
            },
        ]
        if connector:
            checks.append(
                {
                    "key": "api_token",
                    "status": "pass" if connector.credentials.filter(key="api_token").exists() else "fail",
                    "detail": "configured" if connector.credentials.filter(key="api_token").exists() else "missing",
                    "action": "Save Wildberries Statistics token in the connector setup.",
                }
            )
            if validate:
                result = validate_wildberries_credentials(connector)
                checks.append(
                    {
                        "key": "wildberries_api_validation",
                        "status": "pass" if result.get("ok") and not result.get("mock") else "fail",
                        "detail": result.get("reason", "ok") if not result.get("ok") else f"rows_count={result.get('rows_count', 0)}",
                        "action": "Wildberries token must allow read-only Statistics API access.",
                    }
                )
        return checks

    def _write_text(self, result):
        self.stdout.write(f"Wildberries local real-test ready: {result['ready_for_local_real_test']}")
        self.stdout.write(f"API base URL: {result['api_base_url']}")
        self.stdout.write(f"Connector id: {result['connector_id'] or 'pass --connector-id'}")
        for check in result["checks"]:
            self.stdout.write(f"- {check['status'].upper()} {check['key']}: {check['detail']} | action: {check['action']}")
