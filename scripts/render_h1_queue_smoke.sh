#!/usr/bin/env bash
set -euo pipefail

# Run this after Render web + worker services share the same DATABASE_URL and REDIS_URL.
# It intentionally fails fast when the environment still looks local/inline.

PYTHON_BIN="${PYTHON_BIN:-python}"
BUSINESS_ID="${BUSINESS_ID:-}"
QUEUE_SMOKE_TIMEOUT="${QUEUE_SMOKE_TIMEOUT:-60}"

if [[ -z "${REDIS_URL:-}" ]]; then
  echo "REDIS_URL is not set. Configure managed Redis on backend and worker services first." >&2
  exit 1
fi

if [[ "${AUTOMATIONS_RUN_INLINE:-}" != "False" && "${AUTOMATIONS_RUN_INLINE:-}" != "false" && "${AUTOMATIONS_RUN_INLINE:-}" != "0" ]]; then
  echo "AUTOMATIONS_RUN_INLINE must be False for H1 queue-backed runtime smoke." >&2
  exit 1
fi

if [[ "${CELERY_TASK_ALWAYS_EAGER:-False}" == "True" || "${CELERY_TASK_ALWAYS_EAGER:-False}" == "true" || "${CELERY_TASK_ALWAYS_EAGER:-False}" == "1" ]]; then
  echo "CELERY_TASK_ALWAYS_EAGER must be False for real worker smoke." >&2
  exit 1
fi

echo "== H1 production readiness queue checks =="
audit_file="$(mktemp)"
trap 'rm -f "$audit_file"' EXIT
"$PYTHON_BIN" manage.py production_readiness_audit --format=json > "$audit_file"
"$PYTHON_BIN" - "$audit_file" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as file:
    payload = json.load(file)
queue_items = [item for item in payload["items"] if item["key"].startswith("queue.")]
for item in queue_items:
    print(f"{item['status'].upper()}: {item['key']} — {item['detail']}")
failed = [item for item in queue_items if item["status"] == "fail"]
if failed:
    raise SystemExit("Queue readiness is not green.")
PY

echo
echo "== H1 queue runtime smoke =="
if [[ -n "$BUSINESS_ID" ]]; then
  "$PYTHON_BIN" manage.py queue_runtime_smoke --business-id "$BUSINESS_ID" --timeout "$QUEUE_SMOKE_TIMEOUT" --cleanup
else
  "$PYTHON_BIN" manage.py queue_runtime_smoke --timeout "$QUEUE_SMOKE_TIMEOUT" --cleanup
fi

echo
echo "H1 queue runtime smoke passed."
