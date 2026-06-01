#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PYTHON_BIN="${PYTHON_BIN:-$ROOT_DIR/.venv/bin/python}"
PIP_AUDIT_BIN="${PIP_AUDIT_BIN:-$ROOT_DIR/.venv/bin/pip-audit}"

cd "$ROOT_DIR"

if [ ! -x "$PYTHON_BIN" ]; then
  echo "Python executable not found: $PYTHON_BIN" >&2
  echo "Set PYTHON_BIN to the production virtualenv Python executable." >&2
  exit 1
fi

if [ "${ENVIRONMENT:-}" != "production" ]; then
  echo "ENVIRONMENT must be production for the production release check." >&2
  exit 1
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL must point at the production managed PostgreSQL database." >&2
  exit 1
fi

echo "== Production release: Django system check =="
"$PYTHON_BIN" manage.py check

echo "== Production release: Django deploy check =="
"$PYTHON_BIN" manage.py check --deploy

echo "== Production release: migration drift check =="
"$PYTHON_BIN" manage.py makemigrations --check --dry-run

echo "== Production release: production readiness audit =="
"$PYTHON_BIN" manage.py production_readiness_audit --fail-on-critical

echo "== Production release: provider rollout readiness =="
"$PYTHON_BIN" manage.py provider_rollout_readiness_check --fail-on-blockers

echo "== Production release: backup/restore readiness =="
"$PYTHON_BIN" manage.py backup_restore_readiness_check --fail-on-blockers

if [ -x "$PIP_AUDIT_BIN" ]; then
  echo "== Production release: dependency vulnerability audit =="
  "$PIP_AUDIT_BIN"
else
  echo "== Production release: dependency vulnerability audit skipped =="
  echo "pip-audit not found at $PIP_AUDIT_BIN"
fi

echo "Production release check passed."
