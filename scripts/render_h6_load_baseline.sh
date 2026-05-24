#!/usr/bin/env bash
set -euo pipefail

# Run this against staging only. It performs authenticated read-only API smoke
# measurements and stores JSON output for baseline comparison.

PYTHON_BIN="${PYTHON_BIN:-python}"
API_BASE_URL="${API_BASE_URL:-}"
MERCHANT_OWNER_EMAIL="${MERCHANT_OWNER_EMAIL:-}"
MERCHANT_OWNER_PASSWORD="${MERCHANT_OWNER_PASSWORD:-}"
LOAD_SMOKE_ITERATIONS="${LOAD_SMOKE_ITERATIONS:-10}"
LOAD_SMOKE_FAIL_P95_MS="${LOAD_SMOKE_FAIL_P95_MS:-800}"
LOAD_SMOKE_TIMEOUT="${LOAD_SMOKE_TIMEOUT:-15}"
BUSINESS_ID="${BUSINESS_ID:-}"
LOAD_SMOKE_OUTPUT_FILE="${LOAD_SMOKE_OUTPUT_FILE:-load-baseline.json}"

if [[ -z "$API_BASE_URL" || -z "$MERCHANT_OWNER_EMAIL" || -z "$MERCHANT_OWNER_PASSWORD" ]]; then
  echo "API_BASE_URL, MERCHANT_OWNER_EMAIL and MERCHANT_OWNER_PASSWORD are required." >&2
  exit 1
fi

if [[ "${ENVIRONMENT:-staging}" == "production" && "${ALLOW_PRODUCTION_LOAD_SMOKE:-false}" != "true" ]]; then
  echo "Refusing to run H6 load smoke against production without ALLOW_PRODUCTION_LOAD_SMOKE=true." >&2
  exit 1
fi

echo "== H6 API load baseline =="
if [[ -n "$BUSINESS_ID" ]]; then
  "$PYTHON_BIN" scripts/api_load_smoke.py \
    --api-base-url "$API_BASE_URL" \
    --email "$MERCHANT_OWNER_EMAIL" \
    --password "$MERCHANT_OWNER_PASSWORD" \
    --iterations "$LOAD_SMOKE_ITERATIONS" \
    --timeout "$LOAD_SMOKE_TIMEOUT" \
    --business-id "$BUSINESS_ID" \
    --output-file "$LOAD_SMOKE_OUTPUT_FILE" \
    --fail-p95-ms "$LOAD_SMOKE_FAIL_P95_MS"
else
  "$PYTHON_BIN" scripts/api_load_smoke.py \
    --api-base-url "$API_BASE_URL" \
    --email "$MERCHANT_OWNER_EMAIL" \
    --password "$MERCHANT_OWNER_PASSWORD" \
    --iterations "$LOAD_SMOKE_ITERATIONS" \
    --timeout "$LOAD_SMOKE_TIMEOUT" \
    --output-file "$LOAD_SMOKE_OUTPUT_FILE" \
    --fail-p95-ms "$LOAD_SMOKE_FAIL_P95_MS"
fi

echo
echo "H6 load baseline completed: $LOAD_SMOKE_OUTPUT_FILE"
