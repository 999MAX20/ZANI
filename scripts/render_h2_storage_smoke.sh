#!/usr/bin/env bash
set -euo pipefail

# Run this after private object storage is configured for staging/production.
# It validates that Django is not using local container disk and then writes
# a small business-scoped FileAttachment through the active storage backend.

PYTHON_BIN="${PYTHON_BIN:-python}"
BUSINESS_ID="${BUSINESS_ID:-}"

if [[ "${USE_S3:-}" != "True" && "${USE_S3:-}" != "true" && "${USE_S3:-}" != "1" ]]; then
  echo "USE_S3 must be True for H2 production object-storage smoke." >&2
  exit 1
fi

required_vars=(
  AWS_ACCESS_KEY_ID
  AWS_SECRET_ACCESS_KEY
  AWS_STORAGE_BUCKET_NAME
)

for var_name in "${required_vars[@]}"; do
  if [[ -z "${!var_name:-}" ]]; then
    echo "$var_name is not set." >&2
    exit 1
  fi
done

if [[ -z "${AWS_S3_ENDPOINT_URL:-}" && -z "${AWS_S3_REGION_NAME:-}" ]]; then
  echo "Set AWS_S3_ENDPOINT_URL for S3-compatible storage or AWS_S3_REGION_NAME for AWS S3." >&2
  exit 1
fi

echo "== H2 production readiness storage check =="
audit_file="$(mktemp)"
trap 'rm -f "$audit_file"' EXIT
"$PYTHON_BIN" manage.py production_readiness_audit --format=json > "$audit_file"
"$PYTHON_BIN" - "$audit_file" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as file:
    payload = json.load(file)
storage_items = [item for item in payload["items"] if item["key"].startswith("storage.")]
for item in storage_items:
    print(f"{item['status'].upper()}: {item['key']} — {item['detail']}")
failed = [item for item in storage_items if item["status"] == "fail"]
if failed:
    raise SystemExit("Storage readiness is not green.")
PY

echo
echo "== H2 storage runtime smoke =="
if [[ -n "$BUSINESS_ID" ]]; then
  "$PYTHON_BIN" manage.py storage_runtime_smoke --business-id "$BUSINESS_ID" --cleanup
else
  "$PYTHON_BIN" manage.py storage_runtime_smoke --cleanup
fi

echo
echo "H2 storage runtime smoke passed."
