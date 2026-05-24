#!/usr/bin/env bash
set -euo pipefail

# Run before enabling any real external provider traffic.
# PROVIDER can be one of: telegram, website, email, openai, whatsapp, instagram, marketplace.

PYTHON_BIN="${PYTHON_BIN:-python}"
PROVIDER="${PROVIDER:-}"

echo "== H7 provider rollout readiness =="
if [[ -n "$PROVIDER" ]]; then
  "$PYTHON_BIN" manage.py provider_rollout_readiness_check --provider "$PROVIDER" --fail-on-blockers
else
  "$PYTHON_BIN" manage.py provider_rollout_readiness_check --fail-on-blockers
fi

echo
echo "H7 provider rollout readiness passed."
