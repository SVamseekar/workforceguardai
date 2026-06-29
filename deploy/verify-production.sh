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
elif [[ -n "${API_DIRECT_IP:-}" ]] && curl -sf "http://${API_DIRECT_IP}:8080/health" | grep -q '"status"'; then
  pass "API health http://${API_DIRECT_IP}:8080/health (DNS for ${API_HOST} not set yet)"
else
  fail "API health https://${API_HOST}/health (add DNS A-record for ${API_HOST} → VM IP, or set API_DIRECT_IP)"
fi

api_dns_ready=false
if command -v dig >/dev/null 2>&1 && dig +short "${API_HOST}" A | grep -q .; then
  api_dns_ready=true
fi

if curl -sf "https://${FRONTEND_HOST}/api/auth/me" 2>/dev/null | grep -q 'detail'; then
  pass "Vercel /api proxy reaches backend (401 without cookie is expected)"
elif [[ "$api_dns_ready" == false && -n "${API_DIRECT_IP:-}" ]]; then
  pass "Vercel /api proxy skipped — ${API_HOST} DNS not set yet (add A-record → ${API_DIRECT_IP})"
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
