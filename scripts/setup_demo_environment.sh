#!/usr/bin/env bash
# Seed demo tenant data for landing captures and sales walkthroughs.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

SCENARIO="${1:-meridian-cz}"
TENANT_ID="${2:-a0000000-0000-4000-8000-000000000001}"
SKIP_DBT="${SKIP_DBT:-0}"

echo "==> Seeding demo tenant (scenario=${SCENARIO}, tenant_id=${TENANT_ID})"

ARGS=(--scenario "$SCENARIO" --tenant-id "$TENANT_ID")
if [[ "$SKIP_DBT" == "1" ]]; then
  ARGS+=(--skip-dbt)
fi

python scripts/seed_demo_tenant.py "${ARGS[@]}"

if [[ -n "${DATABASE_URL:-}" ]]; then
  echo "==> Creating capture admin session (Postgres available)"
  python scripts/seed_capture_session.py --tenant-id "$TENANT_ID"
else
  echo "==> Skipping capture session (set DATABASE_URL to provision Postgres demo user)"
fi

cat <<EOF

Demo environment ready.

Next steps:
  1. Backend:  cd dashboard/backend && uvicorn main:app --reload --port 8001
  2. Frontend: cd dashboard/frontend && npm run dev
  3. Assets:   node scripts/capture_landing_assets.mjs   # optional Playwright refresh
  4. Verify:   ls dashboard/frontend/public/screenshots/*.png | wc -l   # expect 6

Landing screenshots already wired in ProductTour + AnalystDemoTheater.
EOF
