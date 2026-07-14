#!/usr/bin/env bash
set -euo pipefail

# Preflight for a local real WhatsApp Meta Cloud test.
# Usage:
#   PUBLIC_URL=https://your-tunnel-domain ./scripts/whatsapp_local_real_test.sh

PYTHON_BIN="${PYTHON_BIN:-.venv/bin/python}"
PUBLIC_URL="${PUBLIC_URL:-}"

if [[ -z "$PUBLIC_URL" ]]; then
  echo "Set PUBLIC_URL to your public HTTPS tunnel, for example:"
  echo "  PUBLIC_URL=https://your-tunnel-domain ./scripts/whatsapp_local_real_test.sh"
  exit 2
fi

echo "== WhatsApp local real-test preflight =="
"$PYTHON_BIN" manage.py whatsapp_local_real_test_check --public-url "$PUBLIC_URL" --fail-on-missing

echo
echo "Meta Dashboard values:"
echo "  Webhook callback URL: ${PUBLIC_URL%/}/api/integrations/whatsapp/webhook/"
echo "  Embedded Signup redirect URI: ${PUBLIC_URL%/}/dashboard/integrations"
echo
echo "Next:"
echo "  1. Add the callback URL and verify token in Meta App Dashboard."
echo "  2. Add the redirect URI in Meta Login/Embedded Signup settings."
echo "  3. Open ZANI and run WhatsApp -> Подключить через Meta."
