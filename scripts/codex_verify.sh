#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

export DATABASE_URL="${DATABASE_URL:-sqlite:///db.sqlite3}"
export SECURE_SSL_REDIRECT="${SECURE_SSL_REDIRECT:-False}"
export SESSION_COOKIE_SECURE="${SESSION_COOKIE_SECURE:-False}"
export CSRF_COOKIE_SECURE="${CSRF_COOKIE_SECURE:-False}"
export REDIS_URL="${REDIS_URL:-memory://}"
export CELERY_TASK_ALWAYS_EAGER="${CELERY_TASK_ALWAYS_EAGER:-True}"
export CELERY_TASK_STORE_EAGER_RESULT="${CELERY_TASK_STORE_EAGER_RESULT:-False}"
export AUTOMATIONS_RUN_INLINE="${AUTOMATIONS_RUN_INLINE:-True}"

PYTHON_BIN="${PYTHON_BIN:-.venv/bin/python}"

if [[ ! -x "$PYTHON_BIN" ]]; then
  PYTHON_BIN="${PYTHON_FALLBACK:-python}"
fi

echo "==> Django migration check"
"$PYTHON_BIN" manage.py makemigrations --check --dry-run

echo "==> Django system check"
"$PYTHON_BIN" manage.py check

echo "==> Django tests"
"$PYTHON_BIN" manage.py test "$@"

echo "==> Frontend production build"
(
  cd frontend
  npm run build
)

echo "==> Codex verification complete"
