#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PYTHON_BIN="${PYTHON_BIN:-$ROOT_DIR/.venv/bin/python}"
ARCHIVE_NAME="${PREDEPLOY_ARCHIVE_NAME:-zani-predeploy-clean.zip}"
ARCHIVE_PATH="$ROOT_DIR/$ARCHIVE_NAME"

cd "$ROOT_DIR"

if [ ! -x "$PYTHON_BIN" ]; then
  echo "Python executable not found: $PYTHON_BIN" >&2
  echo "Set PYTHON_BIN or create the local virtualenv first." >&2
  exit 1
fi

export DATABASE_URL="${DATABASE_URL:-sqlite:///db.sqlite3}"

echo "== Predeploy: Django system check =="
"$PYTHON_BIN" manage.py check

echo "== Predeploy: Django deploy check =="
"$PYTHON_BIN" manage.py check --deploy

echo "== Predeploy: migration drift check =="
"$PYTHON_BIN" manage.py makemigrations --check --dry-run

echo "== Predeploy: production readiness audit =="
"$PYTHON_BIN" manage.py production_readiness_audit

echo "== Predeploy: shell script syntax =="
for script in scripts/*.sh; do
  bash -n "$script"
done

echo "== Predeploy: clean archive =="
./scripts/make_clean_archive.sh "$ARCHIVE_NAME"

archive_listing="$(mktemp)"
trap 'rm -f "$archive_listing"; if [ "${KEEP_PREDEPLOY_ARCHIVE:-false}" != "true" ]; then rm -f "$ARCHIVE_PATH"; fi' EXIT
unzip -l "$ARCHIVE_PATH" > "$archive_listing"

if grep -E 'zani/(\.env$|\.venv/|venv/|db\.sqlite3|frontend/node_modules/|node_modules/|frontend/dist/|dist/|media/|staticfiles/)' "$archive_listing"; then
  echo "Clean archive contains local/runtime artifacts. Fix scripts/make_clean_archive.sh." >&2
  exit 1
fi

if [ "${SKIP_FRONTEND_BUILD:-false}" = "true" ]; then
  echo "== Predeploy: frontend build skipped =="
else
  echo "== Predeploy: frontend build =="
  (cd frontend && npm run build)
fi

echo "Predeploy check passed."
