#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   CHANNEL_ID=123 PUBLIC_URL=https://your-tunnel-domain ./scripts/telegram_local_real_test.sh
#   CHANNEL_ID=123 PUBLIC_URL=https://your-tunnel-domain SET_WEBHOOK=1 ./scripts/telegram_local_real_test.sh

PYTHON_BIN="${PYTHON_BIN:-.venv/bin/python}"
ARGS=(manage.py telegram_local_real_test_check --fail-on-missing)

if [[ -n "${CHANNEL_ID:-}" ]]; then
  ARGS+=(--channel-id "$CHANNEL_ID")
fi

if [[ -n "${PUBLIC_URL:-}" ]]; then
  ARGS+=(--public-url "$PUBLIC_URL")
fi

if [[ "${SET_WEBHOOK:-}" == "1" || "${SET_WEBHOOK:-}" == "true" ]]; then
  ARGS+=(--set-webhook)
fi

"$PYTHON_BIN" "${ARGS[@]}"
