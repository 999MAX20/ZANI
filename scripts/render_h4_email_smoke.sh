#!/usr/bin/env bash
set -euo pipefail

# Run this after a transactional SMTP provider is configured for staging/production.
# It rejects local/mock email backends and can optionally send a safe smoke email.

PYTHON_BIN="${PYTHON_BIN:-python}"
SEND_EMAIL_SMOKE="${SEND_EMAIL_SMOKE:-false}"
EMAIL_SMOKE_TO="${EMAIL_SMOKE_TO:-}"

if [[ -z "${ENVIRONMENT:-}" || "${ENVIRONMENT:-}" == "development" ]]; then
  echo "ENVIRONMENT must be set to staging or production for H4 email smoke." >&2
  exit 1
fi

if [[ "${EMAIL_BACKEND:-}" == *".locmem.EmailBackend" || "${EMAIL_BACKEND:-}" == *".console.EmailBackend" ]]; then
  echo "EMAIL_BACKEND must use a real transactional provider in staging/production." >&2
  exit 1
fi

required_vars=(
  EMAIL_HOST
  EMAIL_HOST_USER
  EMAIL_HOST_PASSWORD
  DEFAULT_FROM_EMAIL
)

for var_name in "${required_vars[@]}"; do
  if [[ -z "${!var_name:-}" ]]; then
    echo "$var_name is not set." >&2
    exit 1
  fi
done

echo "== H4 production readiness email check =="
audit_file="$(mktemp)"
trap 'rm -f "$audit_file"' EXIT
"$PYTHON_BIN" manage.py production_readiness_audit --format=json > "$audit_file"
"$PYTHON_BIN" - "$audit_file" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as file:
    payload = json.load(file)
email_items = [item for item in payload["items"] if item["key"].startswith("email.")]
for item in email_items:
    print(f"{item['status'].upper()}: {item['key']} - {item['detail']}")
not_green = [item for item in email_items if item["status"] != "pass"]
if not_green:
    raise SystemExit("Email readiness is not green.")
PY

echo
echo "== H4 email runtime check =="
if [[ "$SEND_EMAIL_SMOKE" == "True" || "$SEND_EMAIL_SMOKE" == "true" || "$SEND_EMAIL_SMOKE" == "1" ]]; then
  if [[ -z "$EMAIL_SMOKE_TO" ]]; then
    echo "EMAIL_SMOKE_TO is required when SEND_EMAIL_SMOKE=true." >&2
    exit 1
  fi
  "$PYTHON_BIN" manage.py email_runtime_smoke --fail-on-missing --send --to "$EMAIL_SMOKE_TO"
else
  "$PYTHON_BIN" manage.py email_runtime_smoke --fail-on-missing
fi

echo
echo "H4 transactional email smoke passed."
