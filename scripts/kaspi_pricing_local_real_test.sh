#!/usr/bin/env bash
set -euo pipefail

# Safe local real-test for Kaspi Pricing Agent.
# It validates real tenant rules and can run one pricing cycle without provider write-back.

PYTHON_BIN="${PYTHON_BIN:-.venv/bin/python}"
BUSINESS_ID="${BUSINESS_ID:-}"
RUN_CYCLE="${RUN_CYCLE:-0}"
APPLY_AUTOPILOT="${APPLY_AUTOPILOT:-0}"

ARGS=(manage.py kaspi_pricing_local_real_test_check --fail-on-missing)
if [[ -n "$BUSINESS_ID" ]]; then
  ARGS+=(--business-id "$BUSINESS_ID")
fi
if [[ "$RUN_CYCLE" == "1" ]]; then
  ARGS+=(--run-cycle)
fi
if [[ "$APPLY_AUTOPILOT" == "1" ]]; then
  ARGS+=(--apply-autopilot)
fi

DATABASE_URL="${DATABASE_URL:-sqlite:///db.sqlite3}" "$PYTHON_BIN" "${ARGS[@]}"
