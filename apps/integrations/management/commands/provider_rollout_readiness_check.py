import json

from django.core.management.base import BaseCommand, CommandError

from apps.integrations.provider_rollout import PROVIDER_ROLLOUT_ORDER, run_provider_rollout_readiness_check


class Command(BaseCommand):
    help = "Checks whether external providers can be safely enabled in the approved rollout order."

    def add_arguments(self, parser):
        parser.add_argument(
            "--provider",
            choices=PROVIDER_ROLLOUT_ORDER,
            help="Check only one provider rollout key.",
        )
        parser.add_argument(
            "--format",
            choices=["text", "json"],
            default="text",
            help="Output format.",
        )
        parser.add_argument(
            "--fail-on-blockers",
            action="store_true",
            help="Exit with an error if any selected provider has critical blockers.",
        )

    def handle(self, *args, **options):
        result = run_provider_rollout_readiness_check(provider=options.get("provider"))

        if options["format"] == "json":
            self.stdout.write(json.dumps(result, ensure_ascii=False, indent=2))
        else:
            self._write_text(result)

        if options["fail_on_blockers"] and result["summary"]["blocked"]:
            raise CommandError(f"Provider rollout blockers found: {result['summary']['blocked']}")

    def _write_text(self, result):
        self.stdout.write(f"Provider rollout readiness: {result['environment']} / {result['release']}")
        self.stdout.write(
            "Summary: ready={ready}, warning={warning}, blocked={blocked}, enabled={enabled}".format(
                **result["summary"]
            )
        )
        for provider in result["providers"]:
            self.stdout.write("")
            self.stdout.write(f"{provider['order']}. {provider['title']} [{provider['status']}] enabled={provider['enabled']}")
            for gate in provider["gates"]:
                self.stdout.write(
                    f"  - {gate['status'].upper()} {gate['key']}: {gate['detail']} | action: {gate['action']}"
                )
