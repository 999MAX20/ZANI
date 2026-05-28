import json

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from apps.integrations.models import BusinessConnector
from apps.integrations.moysklad import validate_moysklad_credentials


class Command(BaseCommand):
    help = "Check whether a MoySklad connector is ready for local real API testing."

    def add_arguments(self, parser):
        parser.add_argument("--connector-id", type=int, required=False)
        parser.add_argument("--format", choices=["text", "json"], default="text")
        parser.add_argument("--fail-on-missing", action="store_true")
        parser.add_argument("--validate", action="store_true", help="Call MoySklad JSON API with the stored token.")

    def handle(self, *args, **options):
        connector_id = options.get("connector_id")
        connector = None
        if connector_id:
            connector = BusinessConnector.objects.filter(id=connector_id, provider=BusinessConnector.Providers.MOYSKLAD).first()

        checks = self._build_checks(connector, validate=options.get("validate"))
        result = {
            "ready_for_local_real_test": all(check["status"] == "pass" for check in checks),
            "api_base_url": settings.MOYSKLAD_API_BASE_URL,
            "connector_id": connector.id if connector else None,
            "checks": checks,
        }

        if options["format"] == "json":
            self.stdout.write(json.dumps(result, ensure_ascii=False, indent=2, default=str))
        else:
            self._write_text(result)

        if options["fail_on_missing"] and not result["ready_for_local_real_test"]:
            raise CommandError("MoySklad local real-test prerequisites are missing.")

    def _build_checks(self, connector, validate=False):
        checks = [
            {
                "key": "moysklad_enabled",
                "status": "pass" if settings.MOYSKLAD_ENABLED else "fail",
                "detail": f"MOYSKLAD_ENABLED={settings.MOYSKLAD_ENABLED}",
                "action": "Set MOYSKLAD_ENABLED=True for real MoySklad API calls.",
            },
            {
                "key": "moysklad_api_base_url",
                "status": "pass" if settings.MOYSKLAD_API_BASE_URL.startswith("https://") else "fail",
                "detail": settings.MOYSKLAD_API_BASE_URL,
                "action": "Set MOYSKLAD_API_BASE_URL to the MoySklad JSON API base URL.",
            },
            {
                "key": "connector",
                "status": "pass" if connector else "fail",
                "detail": f"connector_id={connector.id}" if connector else "not provided or not found",
                "action": "Create/configure MoySklad connector in /dashboard/integrations and pass --connector-id.",
            },
        ]
        if connector:
            checks.append(
                {
                    "key": "access_token",
                    "status": "pass" if connector.credentials.filter(key="access_token").exists() else "fail",
                    "detail": "configured" if connector.credentials.filter(key="access_token").exists() else "missing",
                    "action": "Save MoySklad access key in the connector setup.",
                }
            )
            checks.append(
                {
                    "key": "entities",
                    "status": "pass",
                    "detail": ",".join((connector.config_json or {}).get("entities") or ["products", "stock", "sales", "clients"]),
                    "action": "Default entities are products, stock, sales and clients unless support narrows the scope.",
                }
            )
            if validate:
                result = validate_moysklad_credentials(connector)
                checks.append(
                    {
                        "key": "moysklad_api_validation",
                        "status": "pass" if result.get("ok") and not result.get("mock") else "fail",
                        "detail": result if not result.get("ok") else f"events_count={len(result.get('events', []))}",
                        "action": "MoySklad access key must allow read-only API access.",
                    }
                )
        return checks

    def _write_text(self, result):
        self.stdout.write(f"MoySklad local real-test ready: {result['ready_for_local_real_test']}")
        self.stdout.write(f"API base URL: {result['api_base_url']}")
        self.stdout.write(f"Connector id: {result['connector_id'] or 'pass --connector-id'}")
        for check in result["checks"]:
            self.stdout.write(f"- {check['status'].upper()} {check['key']}: {check['detail']} | action: {check['action']}")
