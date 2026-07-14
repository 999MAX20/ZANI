#!/usr/bin/env bash
set -euo pipefail

PYTHON_BIN="${PYTHON_BIN:-.venv/bin/python}"
VALIDATE="${VALIDATE:-0}"

if [[ -z "${CONNECTOR_ID:-}" ]]; then
  echo "Set CONNECTOR_ID to the MoySklad BusinessConnector id." >&2
  exit 1
fi

ARGS=(manage.py moysklad_local_real_test_check --connector-id "$CONNECTOR_ID" --fail-on-missing)
if [[ "$VALIDATE" == "1" ]]; then
  ARGS+=(--validate)
fi

DATABASE_URL="${DATABASE_URL:-sqlite:///db.sqlite3}" "$PYTHON_BIN" "${ARGS[@]}"
