#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$ROOT_DIR"

export DATABASE_URL="${DATABASE_URL:-sqlite:///db.sqlite3}"

echo "== Backend: migration check =="
.venv/bin/python manage.py makemigrations --check --dry-run

echo "== Backend: system check =="
.venv/bin/python manage.py check

echo "== Backend: production readiness audit =="
.venv/bin/python manage.py production_readiness_audit

echo "== Backend: tests =="
.venv/bin/python manage.py test

echo "== Frontend: build =="
(cd frontend && npm run build)

echo "Local CI checks completed."
