#!/usr/bin/env bash
set -euo pipefail

API_BASE_URL="${API_BASE_URL:-}"
FRONTEND_URL="${FRONTEND_URL:-}"
PLATFORM_ADMIN_EMAIL="${PLATFORM_ADMIN_EMAIL:-}"
PLATFORM_ADMIN_PASSWORD="${PLATFORM_ADMIN_PASSWORD:-}"
MERCHANT_OWNER_EMAIL="${MERCHANT_OWNER_EMAIL:-}"
MERCHANT_OWNER_PASSWORD="${MERCHANT_OWNER_PASSWORD:-}"
PYTHON_BIN="${PYTHON_BIN:-}"

if [[ -z "$API_BASE_URL" ]]; then
  echo "API_BASE_URL is required, for example: https://api-staging.zani.example" >&2
  exit 2
fi

API_BASE_URL="${API_BASE_URL%/}"

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

if [[ -z "$PYTHON_BIN" ]]; then
  if command -v python3 >/dev/null 2>&1; then
    PYTHON_BIN="python3"
  elif command -v python >/dev/null 2>&1; then
    PYTHON_BIN="python"
  else
    echo "python3 or python is required for JSON parsing." >&2
    exit 2
  fi
fi

request_json() {
  local method="$1"
  local url="$2"
  local output_file="$3"
  shift 3

  curl --fail --silent --show-error \
    --request "$method" \
    --header "Accept: application/json" \
    "$@" \
    --output "$output_file" \
    "$url"
}

extract_json_field() {
  local file_path="$1"
  local field_name="$2"

  "$PYTHON_BIN" - "$file_path" "$field_name" <<'PY'
import json
import sys

with open(sys.argv[1], "r", encoding="utf-8") as source:
    payload = json.load(source)

value = payload.get(sys.argv[2], "")
if value is None:
    value = ""
print(value)
PY
}

check_endpoint() {
  local path="$1"
  local label="$2"
  local output_file="$tmp_dir/${label// /_}.json"

  echo "== $label =="
  request_json GET "$API_BASE_URL$path" "$output_file"
}

login_and_check_me() {
  local email="$1"
  local password="$2"
  local label="$3"
  local token_file="$tmp_dir/${label}_token.json"
  local me_file="$tmp_dir/${label}_me.json"

  echo "== Login: $label =="
  request_json POST "$API_BASE_URL/api/auth/token/" "$token_file" \
    --header "Content-Type: application/json" \
    --data "{\"email\":\"$email\",\"password\":\"$password\"}"

  local access_token
  access_token="$(extract_json_field "$token_file" access)"
  if [[ -z "$access_token" ]]; then
    echo "Login succeeded but access token is missing for $label" >&2
    exit 1
  fi

  echo "== Auth me: $label =="
  request_json GET "$API_BASE_URL/api/auth/me/" "$me_file" \
    --header "Authorization: Bearer $access_token"

  if [[ "$label" == "merchant_owner" ]]; then
    echo "== Merchant API smoke =="
    request_json GET "$API_BASE_URL/api/businesses/" "$tmp_dir/businesses.json" \
      --header "Authorization: Bearer $access_token"
    request_json GET "$API_BASE_URL/api/leads/" "$tmp_dir/leads.json" \
      --header "Authorization: Bearer $access_token"
    request_json GET "$API_BASE_URL/api/conversations/" "$tmp_dir/conversations.json" \
      --header "Authorization: Bearer $access_token"
    request_json GET "$API_BASE_URL/api/billing/usage-summary/" "$tmp_dir/usage_summary.json" \
      --header "Authorization: Bearer $access_token"
  fi

  if [[ "$label" == "platform_admin" ]]; then
    echo "== Platform API smoke =="
    request_json GET "$API_BASE_URL/api/platform/ping/" "$tmp_dir/platform_ping.json" \
      --header "Authorization: Bearer $access_token"
  fi
}

check_endpoint "/health/" "health"
check_endpoint "/health/db/" "health db"
check_endpoint "/ready/" "ready"

if [[ -n "$FRONTEND_URL" ]]; then
  echo "== CORS preflight smoke =="
  cors_headers="$tmp_dir/cors_headers.txt"
  curl --fail --silent --show-error \
    --request OPTIONS \
    --dump-header "$cors_headers" \
    --header "Origin: ${FRONTEND_URL%/}" \
    --header "Access-Control-Request-Method: POST" \
    "$API_BASE_URL/api/auth/token/" >/dev/null

  if ! grep -qi "^access-control-allow-origin: ${FRONTEND_URL%/}" "$cors_headers"; then
    echo "CORS preflight did not return Access-Control-Allow-Origin for ${FRONTEND_URL%/}." >&2
    echo "Check backend CORS_ALLOWED_ORIGINS and redeploy." >&2
    exit 1
  fi
fi

if [[ -n "$PLATFORM_ADMIN_EMAIL" && -n "$PLATFORM_ADMIN_PASSWORD" ]]; then
  login_and_check_me "$PLATFORM_ADMIN_EMAIL" "$PLATFORM_ADMIN_PASSWORD" "platform_admin"
else
  echo "Skipping platform login smoke: PLATFORM_ADMIN_EMAIL/PASSWORD are not set."
fi

if [[ -n "$MERCHANT_OWNER_EMAIL" && -n "$MERCHANT_OWNER_PASSWORD" ]]; then
  login_and_check_me "$MERCHANT_OWNER_EMAIL" "$MERCHANT_OWNER_PASSWORD" "merchant_owner"
else
  echo "Skipping merchant login smoke: MERCHANT_OWNER_EMAIL/PASSWORD are not set."
fi

if [[ -n "$FRONTEND_URL" ]]; then
  echo "== Frontend smoke =="
  frontend_base_url="${FRONTEND_URL%/}"
  curl --fail --silent --show-error --head "$frontend_base_url/" >/dev/null

  echo "== Frontend SPA route smoke =="
  curl --fail --silent --show-error --head "$frontend_base_url/login" >/dev/null
else
  echo "Skipping frontend smoke: FRONTEND_URL is not set."
fi

echo "Staging smoke completed."
