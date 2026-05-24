import json
from io import StringIO
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from django.test import SimpleTestCase

from scripts import api_load_smoke


class ApiLoadSmokeScriptTests(SimpleTestCase):
    def test_with_query_adds_business_scope(self):
        self.assertEqual(api_load_smoke.with_query("/api/leads/", {"business": 7}), "/api/leads/?business=7")
        self.assertEqual(api_load_smoke.with_query("/api/leads/?page=1", {"business": 7}), "/api/leads/?page=1&business=7")

    def test_main_writes_json_baseline_without_secret_values(self):
        calls = []

        def fake_request_json(method, url, token=None, payload=None, timeout=15):
            calls.append({"method": method, "url": url, "token": token, "payload": payload, "timeout": timeout})
            if url.endswith("/api/auth/token/"):
                return 10.0, {"access": "access-token"}
            return 20.0, {"results": []}

        with TemporaryDirectory() as tmp_dir:
            output_file = Path(tmp_dir) / "baseline.json"
            argv = [
                "api_load_smoke.py",
                "--api-base-url",
                "https://api.example.com",
                "--email",
                "owner@example.com",
                "--password",
                "secret-password",
                "--iterations",
                "1",
                "--business-id",
                "3",
                "--output-file",
                str(output_file),
            ]
            with patch("sys.argv", argv), patch("scripts.api_load_smoke.request_json", side_effect=fake_request_json):
                with patch("sys.stdout", new_callable=StringIO):
                    exit_code = api_load_smoke.main()

            self.assertEqual(exit_code, 0)
            payload = json.loads(output_file.read_text(encoding="utf-8"))
            self.assertEqual(payload["business_id"], "3")
            self.assertEqual(payload["iterations"], 1)
            self.assertFalse(payload["errors"])
            self.assertNotIn("secret-password", output_file.read_text(encoding="utf-8"))
            self.assertTrue(any(call["url"].endswith("/api/business-connectors/?business=3") for call in calls))
