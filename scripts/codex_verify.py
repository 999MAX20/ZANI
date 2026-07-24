#!/usr/bin/env python3
"""Deterministic, production-credential-free local quality gate for ZANI."""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Sequence


ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT / "frontend"
MODES = ("static", "backend", "frontend", "browser", "security", "full")
SAFE_ENV = {
    "ENVIRONMENT": "development",
    "DEBUG": "False",
    "SECRET_KEY": "zani-local-quality-gate-secret-key-2026-not-for-production",
    "DATABASE_URL": "sqlite:///db.sqlite3",
    "SECURE_SSL_REDIRECT": "False",
    "SESSION_COOKIE_SECURE": "False",
    "CSRF_COOKIE_SECURE": "False",
    "REDIS_URL": "memory://",
    "CELERY_TASK_ALWAYS_EAGER": "True",
    "CELERY_TASK_STORE_EAGER_RESULT": "False",
    "AUTOMATIONS_RUN_INLINE": "True",
    "AI_PROVIDER": "mock",
    "OPENAI_API_KEY": "",
    "OPENROUTER_API_KEY": "",
    "KIMI_API_KEY": "",
    "SENTRY_DSN": "",
    "TELEGRAM_ENABLED": "False",
    "TELEGRAM_WEBHOOK_SECRET": "",
    "WHATSAPP_ENABLED": "False",
    "WHATSAPP_VERIFY_TOKEN": "",
    "WHATSAPP_APP_SECRET": "",
    "INSTAGRAM_ENABLED": "False",
    "INSTAGRAM_VERIFY_TOKEN": "",
    "INSTAGRAM_APP_SECRET": "",
    "META_APP_ID": "",
    "META_APP_SECRET": "",
    "KASPI_ENABLED": "False",
    "KASPI_REPRICING_ENABLED": "False",
    "KASPI_REPRICING_WRITE_ENABLED": "False",
    "KASPI_REPRICING_SCHEDULE_ENABLED": "False",
    "MOYSKLAD_ENABLED": "False",
    "WILDBERRIES_ENABLED": "False",
    "OZON_ENABLED": "False",
    "USE_S3": "False",
    "EMAIL_BACKEND": "django.core.mail.backends.locmem.EmailBackend",
    "EMAIL_HOST": "",
    "EMAIL_HOST_USER": "",
    "EMAIL_HOST_PASSWORD": "",
    "VITE_API_URL": "http://127.0.0.1:8000",
    "E2E_BASE_URL": "http://127.0.0.1:5173",
    "E2E_API_BASE_URL": "http://127.0.0.1:8000",
    "E2E_SKIP_LOCAL_SETUP": "false",
}


class GateError(RuntimeError):
    """Actionable local quality-gate failure."""


@dataclass(frozen=True)
class Stage:
    name: str
    command: tuple[str, ...]
    cwd: Path = ROOT


def safe_environment(base: dict[str, str] | None = None) -> dict[str, str]:
    """Return an environment that cannot inherit live provider/runtime settings."""
    environment = dict(os.environ if base is None else base)
    environment.update(SAFE_ENV)
    return environment


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
) -> list[Stage]:
    if mode not in MODES:
        raise GateError(f"Unsupported mode: {mode}")

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
                "Playwright mobile owner/manager smoke",
                (
                    npm,
                    "exec",
                    "--",
                    "playwright",
                    "test",
                    "--project=mobile-chromium",
                    "-g",
                    "mobile (owner|manager) smoke",
                ),
                FRONTEND,
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
                    "Frontend dependency audit (high severity)",
                    (npm, "audit", "--audit-level=high"),
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
        help="Django test label for backend/full mode; repeat for multiple labels.",
    )
    parser.add_argument(
        "--list-stages",
        action="store_true",
        help="Print the resolved stage plan without executing commands.",
    )
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv)
    try:
        validate_python_lock()
        validate_frontend_lock()
        stages = build_stages(
            args.mode,
            python=find_python(),
            npm=find_executable("npm"),
            git=find_executable("git"),
            backend_targets=args.backend_target,
        )
        if args.list_stages:
            for stage in stages:
                print(f"{stage.name}: {render_command(stage.command)}")
            return 0
        environment = safe_environment()
        for stage in stages:
            run_stage(stage, environment)
    except (GateError, OSError, json.JSONDecodeError) as exc:
        print(f"\nQUALITY GATE FAILED: {exc}", file=sys.stderr)
        return 1

    print(f"\nQUALITY GATE PASSED ({args.mode})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
