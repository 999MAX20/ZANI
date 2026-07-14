import json

from django.core.management.base import BaseCommand

from apps.pricing.services import run_kaspi_pricing_cycle


class Command(BaseCommand):
    help = "Runs the Kaspi Pricing Agent cycle for active pricing rules."

    def add_arguments(self, parser):
        parser.add_argument("--business-id", type=int, default=0)
        parser.add_argument("--apply-autopilot", action="store_true", help="Apply recommendations for rules in autopilot mode.")
        parser.add_argument("--format", choices=["text", "json"], default="text")

    def handle(self, *args, **options):
        summary = run_kaspi_pricing_cycle(
            business_id=options["business_id"] or None,
            apply_autopilot=options["apply_autopilot"],
        )
        if options["format"] == "json":
            self.stdout.write(json.dumps(summary, ensure_ascii=False, indent=2, default=str))
            return

        self.stdout.write(f"Kaspi pricing cycle checked rules: {summary['rules_checked']}")
        self.stdout.write(f"Recommendations created: {summary['recommendations_created']}")
        self.stdout.write(f"Blocked recommendations: {summary['blocked']}")
        self.stdout.write(f"Offers collected: {summary['offers_collected']}")
        self.stdout.write(f"Monitor errors: {summary['monitor_errors']}")
        self.stdout.write(f"Autopilot applied: {summary['autopilot_applied']}")
        self.stdout.write(f"Autopilot blocked: {summary['autopilot_blocked']}")
