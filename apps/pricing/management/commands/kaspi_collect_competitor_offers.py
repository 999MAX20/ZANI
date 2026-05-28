import json

from django.core.management.base import BaseCommand

from apps.pricing.models import KaspiPricingRule
from apps.pricing.services import collect_kaspi_competitor_offers


class Command(BaseCommand):
    help = "Collects competitor offers for active Kaspi pricing rules."

    def add_arguments(self, parser):
        parser.add_argument("--business-id", type=int, default=0)
        parser.add_argument("--provider", default="")
        parser.add_argument("--format", choices=["text", "json"], default="text")

    def handle(self, *args, **options):
        rules = KaspiPricingRule.objects.filter(status=KaspiPricingRule.Statuses.ACTIVE)
        if options["business_id"]:
            rules = rules.filter(business_id=options["business_id"])
        results = [collect_kaspi_competitor_offers(rule, provider_key=options["provider"] or None) for rule in rules]
        summary = {
            "rules_checked": rules.count(),
            "offers_created": sum(item["offers_created"] for item in results),
            "errors": [item["error"] for item in results if item["error"]],
            "results": results,
        }
        if options["format"] == "json":
            self.stdout.write(json.dumps(summary, ensure_ascii=False, indent=2, default=str))
            return
        self.stdout.write(f"Rules checked: {summary['rules_checked']}")
        self.stdout.write(f"Offers created: {summary['offers_created']}")
        for error in summary["errors"]:
            self.stdout.write(self.style.ERROR(error))
