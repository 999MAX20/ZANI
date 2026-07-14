#!/usr/bin/env bash
set -euo pipefail

# Preflight for a local real read-only Kaspi orders sync test.
# Usage:
#   CONNECTOR_ID=123 ./scripts/kaspi_local_real_test.sh
#   CONNECTOR_ID=123 VALIDATE=1 ./scripts/kaspi_local_real_test.sh

PYTHON_BIN="${PYTHON_BIN:-.venv/bin/python}"
CONNECTOR_ID="${CONNECTOR_ID:-}"
VALIDATE="${VALIDATE:-0}"

if [[ -z "$CONNECTOR_ID" ]]; then
  echo "Set CONNECTOR_ID to the Kaspi BusinessConnector id, for example:"
  echo "  CONNECTOR_ID=123 ./scripts/kaspi_local_real_test.sh"
  exit 2
fi

ARGS=(manage.py kaspi_local_real_test_check --connector-id "$CONNECTOR_ID" --fail-on-missing)
if [[ "$VALIDATE" == "1" ]]; then
  ARGS+=(--validate)
fi

echo "== Kaspi local real-test preflight =="
"$PYTHON_BIN" "${ARGS[@]}"

echo
echo "Next:"
echo "  1. Open /dashboard/integrations -> Kaspi."
echo "  2. Press Проверить API."
echo "  3. Press Sync orders."
echo "  4. Check Business events / AI analytics for kaspi_order_imported and kaspi_sale_detected."
