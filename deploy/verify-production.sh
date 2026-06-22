#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=domains.env
source "$SCRIPT_DIR/domains.env"

pass() { echo "✓ $1"; }
fail() { echo "✗ $1"; FAIL=1; }

FAIL=0

echo "=== WorkforceGuard production checks ==="
echo ""

if curl -sf "https://${FRONTEND_HOST}/" >/dev/null; then
  pass "Landing page https://${FRONTEND_HOST}/"
else
  fail "Landing page https://${FRONTEND_HOST}/"
fi

if curl -sf "https://${FRONTEND_HOST}/app" >/dev/null; then
  pass "Dashboard shell https://${FRONTEND_HOST}/app"
else
  fail "Dashboard shell https://${FRONTEND_HOST}/app"
fi

if curl -sf "https://${API_HOST}/health" | grep -q '"status"'; then
  pass "API health https://${API_HOST}/health"
else
  fail "API health https://${API_HOST}/health (is DNS A-record set for ${API_HOST}?)"
fi

if curl -sf "https://${FRONTEND_HOST}/api/auth/me" 2>/dev/null | grep -q 'detail'; then
  pass "Vercel /api proxy reaches backend (401 without cookie is expected)"
else
  fail "Vercel /api proxy https://${FRONTEND_HOST}/api/auth/me"
fi

echo ""
if [[ "${FAIL:-0}" -eq 0 ]]; then
  echo "All checks passed."
else
  echo "Some checks failed — see messages above."
  exit 1
fi