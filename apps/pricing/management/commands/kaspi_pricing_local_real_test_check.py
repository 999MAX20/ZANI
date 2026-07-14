import json

from django.core.management.base import BaseCommand, CommandError
from django.db import connection

from apps.pricing.models import KaspiPriceChangeLog, KaspiPricingRule
from apps.pricing.services import run_kaspi_pricing_cycle


class Command(BaseCommand):
    help = "Checks readiness for a real local Kaspi Pricing Agent test without provider write-back."

    def add_arguments(self, parser):
        parser.add_argument("--business-id", type=int, default=0)
        parser.add_argument("--run-cycle", action="store_true", help="Run one pricing cycle after readiness checks.")
        parser.add_argument("--apply-autopilot", action="store_true", help="Apply autopilot rules during the cycle. Still simulated unless write-back is enabled.")
        parser.add_argument("--format", choices=["text", "json"], default="text")
        parser.add_argument("--fail-on-missing", action="store_true")

    def handle(self, *args, **options):
        business_id = options["business_id"] or None
        checks = self._build_checks(business_id=business_id)
        result = {
            "ready_for_local_real_test": all(check["status"] == "pass" for check in checks),
            "checks": checks,
            "cycle": None,
        }
        if options["run_cycle"] and result["ready_for_local_real_test"]:
            result["cycle"] = run_kaspi_pricing_cycle(business_id=business_id, apply_autopilot=options["apply_autopilot"])
        if options["format"] == "json":
            self.stdout.write(json.dumps(result, ensure_ascii=False, indent=2, default=str))
        else:
            self._write_text(result)
        if options["fail_on_missing"] and not result["ready_for_local_real_test"]:
            raise CommandError("Kaspi Pricing Agent local real-test prerequisites are missing.")

    def _build_checks(self, business_id=None):
        checks = [
            {
                "key": "pricing_tables",
                "status": "pass" if "pricing_kaspipricingrule" in connection.introspection.table_names() else "fail",
                "detail": "pricing tables available",
                "action": "Run migrations before testing the pricing product.",
            }
        ]
        if checks[0]["status"] == "fail":
            return checks

        rules = KaspiPricingRule.objects.filter(status=KaspiPricingRule.Statuses.ACTIVE)
        if business_id:
            rules = rules.filter(business_id=business_id)
        active_rules_count = rules.count()
        rules_with_offers = sum(1 for rule in rules if rule.competitor_offers.filter(available=True).exists())
        invalid_thresholds = rules.filter(min_price__lte=0).count()
        autopilot_rules = rules.filter(mode=KaspiPricingRule.Modes.AUTOPILOT).count()
        simulated_changes = KaspiPriceChangeLog.objects.filter(rule__in=rules, status=KaspiPriceChangeLog.Statuses.SIMULATED).count()

        checks.extend(
            [
                {
                    "key": "active_rules",
                    "status": "pass" if active_rules_count > 0 else "fail",
                    "detail": f"count={active_rules_count}",
                    "action": "Create at least one active pricing rule in /app/pricing.",
                },
                {
                    "key": "minimum_thresholds",
                    "status": "pass" if invalid_thresholds == 0 else "fail",
                    "detail": f"invalid_thresholds={invalid_thresholds}",
                    "action": "Every rule must have a positive minimum allowed price.",
                },
                {
                    "key": "competitor_prices",
                    "status": "pass" if rules_with_offers > 0 else "fail",
                    "detail": f"rules_with_competitor_offer={rules_with_offers}",
                    "action": "Run kaspi_collect_competitor_offers or use the UI collect/recommend flow before pricing cycles.",
                },
                {
                    "key": "autopilot_guardrails",
                    "status": "pass",
                    "detail": f"autopilot_rules={autopilot_rules}; simulated_changes={simulated_changes}",
                    "action": "Autopilot rules still respect min_price, max_changes_per_day and write-back feature flags.",
                },
            ]
        )
        return checks

    def _write_text(self, result):
        self.stdout.write(f"Kaspi Pricing local real-test ready: {result['ready_for_local_real_test']}")
        for check in result["checks"]:
            self.stdout.write(f"- {check['status'].upper()} {check['key']}: {check['detail']} | action: {check['action']}")
        if result["cycle"] is not None:
            self.stdout.write(f"Cycle: {result['cycle']}")
