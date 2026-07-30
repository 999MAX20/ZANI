from __future__ import annotations

import json
import socket
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


SCRIPTS_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SCRIPTS_DIR))

import codex_verify  # noqa: E402


class SafeEnvironmentTests(unittest.TestCase):
    def test_live_values_are_removed_or_overridden(self) -> None:
        database_path = Path(tempfile.gettempdir()) / "zani-gate-test.sqlite3"
        environment = codex_verify.safe_environment(
            database_path=database_path,
            python=sys.executable,
            django_port=18001,
            frontend_port=15174,
            base={
                "DATABASE_URL": "postgresql://production",
                "E2E_PYTHON": "C:/unsafe/python.exe",
                "E2E_PASSWORD": "live-password",
                "E2E_PLATFORM_EMAIL": "admin@production.example",
                "OPENAI_API_KEY": "live-secret",
                "OPENROUTER_API_KEY": "live-openrouter-secret",
                "KASPI_PRICE_WRITE_API_KEY": "live-kaspi-secret",
                "AWS_SECRET_ACCESS_KEY": "live-aws-secret",
                "EMAIL_HOST_PASSWORD": "live-smtp-secret",
                "SENTRY_DSN": "https://live@sentry.example/1",
                "VITE_APPLE_CLIENT_ID": "live-apple-client",
                "VITE_CRM_KANBAN_DEFAULT": "true",
                "VITE_CRM_UNIFIED_DESIGN": "true",
                "VITE_GOOGLE_CLIENT_ID": "live-google-client",
                "VITE_PLAUSIBLE_DOMAIN": "production.example",
                "VITE_POSTHOG_HOST": "https://live-posthog.example",
                "VITE_POSTHOG_KEY": "live-posthog-key",
                "VITE_SENTRY_DSN": "https://live-vite@sentry.example/1",
                "VITE_SENTRY_TRACES_SAMPLE_RATE": "1",
                "TELEGRAM_ENABLED": "True",
                "E2E_BASE_URL": "https://production.example",
                "E2E_SKIP_LOCAL_SETUP": "true",
                "UNRELATED": "preserved",
            },
        )

        self.assertEqual(
            environment["DATABASE_URL"],
            f"sqlite:///{database_path.resolve().as_posix()}",
        )
        self.assertEqual(environment["E2E_PYTHON"], str(Path(sys.executable).resolve()))
        self.assertEqual(environment["E2E_PASSWORD"], "ZaniTest123!")
        self.assertEqual(environment["E2E_PLATFORM_EMAIL"], "platform_admin@example.com")
        self.assertEqual(environment["OPENAI_API_KEY"], "")
        self.assertEqual(environment["OPENROUTER_API_KEY"], "")
        self.assertEqual(environment["KASPI_PRICE_WRITE_API_KEY"], "")
        self.assertEqual(environment["AWS_SECRET_ACCESS_KEY"], "")
        self.assertEqual(environment["EMAIL_HOST_PASSWORD"], "")
        self.assertEqual(environment["SENTRY_DSN"], "")
        self.assertEqual(environment["TELEGRAM_ENABLED"], "False")
        self.assertEqual(
            environment["WHATSAPP_EMBEDDED_SIGNUP_LOGIN_URL"],
            "https://www.facebook.com/dialog/oauth",
        )
        self.assertEqual(environment["E2E_BASE_URL"], "http://127.0.0.1:15174")
        self.assertEqual(environment["E2E_API_BASE_URL"], "http://127.0.0.1:18001")
        self.assertEqual(environment["CORS_ALLOWED_ORIGINS"], "http://127.0.0.1:15174")
        self.assertEqual(environment["CSRF_TRUSTED_ORIGINS"], "http://127.0.0.1:15174")
        self.assertEqual(environment["E2E_SKIP_LOCAL_SETUP"], "false")
        self.assertEqual(environment["E2E_REUSE_EXISTING_SERVER"], "false")
        self.assertEqual(environment["VITE_API_URL"], "http://127.0.0.1:18001")
        for key, value in codex_verify.VITE_SAFE_ENV.items():
            self.assertEqual(environment[key], value)
        self.assertNotIn("UNRELATED", environment)

    def test_all_tracked_vite_runtime_variables_have_safe_gate_values(self) -> None:
        database_path = Path(tempfile.gettempdir()) / "zani-gate-test.sqlite3"
        environment = codex_verify.safe_environment(
            database_path=database_path,
            python=sys.executable,
            django_port=18001,
            frontend_port=15174,
            base={},
        )
        git = codex_verify.find_executable("git")

        self.assertEqual(
            codex_verify.tracked_vite_runtime_variables(git),
            {"VITE_API_URL", *codex_verify.VITE_SAFE_ENV},
        )
        codex_verify.validate_vite_environment_policy(git, environment)

    def test_runtime_uses_disposable_database_and_non_default_ports(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            developer_database = Path(directory) / "db.sqlite3"
            developer_database.write_bytes(b"developer-data-must-survive")

            with codex_verify.isolated_runtime(
                python=sys.executable,
                base={
                    "DATABASE_URL": f"sqlite:///{developer_database.as_posix()}",
                    "E2E_BASE_URL": "http://127.0.0.1:5173",
                    "E2E_API_BASE_URL": "http://127.0.0.1:8000",
                },
            ) as runtime:
                runtime.database_path.write_bytes(b"gate-data")
                gate_database = runtime.database_path
                self.assertNotEqual(gate_database.resolve(), developer_database.resolve())
                self.assertNotIn(runtime.django_port, {8000, 5173})
                self.assertNotIn(runtime.frontend_port, {8000, 5173})
                self.assertEqual(
                    runtime.environment["DATABASE_URL"],
                    f"sqlite:///{gate_database.resolve().as_posix()}",
                )
                self.assertNotEqual(
                    runtime.environment["E2E_BASE_URL"],
                    "http://127.0.0.1:5173",
                )
                self.assertNotEqual(
                    runtime.environment["E2E_API_BASE_URL"],
                    "http://127.0.0.1:8000",
                )

            self.assertFalse(gate_database.exists())
            self.assertEqual(
                developer_database.read_bytes(),
                b"developer-data-must-survive",
            )

    def test_port_preflight_rejects_an_existing_server(self) -> None:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as server:
            server.bind(("127.0.0.1", 0))
            port = int(server.getsockname()[1])
            server.listen()
            with self.assertRaisesRegex(
                codex_verify.GateError,
                "refusing to reuse a server",
            ):
                codex_verify.assert_ports_available((port,))


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
    BASE_SHA = "1" * 40

    def test_full_mode_covers_required_quality_dimensions(self) -> None:
        stages = codex_verify.build_stages(
            "full",
            base_sha=self.BASE_SHA,
            python="python",
            npm="npm",
            git="git",
            browser_ports=(18001, 15174),
        )
        names = {stage.name for stage in stages}
        self.assertIn("Django migration drift", names)
        self.assertIn("Django tests", names)
        self.assertIn("Frontend build and i18n", names)
        self.assertIn("Frontend bundle budget", names)
        self.assertIn("Playwright mobile role smoke", names)
        self.assertIn("Python dependency audit", names)
        self.assertIn("Frontend dependency audit (moderate severity)", names)
        self.assertIn("Diff hygiene (committed range)", names)
        self.assertIn("Vite gate environment isolation", names)
        self.assertIn("Final diff hygiene (working tree)", names)

        django_tests = next(stage for stage in stages if stage.name == "Django tests")
        self.assertEqual(
            django_tests.command,
            ("python", "manage.py", "test", "-v", "2"),
        )
        browser = next(
            stage
            for stage in stages
            if stage.name == "Playwright mobile role smoke"
        )
        self.assertEqual(browser.preflight_ports, (18001, 15174))
        self.assertIn("e2e/smoke.spec.ts", browser.command)
        self.assertIn("mobile (owner|manager) smoke", browser.command)
        committed_range = next(
            stage for stage in stages if stage.name == "Diff hygiene (committed range)"
        )
        self.assertEqual(
            committed_range.command,
            ("git", "diff", "--check", f"{self.BASE_SHA}...HEAD"),
        )

    def test_backend_targets_are_scoped_to_backend_mode(self) -> None:
        stages = codex_verify.build_stages(
            "backend",
            base_sha=self.BASE_SHA,
            python="python",
            npm="npm",
            git="git",
            backend_targets=("apps.core.tests_tenant_isolation",),
        )
        django_tests = next(stage for stage in stages if stage.name == "Django tests")
        self.assertIn("apps.core.tests_tenant_isolation", django_tests.command)

        with self.assertRaisesRegex(codex_verify.GateError, "only with --mode backend"):
            codex_verify.build_stages(
                "full",
                base_sha=self.BASE_SHA,
                python="python",
                npm="npm",
                git="git",
                backend_targets=("apps.core.tests_tenant_isolation",),
            )

    def test_cli_rejects_backend_target_outside_backend_mode(self) -> None:
        with self.assertRaises(SystemExit):
            codex_verify.parse_args(
                [
                    "--mode",
                    "full",
                    "--base-ref",
                    "HEAD~1",
                    "--backend-target",
                    "apps.core.tests_tenant_isolation",
                ]
            )

    def test_static_mode_does_not_run_expensive_suites(self) -> None:
        stages = codex_verify.build_stages(
            "static",
            base_sha=self.BASE_SHA,
            python="python",
            npm="npm",
            git="git",
        )
        names = {stage.name for stage in stages}
        self.assertNotIn("Django tests", names)
        self.assertNotIn("Frontend deterministic install", names)
        self.assertNotIn("Playwright mobile role smoke", names)


class BaseRefValidationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.directory = tempfile.TemporaryDirectory()
        self.root = Path(self.directory.name)
        self.git = codex_verify.find_executable("git")
        self.run_git("init", "-q")
        self.run_git("config", "user.email", "gate@example.invalid")
        self.run_git("config", "user.name", "Zani Gate")
        (self.root / "tracked.txt").write_text("base\n", encoding="utf-8")
        self.run_git("add", "tracked.txt")
        self.run_git("commit", "-q", "-m", "base")
        self.base_sha = self.run_git("rev-parse", "HEAD").stdout.strip()
        (self.root / "tracked.txt").write_text("head\n", encoding="utf-8")
        self.run_git("commit", "-q", "-am", "head")
        self.head_sha = self.run_git("rev-parse", "HEAD").stdout.strip()

    def tearDown(self) -> None:
        self.directory.cleanup()

    def run_git(self, *arguments: str) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            (self.git, *arguments),
            cwd=self.root,
            check=True,
            capture_output=True,
            text=True,
            encoding="utf-8",
        )

    def test_ancestor_base_resolves_to_commit_sha(self) -> None:
        self.assertEqual(
            codex_verify.resolve_base_ref(self.git, self.base_sha, root=self.root),
            self.base_sha,
        )

    def test_invalid_base_is_rejected(self) -> None:
        with self.assertRaisesRegex(codex_verify.GateError, "not an available commit"):
            codex_verify.resolve_base_ref(
                self.git,
                "refs/heads/missing",
                root=self.root,
            )

    def test_non_ancestor_base_is_rejected(self) -> None:
        self.run_git("checkout", "-q", "-b", "sibling", self.base_sha)
        (self.root / "sibling.txt").write_text("sibling\n", encoding="utf-8")
        self.run_git("add", "sibling.txt")
        self.run_git("commit", "-q", "-m", "sibling")
        sibling_sha = self.run_git("rev-parse", "HEAD").stdout.strip()
        self.run_git("checkout", "-q", self.head_sha)

        with self.assertRaisesRegex(codex_verify.GateError, "not an ancestor"):
            codex_verify.resolve_base_ref(
                self.git,
                sibling_sha,
                root=self.root,
            )

    def test_head_base_is_rejected_as_empty_range(self) -> None:
        with self.assertRaisesRegex(codex_verify.GateError, "resolves to HEAD"):
            codex_verify.resolve_base_ref(
                self.git,
                self.head_sha,
                root=self.root,
            )


if __name__ == "__main__":
    unittest.main()
