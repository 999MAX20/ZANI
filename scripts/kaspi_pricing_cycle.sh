#!/usr/bin/env bash
set -euo pipefail

PYTHON_BIN="${PYTHON_BIN:-.venv/bin/python}"
BUSINESS_ID="${BUSINESS_ID:-}"
APPLY_AUTOPILOT="${APPLY_AUTOPILOT:-0}"
PROVIDER="${PROVIDER:-}"

ARGS=(manage.py kaspi_pricing_cycle)
if [[ -n "$BUSINESS_ID" ]]; then
  ARGS+=(--business-id "$BUSINESS_ID")
fi
if [[ "$APPLY_AUTOPILOT" == "1" ]]; then
  ARGS+=(--apply-autopilot)
fi

if [[ -n "$PROVIDER" ]]; then
  DATABASE_URL="${DATABASE_URL:-sqlite:///db.sqlite3}" "$PYTHON_BIN" manage.py kaspi_collect_competitor_offers ${BUSINESS_ID:+--business-id "$BUSINESS_ID"} --provider "$PROVIDER"
fi

DATABASE_URL="${DATABASE_URL:-sqlite:///db.sqlite3}" "$PYTHON_BIN" "${ARGS[@]}"
