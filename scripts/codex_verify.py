#!/usr/bin/env python3
"""Deterministic, production-credential-free local quality gate for ZANI."""

from __future__ import annotations

import argparse
import contextlib
import json
import os
import re
import shutil
import socket
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Sequence


ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT / "frontend"
MODES = ("static", "backend", "frontend", "browser", "security", "full")
PASSTHROUGH_ENV_KEYS = {
    "APPDATA",
    "CI",
    "COMSPEC",
    "FORCE_COLOR",
    "HOME",
    "LOCALAPPDATA",
    "NO_COLOR",
    "PATH",
    "PATHEXT",
    "PROGRAMFILES",
    "PROGRAMFILES(X86)",
    "PROGRAMW6432",
    "SYSTEMDRIVE",
    "SYSTEMROOT",
    "TEMP",
    "TERM",
    "TMP",
    "USERPROFILE",
    "WINDIR",
}
SAFE_ENV = {
    "ENVIRONMENT": "development",
    "DEBUG": "False",
    "SECRET_KEY": "zani-local-quality-gate-secret-key-2026-not-for-production",
    "SECURE_SSL_REDIRECT": "False",
    "SESSION_COOKIE_SECURE": "False",
    "CSRF_COOKIE_SECURE": "False",
    "REDIS_URL": "memory://",
    "CELERY_TASK_ALWAYS_EAGER": "True",
    "CELERY_TASK_STORE_EAGER_RESULT": "False",
    "AUTOMATIONS_RUN_INLINE": "True",
    "AI_PROVIDER": "mock",
    "AI_ENABLED": "True",
    "OPENAI_API_KEY": "",
    "OPENAI_BASE_URL": "",
    "OPENAI_MODEL": "mock-ai",
    "OPENROUTER_API_KEY": "",
    "OPENROUTER_BASE_URL": "",
    "OPENROUTER_SITE_URL": "",
    "KIMI_API_KEY": "",
    "KIMI_BASE_URL": "",
    "SENTRY_DSN": "",
    "SENTRY_TRACES_SAMPLE_RATE": "0",
    "TELEGRAM_ENABLED": "False",
    "TELEGRAM_BASE_API_URL": "",
    "TELEGRAM_WEBHOOK_SECRET": "",
    "WHATSAPP_ENABLED": "False",
    "WHATSAPP_GRAPH_BASE_URL": "",
    "WHATSAPP_VERIFY_TOKEN": "",
    "WHATSAPP_APP_SECRET": "",
    "WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID": "",
    "WHATSAPP_EMBEDDED_SIGNUP_LOGIN_URL": "https://www.facebook.com/dialog/oauth",
    "INSTAGRAM_ENABLED": "False",
    "INSTAGRAM_GRAPH_BASE_URL": "",
    "INSTAGRAM_VERIFY_TOKEN": "",
    "INSTAGRAM_APP_SECRET": "",
    "META_APP_ID": "",
    "META_APP_SECRET": "",
    "KASPI_ENABLED": "False",
    "KASPI_REPRICING_ENABLED": "False",
    "KASPI_REPRICING_WRITE_ENABLED": "False",
    "KASPI_REPRICING_SCHEDULE_ENABLED": "False",
    "KASPI_REPRICING_APPLY_AUTOPILOT": "False",
    "KASPI_API_BASE_URL": "",
    "KASPI_PRICE_WRITE_API_URL": "",
    "KASPI_PRICE_WRITE_API_KEY": "",
    "KASPI_COMPETITOR_MONITOR_API_URL": "",
    "KASPI_COMPETITOR_MONITOR_API_KEY": "",
    "MOYSKLAD_ENABLED": "False",
    "MOYSKLAD_API_BASE_URL": "",
    "WILDBERRIES_ENABLED": "False",
    "WILDBERRIES_STATISTICS_API_BASE_URL": "",
    "OZON_ENABLED": "False",
    "OZON_SELLER_API_BASE_URL": "",
    "USE_S3": "False",
    "AWS_ACCESS_KEY_ID": "",
    "AWS_SECRET_ACCESS_KEY": "",
    "AWS_SESSION_TOKEN": "",
    "AWS_STORAGE_BUCKET_NAME": "",
    "AWS_S3_ENDPOINT_URL": "",
    "AWS_S3_REGION_NAME": "",
    "SUPABASE_PROJECT_REF": "",
    "SUPABASE_DB_PASSWORD": "",
    "SUPABASE_DB_USER": "",
    "SUPABASE_DB_HOST": "",
    "SUPABASE_DB_POOLER_HOST": "",
    "EMAIL_BACKEND": "django.core.mail.backends.locmem.EmailBackend",
    "EMAIL_HOST": "",
    "EMAIL_HOST_USER": "",
    "EMAIL_HOST_PASSWORD": "",
    "EMAIL_USE_TLS": "False",
    "DEFAULT_FROM_EMAIL": "Zani Gate <gate@example.invalid>",
    "E2E_SKIP_LOCAL_SETUP": "false",
    "E2E_REUSE_EXISTING_SERVER": "false",
    "E2E_PASSWORD": "ZaniTest123!",
    "E2E_PLATFORM_EMAIL": "platform_admin@example.com",
    "E2E_OWNER_EMAIL": "business_owner@example.com",
    "E2E_MANAGER_EMAIL": "business_manager@example.com",
    "E2E_OPERATOR_EMAIL": "business_operator@example.com",
    "E2E_DOCTOR_EMAIL": "business_doctor@example.com",
    "E2E_BUSINESS_SLUG": "zani-e2e-gate",
    "E2E_BUSINESS_NAME": "Zani E2E Quality Gate",
    "ZANI_QUALITY_GATE": "1",
}


