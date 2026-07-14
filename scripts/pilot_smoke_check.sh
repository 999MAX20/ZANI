#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PYTHON_BIN="${PYTHON_BIN:-$ROOT_DIR/.venv/bin/python}"

cd "$ROOT_DIR"

if [ ! -x "$PYTHON_BIN" ]; then
  echo "Python venv not found at $PYTHON_BIN" >&2
  echo "Run: python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt" >&2
  exit 1
fi

export DEBUG="${DEBUG:-True}"
export SECRET_KEY="${SECRET_KEY:-dev-secret-key-change-for-production-32-plus-chars}"
export DATABASE_URL="${DATABASE_URL:-sqlite:///db.sqlite3}"
export REDIS_URL="${REDIS_URL:-memory://}"
export CELERY_TASK_ALWAYS_EAGER="${CELERY_TASK_ALWAYS_EAGER:-True}"
export CELERY_TASK_STORE_EAGER_RESULT="${CELERY_TASK_STORE_EAGER_RESULT:-False}"
export AUTOMATIONS_RUN_INLINE="${AUTOMATIONS_RUN_INLINE:-True}"
export SECURE_SSL_REDIRECT="${SECURE_SSL_REDIRECT:-False}"
export SESSION_COOKIE_SECURE="${SESSION_COOKIE_SECURE:-False}"
export CSRF_COOKIE_SECURE="${CSRF_COOKIE_SECURE:-False}"
export ALLOWED_HOSTS="${ALLOWED_HOSTS:-localhost,127.0.0.1}"
export CORS_ALLOWED_ORIGINS="${CORS_ALLOWED_ORIGINS:-http://localhost:5173,http://127.0.0.1:5173}"
export PILOT_FRONTEND_URL="${PILOT_FRONTEND_URL:-http://localhost:5173}"
export PILOT_BACKEND_URL="${PILOT_BACKEND_URL:-http://127.0.0.1:8000}"

echo "== Pilot smoke: migrations =="
"$PYTHON_BIN" manage.py migrate --noinput

echo "== Pilot smoke: Django system check =="
"$PYTHON_BIN" manage.py check

echo "== Pilot smoke: core pilot test pack =="
# Run all pilot suites in one Django test command so Django creates/migrates the
# test database only once. Previously each suite ran in a separate command, which
# made the smoke check look like it was stuck in a migration loop.
TEST_SUITES=(
  "apps.businesses.tests_activation"
  "apps.businesses.tests_demo_seed"
  "apps.leads.tests_forms"
  "apps.notifications.tests"
  "apps.analytics.tests"
  "apps.integrations.tests_connectors"
  "apps.bots.tests.InboxBackendTests"
  "apps.ai_core.tests"
  "apps.tasks.tests"
  "apps.core.tests_import_samples"
  "apps.core.tests_import_export"
)

TEST_VERBOSITY="${TEST_VERBOSITY:-2}"
TEST_KEEPDB="${TEST_KEEPDB:-true}"
TEST_ARGS=("${TEST_SUITES[@]}" -v "$TEST_VERBOSITY")
if [ "$TEST_KEEPDB" = "true" ] || [ "$TEST_KEEPDB" = "1" ] || [ "$TEST_KEEPDB" = "True" ]; then
  TEST_ARGS+=(--keepdb)
fi
"$PYTHON_BIN" manage.py test "${TEST_ARGS[@]}"

echo "== Pilot smoke: import sample export =="
"$PYTHON_BIN" manage.py write_import_samples --output-dir /tmp/zani-import-samples
ls -la /tmp/zani-import-samples

echo "== Pilot smoke: demo launch pack idempotency =="
"$PYTHON_BIN" manage.py prepare_pilot_demo --reset --frontend-url "$PILOT_FRONTEND_URL" --backend-url "$PILOT_BACKEND_URL"
"$PYTHON_BIN" manage.py prepare_pilot_demo --reset --frontend-url "$PILOT_FRONTEND_URL" --backend-url "$PILOT_BACKEND_URL"

echo "== Pilot smoke: API launch quality gate =="
"$PYTHON_BIN" manage.py pilot_launch_quality_gate

if [ "${SKIP_FRONTEND_BUILD:-false}" = "true" ] || [ "${SKIP_FRONTEND_BUILD:-false}" = "1" ] || [ "${SKIP_FRONTEND_BUILD:-false}" = "True" ]; then
  echo "== Pilot smoke: frontend build skipped =="
else
  echo "== Pilot smoke: frontend build =="
  (cd frontend && npm install && npm run build)
fi

echo "Pilot smoke checks completed successfully."
