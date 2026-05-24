import json

from django.core.management.base import BaseCommand, CommandError

from apps.core.backup_readiness import run_backup_restore_readiness_check


class Command(BaseCommand):
    help = "Check whether database/storage backup prerequisites are ready for paid beta drills."

    def add_arguments(self, parser):
        parser.add_argument("--format", choices=["text", "json"], default="text")
        parser.add_argument("--fail-on-blockers", action="store_true")

    def handle(self, *args, **options):
        report = run_backup_restore_readiness_check()
        if options["format"] == "json":
            self.stdout.write(json.dumps(report, indent=2, ensure_ascii=False))
        else:
            self._write_text(report)
        if options["fail_on_blockers"] and report["summary"]["paid_beta_blockers"]:
            raise CommandError(f"Backup readiness has {report['summary']['paid_beta_blockers']} paid-beta blocker(s).")

    def _write_text(self, report):
        self.stdout.write("Zani backup/restore readiness check")
        self.stdout.write(f"Environment: {report['environment']}")
        self.stdout.write(
            f"Summary: {report['summary']['pass']} passed, {report['summary']['fail']} failed, "
            f"{report['summary']['paid_beta_blockers']} paid-beta blocker(s)"
        )
        self.stdout.write("")
        for item in report["items"]:
            marker = "PASS" if item["status"] == "pass" else "FAIL"
            self.stdout.write(f"[{marker}] {item['title']} ({item['key']})")
            self.stdout.write(f"  Detail: {item['detail']}")
            if item["status"] != "pass":
                self.stdout.write(f"  Action: {item['action']}")
            self.stdout.write("")
