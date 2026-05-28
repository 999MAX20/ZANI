#!/usr/bin/env bash
set -euo pipefail

# Preflight for a local real Instagram Meta Graph test.
# Usage:
#   PUBLIC_URL=https://your-tunnel-domain ./scripts/instagram_local_real_test.sh

PYTHON_BIN="${PYTHON_BIN:-.venv/bin/python}"
PUBLIC_URL="${PUBLIC_URL:-}"

if [[ -z "$PUBLIC_URL" ]]; then
  echo "Set PUBLIC_URL to your public HTTPS tunnel, for example:"
  echo "  PUBLIC_URL=https://your-tunnel-domain ./scripts/instagram_local_real_test.sh"
  exit 2
fi

echo "== Instagram local real-test preflight =="
"$PYTHON_BIN" manage.py instagram_local_real_test_check --public-url "$PUBLIC_URL" --fail-on-missing

echo
echo "Meta Dashboard values:"
echo "  Webhook callback URL: ${PUBLIC_URL%/}/api/integrations/instagram/webhook/"
echo
echo "Next:"
echo "  1. Add the callback URL and verify token in Meta App Dashboard."
echo "  2. Subscribe Instagram messaging webhook fields for the test app/page."
echo "  3. Open ZANI and run Instagram -> configure -> Проверить Meta доступ."