class GateError(RuntimeError):
    """Actionable local quality-gate failure."""


@dataclass(frozen=True)
class Stage:
    name: str
    command: tuple[str, ...]
    cwd: Path = ROOT
    preflight_ports: tuple[int, ...] = ()


@dataclass(frozen=True)
class GateRuntime:
    database_path: Path
    django_port: int
    frontend_port: int
    environment: dict[str, str]


def safe_environment(
    *,
    database_path: Path,
    python: str,
    django_port: int,
    frontend_port: int,
    base: dict[str, str] | None = None,
) -> dict[str, str]:
    """Return an environment that cannot inherit live provider/runtime settings."""
    inherited = os.environ if base is None else base
    environment = {
        key: value
        for key, value in inherited.items()
        if key.upper() in PASSTHROUGH_ENV_KEYS
    }
    environment.update(SAFE_ENV)
    django_url = f"http://127.0.0.1:{django_port}"
    frontend_url = f"http://127.0.0.1:{frontend_port}"
    environment.update(
        {
            "ALLOWED_HOSTS": "localhost,127.0.0.1",
            "CORS_ALLOWED_ORIGINS": frontend_url,
            "CORS_ALLOW_CREDENTIALS": "True",
            "CSRF_TRUSTED_ORIGINS": frontend_url,
            "DATABASE_URL": f"sqlite:///{database_path.resolve().as_posix()}",
            "E2E_PYTHON": str(Path(python).resolve()),
            "E2E_DJANGO_PORT": str(django_port),
            "E2E_FRONTEND_PORT": str(frontend_port),
            "E2E_API_BASE_URL": django_url,
            "E2E_BASE_URL": frontend_url,
            "VITE_API_URL": django_url,
        }
    )
    return environment


def find_available_port(excluded: Sequence[int] = ()) -> int:
    while True:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as server:
            server.bind(("127.0.0.1", 0))
            port = int(server.getsockname()[1])
        if port not in excluded:
            return port


def assert_ports_available(ports: Sequence[int]) -> None:
    for port in ports:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as server:
            try:
                server.bind(("127.0.0.1", port))
            except OSError as exc:
                raise GateError(
                    f"Quality-gate port {port} is already in use; refusing to reuse a server."
                ) from exc


@contextlib.contextmanager
def isolated_runtime(
    *,
    python: str,
    base: dict[str, str] | None = None,
) -> Iterable[GateRuntime]:
    """Yield a disposable database and dedicated ports, then remove all runtime state."""
    with tempfile.TemporaryDirectory(prefix="zani-quality-gate-") as directory:
        database_path = Path(directory) / "gate.sqlite3"
        django_port = find_available_port((8000, 5173))
        frontend_port = find_available_port((8000, 5173, django_port))
        environment = safe_environment(
            database_path=database_path,
            python=python,
            django_port=django_port,
            frontend_port=frontend_port,
            base=base,
        )
        yield GateRuntime(
            database_path=database_path,
            django_port=django_port,
            frontend_port=frontend_port,
            environment=environment,
        )


def canonical_name(value: str) -> str:
    return re.sub(r"[-_.]+", "-", value).lower()


def direct_requirement_names(requirements_in: Path) -> set[str]:
    names: set[str] = set()
    for raw_line in requirements_in.read_text(encoding="utf-8").splitlines():
        line = raw_line.split("#", 1)[0].strip()
        if not line:
            continue
        if line.startswith(("-c ", "--constraint ", "-r ", "--requirement ")):
            continue
        match = re.match(r"^([A-Za-z0-9_.-]+)", line)
        if not match:
            raise GateError(f"Unsupported requirement in {requirements_in}: {raw_line}")
        names.add(canonical_name(match.group(1)))
    return names


