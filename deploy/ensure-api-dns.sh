#!/usr/bin/env bash
# Create or update the API subdomain A-record at Porkbun when API keys are configured.
# Optional GitHub secrets: PORKBUN_API_KEY, PORKBUN_SECRET_API_KEY
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=domains.env
source "$SCRIPT_DIR/domains.env"

API_IP="${1:-${GCP_VM_IP:-}}"
if [[ -z "$API_IP" ]]; then
  echo "Usage: ensure-api-dns.sh <vm-public-ip>"
  echo "Or set GCP_VM_IP in the environment."
  exit 1
fi

if [[ -z "${PORKBUN_API_KEY:-}" || -z "${PORKBUN_SECRET_API_KEY:-}" ]]; then
  echo "Porkbun API keys not set — add DNS manually:"
  echo "  ${API_HOST}  A  ${API_IP}"
  exit 0
fi

DOMAIN="souravamseekar.com"
RECORD_NAME="api.workforceguardai"

payload=$(cat <<JSON
{
  "apikey": "${PORKBUN_API_KEY}",
  "secretapikey": "${PORKBUN_SECRET_API_KEY}",
  "name": "${RECORD_NAME}",
  "type": "A",
  "content": "${API_IP}",
  "ttl": "600"
}
JSON
)

response=$(curl -sf -X POST "https://api.porkbun.com/api/json/v3/dns/create/${DOMAIN}" \
  -H "Content-Type: application/json" \
  -d "$payload" || true)

if echo "$response" | grep -q '"status":"SUCCESS"'; then
  echo "Created DNS A record ${RECORD_NAME}.${DOMAIN} → ${API_IP}"
else
  echo "DNS create response: $response"
  echo "If the record already exists, update it in Porkbun to point at ${API_IP}"
fi
