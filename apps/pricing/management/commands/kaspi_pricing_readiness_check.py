import json

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from apps.pricing.models import KaspiPricingRule


class Command(BaseCommand):
    help = "Checks readiness of the Kaspi Pricing Agent product surface."

    def add_arguments(self, parser):
        parser.add_argument("--business-id", type=int, default=0)
        parser.add_argument("--format", choices=["text", "json"], default="text")
        parser.add_argument("--fail-on-missing", action="store_true")

    def handle(self, *args, **options):
        rules = KaspiPricingRule.objects.filter(status=KaspiPricingRule.Statuses.ACTIVE)
        if options["business_id"]:
            rules = rules.filter(business_id=options["business_id"])
        checks = [
            {
                "key": "pricing_enabled",
                "status": "pass" if settings.KASPI_REPRICING_ENABLED else "warn",
                "detail": f"KASPI_REPRICING_ENABLED={settings.KASPI_REPRICING_ENABLED}",
                "action": "Enable KASPI_REPRICING_ENABLED=True when the product should run outside manual UI tests.",
            },
            {
                "key": "writeback_disabled_by_default",
                "status": "pass" if not settings.KASPI_REPRICING_WRITE_ENABLED else "warn",
                "detail": f"KASPI_REPRICING_WRITE_ENABLED={settings.KASPI_REPRICING_WRITE_ENABLED}",
                "action": "Keep write-back disabled until the official Kaspi price update adapter and support runbook are approved.",
            },
            {
                "key": "active_rules",
                "status": "pass" if rules.exists() else "warn",
                "detail": f"count={rules.count()}",
                "action": "Create at least one pricing rule before running real pricing cycles.",
            },
            {
                "key": "rules_have_thresholds",
                "status": "pass" if not rules.filter(min_price__isnull=True).exists() else "fail",
                "detail": "all active rules have min_price",
                "action": "Every pricing rule must have a minimum allowed price.",
            },
        ]
        result = {
            "ready": all(check["status"] != "fail" for check in checks),
            "checks": checks,
        }
        if options["format"] == "json":
            self.stdout.write(json.dumps(result, ensure_ascii=False, indent=2))
        else:
            self.stdout.write(f"Kaspi pricing readiness: {result['ready']}")
            for check in checks:
                self.stdout.write(f"- {check['status'].upper()} {check['key']}: {check['detail']} | action: {check['action']}")
        if options["fail_on_missing"] and not result["ready"]:
            raise CommandError("Kaspi pricing readiness blockers found.")