def locked_requirement_names(lock_text: str, lock_name: str) -> set[str]:
    names: set[str] = set()
    for raw_line in lock_text.splitlines():
        if not raw_line or raw_line[0].isspace() or raw_line.startswith("#"):
            continue
        match = re.match(r"^([A-Za-z0-9_.-]+)==[^\s\\]+(?:\s*\\)?$", raw_line)
        if not match:
            raise GateError(f"Unpinned or malformed entry in {lock_name}: {raw_line}")
        names.add(canonical_name(match.group(1)))
    return names


def validate_python_lock(root: Path = ROOT) -> None:
    requirements_in = root / "requirements.in"
    requirements_lock = root / "requirements.txt"
    if not requirements_in.is_file() or not requirements_lock.is_file():
        raise GateError("requirements.in and the generated requirements.txt lock are required.")

    lock_text = requirements_lock.read_text(encoding="utf-8")
    if "pip-compile" not in lock_text or "requirements.in" not in lock_text:
        raise GateError(
            "requirements.txt is not a generated lock. Regenerate it from requirements.in "
            "with pip-compile --generate-hashes."
        )

    locked_names = locked_requirement_names(lock_text, "requirements.txt")
    missing = sorted(direct_requirement_names(requirements_in) - locked_names)
    if missing:
        raise GateError(f"Direct requirements missing from requirements.txt: {', '.join(missing)}")
    if "--hash=sha256:" not in lock_text:
        raise GateError("requirements.txt must include hashes for reproducible installs.")

    dev_in = root / "requirements-dev.in"
    dev_lock = root / "requirements-dev.txt"
    if not dev_in.is_file() or not dev_lock.is_file():
        raise GateError(
            "requirements-dev.in and its generated requirements-dev.txt lock are required."
        )
    dev_lock_text = dev_lock.read_text(encoding="utf-8")
    if (
        "pip-compile" not in dev_lock_text
        or "requirements-dev.in" not in dev_lock_text
        or "--hash=sha256:" not in dev_lock_text
    ):
        raise GateError(
            "requirements-dev.txt must be a hashed pip-compile lock generated "
            "from requirements-dev.in."
        )
    missing_dev = sorted(
        direct_requirement_names(dev_in)
        - locked_requirement_names(dev_lock_text, "requirements-dev.txt")
    )
    if missing_dev:
        raise GateError(
            f"Direct verification requirements missing from requirements-dev.txt: "
            f"{', '.join(missing_dev)}"
        )


def validate_frontend_lock(root: Path = ROOT) -> None:
    package_json_path = root / "frontend" / "package.json"
    lock_path = root / "frontend" / "package-lock.json"
    if not package_json_path.is_file() or not lock_path.is_file():
        raise GateError("frontend/package.json and frontend/package-lock.json are required.")

    package_json = json.loads(package_json_path.read_text(encoding="utf-8"))
    package_lock = json.loads(lock_path.read_text(encoding="utf-8"))
    if package_lock.get("lockfileVersion") != 3:
        raise GateError("frontend/package-lock.json must use npm lockfileVersion 3.")
    root_package = package_lock.get("packages", {}).get("", {})
    for key in ("name", "version", "dependencies", "devDependencies"):
        if root_package.get(key) != package_json.get(key):
            raise GateError(
                f"frontend/package-lock.json is out of sync with package.json ({key}). "
                "Run npm install in frontend and commit the lockfile."
            )

    stray_locks = [
        path
        for path in (root / "package-lock.json", root / "apps" / "package-lock.json")
        if path.exists()
    ]
    if stray_locks:
        rendered = ", ".join(str(path.relative_to(root)) for path in stray_locks)
        raise GateError(f"Package locks without matching package.json are not allowed: {rendered}")


def find_python(root: Path = ROOT) -> str:
    candidates = (
        root / ".venv" / "Scripts" / "python.exe",
        root / ".venv" / "bin" / "python",
    )
    for candidate in candidates:
        if candidate.is_file():
            return str(candidate)
    if sys.prefix != sys.base_prefix:
        return sys.executable
    fallback = shutil.which("python3") or shutil.which("python")
    if fallback:
        return fallback
    raise GateError(
        "Python runtime not found. Create .venv and install requirements.txt with --require-hashes."
    )


def find_executable(name: str) -> str:
    executable = shutil.which(name)
    if executable:
        return executable
    raise GateError(f"Required executable '{name}' was not found on PATH.")


