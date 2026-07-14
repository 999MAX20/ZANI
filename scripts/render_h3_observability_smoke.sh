#!/usr/bin/env bash
set -euo pipefail

# Run this after Sentry is configured for the Render backend service.
# It checks that observability is configured and can optionally send a safe
# smoke event that contains no merchant/customer payload.

PYTHON_BIN="${PYTHON_BIN:-python}"
CAPTURE_SENTRY_SMOKE="${CAPTURE_SENTRY_SMOKE:-false}"

if [[ -z "${SENTRY_DSN:-}" ]]; then
  echo "SENTRY_DSN is not set. Configure Sentry before H3 observability smoke." >&2
  exit 1
fi

if [[ -z "${ENVIRONMENT:-}" || "${ENVIRONMENT:-}" == "development" ]]; then
  echo "ENVIRONMENT must be set to staging or production for H3 observability smoke." >&2
  exit 1
fi

if [[ -z "${RELEASE:-}" || "${RELEASE:-}" == "local" ]]; then
  echo "RELEASE must be set to a deploy SHA/tag for H3 observability smoke." >&2
  exit 1
fi

echo "== H3 production readiness observability check =="
audit_file="$(mktemp)"
trap 'rm -f "$audit_file"' EXIT
"$PYTHON_BIN" manage.py production_readiness_audit --format=json > "$audit_file"
"$PYTHON_BIN" - "$audit_file" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as file:
    payload = json.load(file)
observability_items = [item for item in payload["items"] if item["key"].startswith("observability.")]
for item in observability_items:
    print(f"{item['status'].upper()}: {item['key']} - {item['detail']}")
failed = [item for item in observability_items if item["status"] == "fail"]
if failed:
    raise SystemExit("Observability readiness is not green.")
PY

echo
echo "== H3 observability runtime check =="
if [[ "$CAPTURE_SENTRY_SMOKE" == "True" || "$CAPTURE_SENTRY_SMOKE" == "true" || "$CAPTURE_SENTRY_SMOKE" == "1" ]]; then
  "$PYTHON_BIN" manage.py observability_runtime_check --fail-on-missing --capture-test-message
else
  "$PYTHON_BIN" manage.py observability_runtime_check --fail-on-missing
fi

echo
echo "H3 observability smoke passed."
