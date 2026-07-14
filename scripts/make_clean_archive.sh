#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ARCHIVE_NAME="${1:-zani-clean.zip}"
ARCHIVE_PATH="$ROOT_DIR/$ARCHIVE_NAME"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

cd "$ROOT_DIR"
rm -f "$ARCHIVE_PATH"

rsync -a ./ "$TMP_DIR/zani/" \
  --include=".env.example" \
  --include=".env.local.example" \
  --include=".env.staging.example" \
  --include=".env.production.example" \
  --include="frontend/.env.example" \
  --include="frontend/.env.staging.example" \
  --include="frontend/.env.production.example" \
  --exclude=".git/" \
  --exclude=".env" \
  --exclude=".env.*" \
  --exclude=".venv/" \
  --exclude="venv/" \
  --exclude="node_modules/" \
  --exclude="frontend/node_modules/" \
  --exclude="frontend/dist/" \
  --exclude="dist/" \
  --exclude="build/" \
  --exclude="db.sqlite3" \
  --exclude="media/" \
  --exclude="staticfiles/" \
  --exclude="test-results/" \
  --exclude="playwright-report/" \
  --exclude="coverage/" \
  --exclude=".coverage" \
  --exclude="__MACOSX/" \
  --exclude=".DS_Store" \
  --exclude="__pycache__/" \
  --exclude="*.pyc" \
  --exclude="*.pyo" \
  --exclude="*.log" \
  --exclude="*.zip" \
  --exclude="*.tsbuildinfo" \
  --exclude=".pytest_cache/" \
  --exclude=".mypy_cache/" \
  --exclude=".ruff_cache/" \
  --exclude="htmlcov/" \
  --exclude="$ARCHIVE_NAME"

(cd "$TMP_DIR" && zip -qr "$ARCHIVE_PATH" zani)

echo "Created clean archive: $ARCHIVE_PATH"
