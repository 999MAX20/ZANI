import csv
import shutil
import tempfile
from pathlib import Path

from django.core.management import call_command
from django.test import SimpleTestCase

from apps.core.import_export import IMPORT_TEMPLATES, read_tabular_file
from apps.core.models import ImportJob


class PilotImportSamplesTests(SimpleTestCase):
    def test_committed_pilot_import_samples_are_parseable(self):
        base_dir = Path(__file__).resolve().parents[2]
        samples_dir = base_dir / "docs" / "import_samples"

        expected = {
            ImportJob.EntityTypes.CLIENTS: samples_dir / "clients_template.csv",
            ImportJob.EntityTypes.SALES: samples_dir / "sales_template.csv",
            ImportJob.EntityTypes.CATALOG: samples_dir / "catalog_template.csv",
        }

        for entity_type, path in expected.items():
            self.assertTrue(path.exists(), f"Missing sample file for {entity_type}: {path}")
            rows = read_tabular_file(path)
            self.assertGreaterEqual(len(rows), 1)
            headers = set(rows[0].keys())
            for required_header in IMPORT_TEMPLATES[entity_type]["headers"]:
                self.assertIn(required_header, headers)

    def test_write_import_samples_command_outputs_current_backend_templates(self):
        temp_dir = Path(tempfile.mkdtemp())
        try:
            call_command("write_import_samples", output_dir=str(temp_dir), verbosity=0)
            for entity_type, template in IMPORT_TEMPLATES.items():
                path = temp_dir / f"{entity_type}_template.csv"
                self.assertTrue(path.exists())
                with path.open(encoding="utf-8") as file:
                    reader = csv.DictReader(file)
                    row = next(reader)
                self.assertEqual(list(row.keys()), template["headers"])
        finally:
            shutil.rmtree(temp_dir, ignore_errors=True)
