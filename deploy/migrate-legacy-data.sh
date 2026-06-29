#!/usr/bin/env bash
# Move pre-multi-tenant data under data/tenants/{id}/ when legacy paths still exist.
# Idempotent: safe to run on every deploy.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$REPO_DIR/deploy/.env.production"
IMAGE_TAG="${WORKFORCEGUARD_IMAGE:-workforceguard-api:latest}"

ADMIN_EMAIL="${BOOTSTRAP_ADMIN_EMAIL:-martisoura@gmail.com}"
ADMIN_NAME="${BOOTSTRAP_ADMIN_NAME:-Marti Soura Vamseekar}"
TENANT_NAME="${BOOTSTRAP_TENANT_NAME:-WorkforceGuard}"

legacy_paths_present() {
  local internal_dir="$REPO_DIR/data/internal"
  if [[ -d "$internal_dir" ]] && find "$internal_dir" -mindepth 1 ! -name '.gitkeep' -print -quit | grep -q .; then
    return 0
  fi
  for rel in data/governance_events.sqlite data/automation_schedules.json; do
    if [[ -e "$REPO_DIR/$rel" ]]; then
      return 0
    fi
  done
  return 1
}

if ! legacy_paths_present; then
  echo "No legacy global data paths found — migration not needed."
  exit 0
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE — cannot run tenant migration."
  exit 1
fi

# shellcheck disable=SC1090
source "$ENV_FILE"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is not set in $ENV_FILE — run deploy/ensure-postgres.sh first."
  exit 1
fi

if ! docker image inspect "$IMAGE_TAG" >/dev/null 2>&1; then
  echo "Docker image $IMAGE_TAG not found — build it before running migration."
  exit 1
fi

echo "Legacy data detected — running migrate_to_tenant.py..."
docker run --rm \
  --user "$(id -u):$(id -g)" \
  --network workforceguard-net \
  --env-file "$ENV_FILE" \
  -e WORKFORCEGUARD_ROOT=/app_root \
  -e WORKFORCEGUARD_SKIP_MIGRATION_CHECK=1 \
  -v "$REPO_DIR/data:/app_root/data" \
  -v "$REPO_DIR/analytics:/app_root/analytics" \
  "$IMAGE_TAG" \
  python migrate_to_tenant.py "$ADMIN_EMAIL" "$ADMIN_NAME" "$TENANT_NAME"

echo "Tenant migration complete."
