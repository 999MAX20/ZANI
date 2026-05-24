#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PYTHON_BIN="${PYTHON_BIN:-$ROOT_DIR/.venv/bin/python}"
BUSINESS_ID="${BUSINESS_ID:-}"
RUN_REMOTE_SMOKE="${RUN_REMOTE_SMOKE:-true}"
RUN_LOAD_SMOKE="${RUN_LOAD_SMOKE:-false}"
RUN_QUEUE_SMOKE="${RUN_QUEUE_SMOKE:-true}"
RUN_STORAGE_SMOKE="${RUN_STORAGE_SMOKE:-true}"
QUEUE_SMOKE_TIMEOUT="${QUEUE_SMOKE_TIMEOUT:-45}"
LOAD_SMOKE_ITERATIONS="${LOAD_SMOKE_ITERATIONS:-5}"
LOAD_SMOKE_FAIL_P95_MS="${LOAD_SMOKE_FAIL_P95_MS:-2500}"

cd "$ROOT_DIR"

require_python() {
  if [[ ! -x "$PYTHON_BIN" ]]; then
    echo "Python executable not found: $PYTHON_BIN" >&2
    echo "Set PYTHON_BIN=/path/to/python if you run this outside the local virtualenv." >&2
    exit 2
  fi
}

run_step() {
  local label="$1"
  shift
  echo ""
  echo "== $label =="
  "$@"
}

require_business_id() {
  local label="$1"
  if [[ -z "$BUSINESS_ID" ]]; then
    echo "Skipping $label: BUSINESS_ID is not set."
    return 1
  fi
  return 0
}

require_python

run_step "Django migration check" "$PYTHON_BIN" manage.py makemigrations --check --dry-run
run_step "Django system check" "$PYTHON_BIN" manage.py check
run_step "Production readiness gate" "$PYTHON_BIN" manage.py production_readiness_audit --fail-on-critical
run_step "Backup/restore readiness gate" "$PYTHON_BIN" manage.py backup_restore_readiness_check --fail-on-blockers
run_step "Observability runtime gate" "$PYTHON_BIN" manage.py observability_runtime_check --fail-on-missing
run_step "Transactional email runtime gate" "$PYTHON_BIN" manage.py email_runtime_smoke --fail-on-missing
run_step "Provider rollout gate" "$PYTHON_BIN" manage.py provider_rollout_readiness_check --fail-on-blockers
run_step "Platform operations health gate" "$PYTHON_BIN" manage.py platform_operations_health_check --fail-on-critical

if [[ "$RUN_QUEUE_SMOKE" == "true" ]] && require_business_id "queue runtime smoke"; then
  run_step "Queue runtime smoke" "$PYTHON_BIN" manage.py queue_runtime_smoke --business-id "$BUSINESS_ID" --timeout "$QUEUE_SMOKE_TIMEOUT" --cleanup
fi

if [[ "$RUN_STORAGE_SMOKE" == "true" ]] && require_business_id "storage runtime smoke"; then
  run_step "Storage runtime smoke" "$PYTHON_BIN" manage.py storage_runtime_smoke --business-id "$BUSINESS_ID" --cleanup
fi

if [[ "$RUN_REMOTE_SMOKE" == "true" ]]; then
  if [[ -n "${API_BASE_URL:-}" ]]; then
    run_step "Remote staging/API smoke" "$ROOT_DIR/scripts/staging_smoke.sh"
  else
    echo ""
    echo "Skipping remote staging/API smoke: API_BASE_URL is not set."
  fi
fi

if [[ "$RUN_LOAD_SMOKE" == "true" ]]; then
  if [[ -z "${API_BASE_URL:-}" || -z "${MERCHANT_OWNER_EMAIL:-}" || -z "${MERCHANT_OWNER_PASSWORD:-}" ]]; then
    echo ""
    echo "Skipping load smoke: API_BASE_URL, MERCHANT_OWNER_EMAIL and MERCHANT_OWNER_PASSWORD are required."
  else
    run_step "API load smoke" \
      "$PYTHON_BIN" scripts/api_load_smoke.py \
      --api-base-url "$API_BASE_URL" \
      --email "$MERCHANT_OWNER_EMAIL" \
      --password "$MERCHANT_OWNER_PASSWORD" \
      --iterations "$LOAD_SMOKE_ITERATIONS" \
      --output-file "${LOAD_SMOKE_OUTPUT_FILE:-load-baseline.json}" \
      --fail-p95-ms "$LOAD_SMOKE_FAIL_P95_MS"
  fi
fi

run_step "Paid beta final gate" "$PYTHON_BIN" manage.py paid_beta_gate_check --fail-on-blockers

echo ""
echo "Paid beta launch check completed."
