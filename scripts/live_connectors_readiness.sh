#!/usr/bin/env bash
set -uo pipefail

# One command for live-readiness checks before a real merchant test.
# Usage:
#   PUBLIC_URL=https://your-public-api TELEGRAM_CHANNEL_ID=1 CONNECTOR_ID_KASPI=1 CONNECTOR_ID_MOYSKLAD=2 CONNECTOR_ID_WILDBERRIES=3 CONNECTOR_ID_OZON=4 scripts/live_connectors_readiness.sh
#   PUBLIC_URL=https://your-public-api TELEGRAM_CHANNEL_ID=1 SET_WEBHOOK=1 CONNECTOR_ID_KASPI=1 CONNECTOR_ID_MOYSKLAD=2 CONNECTOR_ID_WILDBERRIES=3 CONNECTOR_ID_OZON=4 VALIDATE=1 scripts/live_connectors_readiness.sh

PYTHON_BIN="${PYTHON_BIN:-.venv/bin/python}"
PUBLIC_URL="${PUBLIC_URL:-}"
CONNECTOR_ID_KASPI="${CONNECTOR_ID_KASPI:-${KASPI_CONNECTOR_ID:-}}"
CONNECTOR_ID_MOYSKLAD="${CONNECTOR_ID_MOYSKLAD:-${MOYSKLAD_CONNECTOR_ID:-}}"
CONNECTOR_ID_WILDBERRIES="${CONNECTOR_ID_WILDBERRIES:-${WILDBERRIES_CONNECTOR_ID:-}}"
CONNECTOR_ID_OZON="${CONNECTOR_ID_OZON:-${OZON_CONNECTOR_ID:-}}"
TELEGRAM_CHANNEL_ID="${TELEGRAM_CHANNEL_ID:-${CHANNEL_ID_TELEGRAM:-}}"
VALIDATE="${VALIDATE:-0}"
SET_WEBHOOK="${SET_WEBHOOK:-0}"

failures=0

run_check() {
  local title="$1"
  shift
  echo
  echo "== ${title} =="
  "$@"
  local status=$?
  if [[ $status -ne 0 ]]; then
    failures=$((failures + 1))
  fi
}

if [[ -z "$PUBLIC_URL" ]]; then
  echo "PUBLIC_URL is missing. Use the public HTTPS URL that points to Django :8000."
  failures=$((failures + 1))
else
  telegram_args=(manage.py telegram_local_real_test_check --public-url "$PUBLIC_URL" --fail-on-missing)
  if [[ -n "$TELEGRAM_CHANNEL_ID" ]]; then
    telegram_args+=(--channel-id "$TELEGRAM_CHANNEL_ID")
  fi
  if [[ "$SET_WEBHOOK" == "1" || "$SET_WEBHOOK" == "true" ]]; then
    telegram_args+=(--set-webhook)
  fi
  run_check "Telegram readiness" "$PYTHON_BIN" "${telegram_args[@]}"

  run_check "WhatsApp Meta readiness" \
    "$PYTHON_BIN" manage.py whatsapp_local_real_test_check --public-url "$PUBLIC_URL" --fail-on-missing
  run_check "Instagram Meta readiness" \
    "$PYTHON_BIN" manage.py instagram_local_real_test_check --public-url "$PUBLIC_URL" --fail-on-missing
fi

if [[ -z "$CONNECTOR_ID_KASPI" ]]; then
  echo
  echo "Kaspi connector id is missing. Set CONNECTOR_ID_KASPI after saving the merchant key in the UI."
  failures=$((failures + 1))
else
  kaspi_args=(manage.py kaspi_local_real_test_check --connector-id "$CONNECTOR_ID_KASPI" --fail-on-missing)
  if [[ "$VALIDATE" == "1" ]]; then
    kaspi_args+=(--validate)
  fi
  run_check "Kaspi readiness" "$PYTHON_BIN" "${kaspi_args[@]}"
fi

if [[ -z "$CONNECTOR_ID_MOYSKLAD" ]]; then
  echo
  echo "MoySklad connector id is missing. Set CONNECTOR_ID_MOYSKLAD after saving the merchant key in the UI."
  failures=$((failures + 1))
else
  moysklad_args=(manage.py moysklad_local_real_test_check --connector-id "$CONNECTOR_ID_MOYSKLAD" --fail-on-missing)
  if [[ "$VALIDATE" == "1" ]]; then
    moysklad_args+=(--validate)
  fi
  run_check "MoySklad readiness" "$PYTHON_BIN" "${moysklad_args[@]}"
fi

if [[ -z "$CONNECTOR_ID_WILDBERRIES" ]]; then
  echo
  echo "Wildberries connector id is missing. Set CONNECTOR_ID_WILDBERRIES after saving the merchant key in the UI."
  failures=$((failures + 1))
else
  wildberries_args=(manage.py wildberries_local_real_test_check --connector-id "$CONNECTOR_ID_WILDBERRIES" --fail-on-missing)
  if [[ "$VALIDATE" == "1" ]]; then
    wildberries_args+=(--validate)
  fi
  run_check "Wildberries readiness" "$PYTHON_BIN" "${wildberries_args[@]}"
fi

if [[ -z "$CONNECTOR_ID_OZON" ]]; then
  echo
  echo "Ozon connector id is missing. Set CONNECTOR_ID_OZON after saving the merchant credentials in the UI."
  failures=$((failures + 1))
else
  ozon_args=(manage.py ozon_local_real_test_check --connector-id "$CONNECTOR_ID_OZON" --fail-on-missing)
  if [[ "$VALIDATE" == "1" ]]; then
    ozon_args+=(--validate)
  fi
  run_check "Ozon readiness" "$PYTHON_BIN" "${ozon_args[@]}"
fi

echo
if [[ $failures -eq 0 ]]; then
  echo "Live connector readiness: PASS"
else
  echo "Live connector readiness: FAIL (${failures} blocked check group(s))"
fi

exit "$failures"
