#!/usr/bin/env bash
set -euo pipefail

# Preflight for a local real read-only Wildberries statistics sync test.
# Usage:
#   CONNECTOR_ID=123 ./scripts/wildberries_local_real_test.sh
#   CONNECTOR_ID=123 VALIDATE=1 ./scripts/wildberries_local_real_test.sh

PYTHON_BIN="${PYTHON_BIN:-.venv/bin/python}"
CONNECTOR_ID="${CONNECTOR_ID:-}"
VALIDATE="${VALIDATE:-0}"

if [[ -z "$CONNECTOR_ID" ]]; then
  echo "Set CONNECTOR_ID to the Wildberries BusinessConnector id." >&2
  exit 2
fi

ARGS=(manage.py wildberries_local_real_test_check --connector-id "$CONNECTOR_ID" --fail-on-missing)
if [[ "$VALIDATE" == "1" ]]; then
  ARGS+=(--validate)
fi

DATABASE_URL="${DATABASE_URL:-sqlite:///db.sqlite3}" "$PYTHON_BIN" "${ARGS[@]}"
