#!/usr/bin/env bash
# Merge production domain settings into deploy/.env.production on the VM.
# Run from the repo root on the VM after filling in secrets below.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$REPO_DIR/deploy/.env.production"
EXAMPLE="$REPO_DIR/deploy/.env.production.example"
DOMAINS="$REPO_DIR/deploy/domains.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Creating $ENV_FILE from example..."
  cp "$EXAMPLE" "$ENV_FILE"
  echo ""
  echo "IMPORTANT: Edit $ENV_FILE and set DATABASE_URL, SESSION_SECRET, and OAuth client credentials."
  echo "Then re-run this script."
  exit 1
fi

# shellcheck source=domains.env
source "$DOMAINS"

upsert() {
  local key="$1" value="$2"
  if grep -q "^${key}=" "$ENV_FILE"; then
    sed -i.bak "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
  else
    echo "${key}=${value}" >> "$ENV_FILE"
  fi
}

upsert CORS_ALLOWED_ORIGINS "${FRONTEND_ORIGIN}"
upsert FRONTEND_URL "${FRONTEND_URL}"
upsert OAUTH_REDIRECT_BASE_URL "${FRONTEND_ORIGIN}"
upsert OAUTH_AUTO_PROVISION "0"

rm -f "${ENV_FILE}.bak"

echo "Updated $ENV_FILE with production domain settings."
echo "Restart the API: sudo systemctl restart workforceguard-api"
echo "Then run the OAuth smoke test: deploy/oauth-production-smoke-test.md"
