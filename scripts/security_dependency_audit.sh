#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PYTHON_BIN="${PYTHON_BIN:-$ROOT_DIR/.venv/bin/python}"

if [ ! -x "$PYTHON_BIN" ]; then
  echo "Python runtime not found: $PYTHON_BIN" >&2
  exit 1
fi

if ! "$PYTHON_BIN" -m pip_audit --version >/dev/null 2>&1; then
  echo "pip-audit is not installed in the selected Python environment." >&2
  echo "Install it with: $PYTHON_BIN -m pip install pip-audit" >&2
  exit 1
fi

echo "== Python dependency audit =="
"$PYTHON_BIN" -m pip_audit -r "$ROOT_DIR/requirements.txt"

echo
echo "== Frontend dependency audit =="
cd "$ROOT_DIR/frontend"
npm audit --audit-level=high
