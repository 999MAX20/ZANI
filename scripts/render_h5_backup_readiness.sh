#!/usr/bin/env bash
set -euo pipefail

# Run this before paid-beta traffic and before risky migrations.
# It validates backup/restore prerequisites. Real restore drills must still be
# performed against a separate staging database, never against production.

PYTHON_BIN="${PYTHON_BIN:-python}"

if [[ -z "${ENVIRONMENT:-}" || "${ENVIRONMENT:-}" == "development" ]]; then
  echo "ENVIRONMENT must be set to staging or production for H5 backup readiness." >&2
  exit 1
fi

echo "== H5 backup/restore readiness =="
"$PYTHON_BIN" manage.py backup_restore_readiness_check --fail-on-blockers

echo
echo "H5 readiness gate passed."
echo "Next manual step: rehearse restore into a separate staging database and record RTO/RPO."
