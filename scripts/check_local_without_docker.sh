#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [ -d ".venv" ]; then
  source .venv/bin/activate
fi

export DATABASE_URL="${DATABASE_URL:-sqlite:///db.sqlite3}"
export REDIS_URL="${REDIS_URL:-redis://localhost:6379/0}"
export AUTOMATIONS_RUN_INLINE="${AUTOMATIONS_RUN_INLINE:-True}"
export SECURE_SSL_REDIRECT="${SECURE_SSL_REDIRECT:-False}"
export SESSION_COOKIE_SECURE="${SESSION_COOKIE_SECURE:-False}"
export CSRF_COOKIE_SECURE="${CSRF_COOKIE_SECURE:-False}"

python manage.py makemigrations --check --dry-run
python manage.py check
python manage.py test --verbosity=1
(cd frontend && npm ci && npm run build)

echo "Zani local checks completed successfully."
