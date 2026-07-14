from pathlib import Path

from django.core.management.base import BaseCommand

from apps.core.import_export import IMPORT_TEMPLATES


class Command(BaseCommand):
    help = "Write ZANI pilot import sample CSV files for clients, sales, and catalog."

    def add_arguments(self, parser):
        parser.add_argument(
            "--output-dir",
            default="docs/import_samples",
            help="Directory where sample CSV files will be written.",
        )

    def handle(self, *args, **options):
        output_dir = Path(options["output_dir"])
        output_dir.mkdir(parents=True, exist_ok=True)

        for entity_type, template in IMPORT_TEMPLATES.items():
            path = output_dir / f"{entity_type}_template.csv"
            headers = template["headers"]
            row = template["row"]
            path.write_text(
                ",".join(headers) + "\n" + ",".join(str(value) for value in row) + "\n",
                encoding="utf-8",
            )
            self.stdout.write(self.style.SUCCESS(f"Wrote {path}"))
