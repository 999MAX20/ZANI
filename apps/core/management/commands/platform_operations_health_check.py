import json

from django.core.management.base import BaseCommand, CommandError
from django.core.serializers.json import DjangoJSONEncoder

from apps.core.operations_health import platform_operations_health


class Command(BaseCommand):
    help = "Print platform operations health and optionally fail when critical items exist."

    def add_arguments(self, parser):
        parser.add_argument("--format", choices=["text", "json"], default="text")
        parser.add_argument("--fail-on-critical", action="store_true")

    def handle(self, *args, **options):
        report = platform_operations_health()
        if options["format"] == "json":
            self.stdout.write(json.dumps(report, ensure_ascii=False, indent=2, cls=DjangoJSONEncoder))
        else:
            self._write_text(report)

        if options["fail_on_critical"] and report["status"] == "critical":
            raise CommandError(f"Platform operations health is critical: {report['summary']['critical']} issue(s).")

    def _write_text(self, report):
        self.stdout.write("Zani platform operations health")
        self.stdout.write(f"Environment: {report['environment']}")
        self.stdout.write(f"Release: {report['release']}")
        self.stdout.write(f"Status: {report['status']}")
        self.stdout.write(
            "Summary: critical={critical}, warning={warning}, active_support_grants={active_support_grants}, "
            "connector_requests={connector_requests}".format(**report["summary"])
        )
        queue = report["runtime"]["queue"]
        self.stdout.write(
            "Queue: broker_configured={broker_configured}, automation_inline={automation_inline}, "
            "failed_automation_runs={failed}".format(
                broker_configured=queue["broker_configured"],
                automation_inline=queue["automation_inline"],
                failed=queue["automation_runs"]["failed"],
            )
        )
