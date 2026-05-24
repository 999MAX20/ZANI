import json

from django.core.management.base import BaseCommand, CommandError

from apps.core.paid_beta_gate import run_paid_beta_gate_check


class Command(BaseCommand):
    help = "Checks whether Zani is allowed to enter real paid beta."

    def add_arguments(self, parser):
        parser.add_argument("--format", choices=["text", "json"], default="text")
        parser.add_argument("--fail-on-blockers", action="store_true")

    def handle(self, *args, **options):
        report = run_paid_beta_gate_check()
        if options["format"] == "json":
            self.stdout.write(json.dumps(report, ensure_ascii=False, indent=2))
        else:
            self.stdout.write(f"Paid beta gate: allowed={report['allowed']} ({report['environment']} / {report['release']})")
            self.stdout.write(f"Summary: pass={report['summary']['pass']}, fail={report['summary']['fail']}")
            for item in report["items"]:
                self.stdout.write(f"- {item['status'].upper()} {item['key']}: {item['detail']} | action: {item['action']}")

        if options["fail_on_blockers"] and not report["allowed"]:
            raise CommandError(f"Paid beta is blocked by {report['summary']['fail']} gate(s).")
