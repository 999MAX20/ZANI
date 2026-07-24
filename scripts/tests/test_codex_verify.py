from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path


SCRIPTS_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SCRIPTS_DIR))

import codex_verify  # noqa: E402


class SafeEnvironmentTests(unittest.TestCase):
    def test_live_values_are_overridden(self) -> None:
        environment = codex_verify.safe_environment(
            {
                "DATABASE_URL": "postgresql://production",
                "OPENAI_API_KEY": "live-secret",
                "OPENROUTER_API_KEY": "live-openrouter-secret",
                "SENTRY_DSN": "https://live@sentry.example/1",
                "TELEGRAM_ENABLED": "True",
                "E2E_BASE_URL": "https://production.example",
                "E2E_SKIP_LOCAL_SETUP": "true",
                "UNRELATED": "preserved",
            }
        )

        self.assertEqual(environment["DATABASE_URL"], "sqlite:///db.sqlite3")
        self.assertEqual(environment["OPENAI_API_KEY"], "")
        self.assertEqual(environment["OPENROUTER_API_KEY"], "")
        self.assertEqual(environment["SENTRY_DSN"], "")
        self.assertEqual(environment["TELEGRAM_ENABLED"], "False")
        self.assertEqual(environment["E2E_BASE_URL"], "http://127.0.0.1:5173")
        self.assertEqual(environment["E2E_SKIP_LOCAL_SETUP"], "false")
        self.assertEqual(environment["UNRELATED"], "preserved")


class LockValidationTests(unittest.TestCase):
    def test_hashed_lock_is_accepted(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "requirements.in").write_text("Django>=5,<6\n", encoding="utf-8")
            (root / "requirements.txt").write_text(
                "# generated with pip-compile from requirements.in\n"
                "django==5.2.1 \\\n"
                "    --hash=sha256:abc\n",
                encoding="utf-8",
            )
            self.write_dev_lock(root)

            codex_verify.validate_python_lock(root)

    def test_unpinned_lock_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "requirements.in").write_text("Django>=5,<6\n", encoding="utf-8")
            (root / "requirements.txt").write_text(
                "# generated with pip-compile from requirements.in\n"
                "Django>=5,<6\n"
                "--hash=sha256:abc\n",
                encoding="utf-8",
            )
            self.write_dev_lock(root)

            with self.assertRaises(codex_verify.GateError):
                codex_verify.validate_python_lock(root)

    @staticmethod
    def write_dev_lock(root: Path) -> None:
        (root / "requirements-dev.in").write_text(
            "-c requirements.txt\npip-audit==2.10.1\n",
            encoding="utf-8",
        )
        (root / "requirements-dev.txt").write_text(
            "# generated with pip-compile from requirements-dev.in\n"
            "pip-audit==2.10.1 \\\n"
            "    --hash=sha256:def\n",
            encoding="utf-8",
        )

    def test_frontend_lock_must_match_manifest(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            frontend = root / "frontend"
            frontend.mkdir()
            manifest = {
                "name": "example",
                "version": "1.0.0",
                "dependencies": {"react": "^18.0.0"},
                "devDependencies": {},
            }
            (frontend / "package.json").write_text(json.dumps(manifest), encoding="utf-8")
            (frontend / "package-lock.json").write_text(
                json.dumps(
                    {
                        "lockfileVersion": 3,
                        "packages": {
                            "": {
                                **manifest,
                                "dependencies": {"react": "^19.0.0"},
                            }
                        },
                    }
                ),
                encoding="utf-8",
            )

            with self.assertRaises(codex_verify.GateError):
                codex_verify.validate_frontend_lock(root)


class StagePlanTests(unittest.TestCase):
    def test_full_mode_covers_required_quality_dimensions(self) -> None:
        stages = codex_verify.build_stages(
            "full",
            python="python",
            npm="npm",
            git="git",
            backend_targets=("apps.core.tests_tenant_isolation",),
        )
        names = {stage.name for stage in stages}
        self.assertIn("Django migration drift", names)
        self.assertIn("Django tests", names)
        self.assertIn("Frontend build and i18n", names)
        self.assertIn("Frontend bundle budget", names)
        self.assertIn("Playwright mobile owner/manager smoke", names)
        self.assertIn("Python dependency audit", names)
        self.assertIn("Frontend dependency audit (high severity)", names)
        self.assertIn("Final diff hygiene (working tree)", names)

        django_tests = next(stage for stage in stages if stage.name == "Django tests")
        self.assertIn("apps.core.tests_tenant_isolation", django_tests.command)

    def test_static_mode_does_not_run_expensive_suites(self) -> None:
        stages = codex_verify.build_stages(
            "static",
            python="python",
            npm="npm",
            git="git",
        )
        names = {stage.name for stage in stages}
        self.assertNotIn("Django tests", names)
        self.assertNotIn("Frontend deterministic install", names)
        self.assertNotIn("Playwright mobile owner/manager smoke", names)


if __name__ == "__main__":
    unittest.main()