def build_stages(
    mode: str,
    *,
    python: str,
    npm: str,
    git: str,
    backend_targets: Sequence[str] = (),
    browser_ports: Sequence[int] = (),
) -> list[Stage]:
    if mode not in MODES:
        raise GateError(f"Unsupported mode: {mode}")
    if backend_targets and mode != "backend":
        raise GateError("--backend-target is supported only with --mode backend.")

    stages = [
        Stage("Diff hygiene (working tree)", (git, "diff", "--check")),
        Stage("Diff hygiene (index)", (git, "diff", "--cached", "--check")),
        Stage(
            "Django migration drift",
            (python, "manage.py", "makemigrations", "--check", "--dry-run"),
        ),
        Stage("Django system check", (python, "manage.py", "check")),
    ]

    if mode in {"backend", "full"}:
        test_command = [python, "manage.py", "test"]
        if mode == "backend":
            test_command.extend(backend_targets)
        test_command.extend(("-v", "2"))
        stages.append(Stage("Django tests", tuple(test_command)))

    if mode in {"frontend", "browser", "full"}:
        stages.append(Stage("Frontend deterministic install", (npm, "ci"), FRONTEND))

    if mode in {"frontend", "full"}:
        stages.extend(
            (
                Stage("Frontend build and i18n", (npm, "run", "build"), FRONTEND),
                Stage("Frontend bundle budget", (npm, "run", "check:bundle"), FRONTEND),
            )
        )

    if mode in {"browser", "full"}:
        stages.append(
            Stage(
                "Playwright mobile role smoke",
                (
                    npm,
                    "exec",
                    "--",
                    "playwright",
                    "test",
                    "e2e/smoke.spec.ts",
                    "--project=mobile-chromium",
                    "-g",
                    "mobile (owner|manager) smoke",
                ),
                FRONTEND,
                tuple(browser_ports),
            )
        )

    if mode in {"security", "full"}:
        stages.extend(
            (
                Stage(
                    "Python lock installability",
                    (
                        python,
                        "-m",
                        "pip",
                        "install",
                        "--dry-run",
                        "--require-hashes",
                        "-r",
                        "requirements.txt",
                    ),
                ),
                Stage(
                    "Python verification-tool lock installability",
                    (
                        python,
                        "-m",
                        "pip",
                        "install",
                        "--dry-run",
                        "--require-hashes",
                        "-r",
                        "requirements-dev.txt",
                    ),
                ),
                Stage(
                    "Python dependency audit",
                    (python, "-m", "pip_audit", "-r", "requirements.txt"),
                ),
                Stage(
                    "Frontend dependency audit (moderate severity)",
                    (npm, "audit", "--audit-level=moderate"),
                    FRONTEND,
                ),
            )
        )

    stages.extend(
        (
            Stage("Final diff hygiene (working tree)", (git, "diff", "--check")),
            Stage("Final diff hygiene (index)", (git, "diff", "--cached", "--check")),
        )
    )
    return stages


def render_command(command: Iterable[str]) -> str:
    return subprocess.list2cmdline(list(command))


def run_stage(stage: Stage, environment: dict[str, str]) -> None:
    print(f"\n==> [{stage.name}]", flush=True)
    print(f"cwd: {stage.cwd}", flush=True)
    print(f"cmd: {render_command(stage.command)}", flush=True)
    if stage.preflight_ports:
        assert_ports_available(stage.preflight_ports)
    result = subprocess.run(stage.command, cwd=stage.cwd, env=environment, check=False)
    if result.returncode:
        raise GateError(f"Stage '{stage.name}' failed with exit code {result.returncode}.")


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--mode",
        choices=MODES,
        default="full",
        help="Gate slice to run (default: full).",
    )
    parser.add_argument(
        "--backend-target",
        action="append",
        default=[],
        help="Django test label for backend mode; repeat for multiple labels.",
    )
    parser.add_argument(
        "--list-stages",
        action="store_true",
        help="Print the resolved stage plan without executing commands.",
    )
    args = parser.parse_args(argv)
    if args.backend_target and args.mode != "backend":
        parser.error("--backend-target is supported only with --mode backend")
    return args


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv)
    try:
        validate_python_lock()
        validate_frontend_lock()
        python = find_python()
        with isolated_runtime(python=python) as runtime:
            stages = build_stages(
                args.mode,
                python=python,
                npm=find_executable("npm"),
                git=find_executable("git"),
                backend_targets=args.backend_target,
                browser_ports=(runtime.django_port, runtime.frontend_port),
            )
            if args.list_stages:
                for stage in stages:
                    print(f"{stage.name}: {render_command(stage.command)}")
                return 0
            for stage in stages:
                run_stage(stage, runtime.environment)
    except (GateError, OSError, json.JSONDecodeError) as exc:
        print(f"\nQUALITY GATE FAILED: {exc}", file=sys.stderr)
        return 1

    print(f"\nQUALITY GATE PASSED ({args.mode})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
