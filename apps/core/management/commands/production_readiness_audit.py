import json

from django.core.management.base import BaseCommand, CommandError

from apps.core.production_audit import run_production_readiness_audit


class Command(BaseCommand):
    help = "Run a production-readiness audit for Zani infrastructure and settings."

    def add_arguments(self, parser):
        parser.add_argument(
            "--format",
            choices=["text", "json"],
            default="text",
            help="Output format.",
        )
        parser.add_argument(
            "--fail-on-critical",
            action="store_true",
            help="Exit with an error when critical production checks fail.",
        )

    def handle(self, *args, **options):
        audit = run_production_readiness_audit()

        if options["format"] == "json":
            self.stdout.write(json.dumps(audit, indent=2, ensure_ascii=False))
        else:
            self._write_text_report(audit)

        if options["fail_on_critical"] and audit["summary"]["fail"]:
            raise CommandError(f"Production readiness audit has {audit['summary']['fail']} critical failure(s).")

    def _write_text_report(self, audit: dict):
        self.stdout.write("Zani production readiness audit")
        self.stdout.write(f"Environment: {audit['environment']}")
        self.stdout.write(f"Release: {audit['release']}")
        self.stdout.write(
            f"Summary: {audit['summary']['pass']} passed, {audit['summary']['warn']} warnings, {audit['summary']['fail']} critical failures"
        )
        self.stdout.write("")

        for item in audit["items"]:
            marker = {"pass": "PASS", "warn": "WARN", "fail": "FAIL"}[item["status"]]
            self.stdout.write(f"[{marker}] {item['title']} ({item['key']})")
            self.stdout.write(f"  Detail: {item['detail']}")
            if item["status"] != "pass":
                self.stdout.write(f"  Action: {item['action']}")
            self.stdout.write("")
