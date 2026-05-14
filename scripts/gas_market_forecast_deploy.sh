#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT="$ROOT/gas_market_forecast"

: "${GAS_SCRIPT_ID:?GAS_SCRIPT_ID is required}"
: "${CLASP_CLIENT_ID:?CLASP_CLIENT_ID is required}"
: "${CLASP_CLIENT_SECRET:?CLASP_CLIENT_SECRET is required}"
: "${CLASP_REFRESH_TOKEN:?CLASP_REFRESH_TOKEN is required}"

cleanup() {
  rm -f "$PROJECT/.clasp.json"
}
trap cleanup EXIT

cat > "$HOME/.clasprc.json" <<EOFJSON
{
  "token": {
    "access_token": "",
    "refresh_token": "${CLASP_REFRESH_TOKEN}",
    "scope": "https://www.googleapis.com/auth/script.projects https://www.googleapis.com/auth/script.deployments https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/service.management https://www.googleapis.com/auth/logging.read https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/cloud-platform",
    "token_type": "Bearer",
    "expiry_date": 0
  },
  "oauth2ClientSettings": {
    "clientId": "${CLASP_CLIENT_ID}",
    "clientSecret": "${CLASP_CLIENT_SECRET}",
    "redirectUri": "http://localhost"
  },
  "isLocalCreds": false
}
EOFJSON

cat > "$PROJECT/.clasp.json" <<EOFJSON
{
  "scriptId": "${GAS_SCRIPT_ID}",
  "rootDir": "."
}
EOFJSON

(
  cd "$PROJECT"
  clasp push --force
)
echo 'Apps Script deployment complete.'
