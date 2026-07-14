import json

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from apps.core.production_rules import is_safe_public_https_url
from apps.integrations.models import BusinessConnector
from apps.integrations.ozon import validate_ozon_credentials


class Command(BaseCommand):
    help = "Checks local readiness for a real read-only Ozon Seller API sync test."

    def add_arguments(self, parser):
        parser.add_argument("--connector-id", type=int, default=0, help="Ozon BusinessConnector id to validate.")
        parser.add_argument("--format", choices=["text", "json"], default="text")
        parser.add_argument("--fail-on-missing", action="store_true")
        parser.add_argument("--validate", action="store_true", help="Call Ozon Seller API through the selected connector.")

    def handle(self, *args, **options):
        connector = None
        if options["connector_id"]:
            connector = BusinessConnector.objects.filter(id=options["connector_id"], provider=BusinessConnector.Providers.OZON).first()
        checks = self._build_checks(connector, validate=options["validate"])
        result = {
            "ready_for_local_real_test": all(check["status"] == "pass" for check in checks),
            "api_base_url": settings.OZON_SELLER_API_BASE_URL,
            "connector_id": connector.id if connector else None,
            "checks": checks,
        }
        if options["format"] == "json":
            self.stdout.write(json.dumps(result, ensure_ascii=False, indent=2, default=str))
        else:
            self._write_text(result)
        if options["fail_on_missing"] and not result["ready_for_local_real_test"]:
            raise CommandError("Ozon local real-test prerequisites are missing.")

    def _build_checks(self, connector, validate=False):
        checks = [
            {
                "key": "ozon_enabled",
                "status": "pass" if settings.OZON_ENABLED else "fail",
                "detail": f"OZON_ENABLED={settings.OZON_ENABLED}",
                "action": "Set OZON_ENABLED=True for real Ozon API calls.",
            },
            {
                "key": "ozon_seller_api_base_url",
                "status": "pass" if is_safe_public_https_url(settings.OZON_SELLER_API_BASE_URL) else "fail",
                "detail": settings.OZON_SELLER_API_BASE_URL,
                "action": "Set OZON_SELLER_API_BASE_URL to the public HTTPS Ozon Seller API base URL.",
            },
            {
                "key": "connector",
                "status": "pass" if connector else "fail",
                "detail": f"connector_id={connector.id}" if connector else "not provided or not found",
                "action": "Create/configure Ozon connector in /app/integrations and pass --connector-id.",
            },
        ]
        if connector:
            has_client_id = connector.credentials.filter(key="client_id").exists()
            has_api_key = connector.credentials.filter(key="api_key").exists()
            checks.append(
                {
                    "key": "client_id",
                    "status": "pass" if has_client_id else "fail",
                    "detail": "configured" if has_client_id else "missing",
                    "action": "Save Ozon Client-Id in the connector setup.",
                }
            )
            checks.append(
                {
                    "key": "api_key",
                    "status": "pass" if has_api_key else "fail",
                    "detail": "configured" if has_api_key else "missing",
                    "action": "Save Ozon API key in the connector setup.",
                }
            )
            if validate:
                result = validate_ozon_credentials(connector)
                checks.append(
                    {
                        "key": "ozon_api_validation",
                        "status": "pass" if result.get("ok") and not result.get("mock") else "fail",
                        "detail": result.get("reason", "ok") if not result.get("ok") else f"warehouses_count={result.get('warehouses_count', 0)}",
                        "action": "Ozon credentials must allow read-only Seller API access.",
                    }
                )
        return checks

    def _write_text(self, result):
        self.stdout.write(f"Ozon local real-test ready: {result['ready_for_local_real_test']}")
        self.stdout.write(f"API base URL: {result['api_base_url']}")
        self.stdout.write(f"Connector id: {result['connector_id'] or 'pass --connector-id'}")
        for check in result["checks"]:
            self.stdout.write(f"- {check['status'].upper()} {check['key']}: {check['detail']} | action: {check['action']}")
