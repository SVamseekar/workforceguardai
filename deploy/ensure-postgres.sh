#!/usr/bin/env bash
# Ensure a local Postgres container is running for multi-tenant auth.
# Run from the repo root on the VM (or via deploy workflow over SSH).
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$REPO_DIR/deploy/.env.production"
CONTAINER_NAME="workforceguard-postgres"
NETWORK_NAME="workforceguard-net"
VOLUME_NAME="workforceguard-postgres-data"
PG_USER="workforceguard"
PG_DB="workforceguard"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE — copy deploy/.env.production.example and fill in secrets first."
  exit 1
fi

# shellcheck disable=SC1090
source "$ENV_FILE"

upsert_env() {
  local key="$1" value="$2"
  if grep -q "^${key}=" "$ENV_FILE"; then
    sed -i.bak "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
  else
    echo "${key}=${value}" >> "$ENV_FILE"
  fi
}

if [[ -z "${POSTGRES_PASSWORD:-}" ]]; then
  POSTGRES_PASSWORD="$(openssl rand -hex 24)"
  upsert_env POSTGRES_PASSWORD "$POSTGRES_PASSWORD"
  rm -f "${ENV_FILE}.bak"
  echo "Generated POSTGRES_PASSWORD in $ENV_FILE"
fi

if [[ -z "${SESSION_SECRET:-}" ]]; then
  SESSION_SECRET="$(openssl rand -hex 32)"
  upsert_env SESSION_SECRET "$SESSION_SECRET"
  rm -f "${ENV_FILE}.bak"
  echo "Generated SESSION_SECRET in $ENV_FILE"
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  DATABASE_URL="postgresql://${PG_USER}:${POSTGRES_PASSWORD}@${CONTAINER_NAME}:5432/${PG_DB}"
  upsert_env DATABASE_URL "$DATABASE_URL"
  rm -f "${ENV_FILE}.bak"
  echo "Set DATABASE_URL in $ENV_FILE"
fi

if ! docker network inspect "$NETWORK_NAME" >/dev/null 2>&1; then
  docker network create "$NETWORK_NAME"
fi

if ! docker volume inspect "$VOLUME_NAME" >/dev/null 2>&1; then
  docker volume create "$VOLUME_NAME"
fi

if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER_NAME"; then
  docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
  docker run -d \
    --name "$CONTAINER_NAME" \
    --network "$NETWORK_NAME" \
    --restart unless-stopped \
    -e POSTGRES_USER="$PG_USER" \
    -e POSTGRES_PASSWORD="$POSTGRES_PASSWORD" \
    -e POSTGRES_DB="$PG_DB" \
    -v "${VOLUME_NAME}:/var/lib/postgresql/data" \
    postgres:16
  echo "Started $CONTAINER_NAME"
else
  echo "$CONTAINER_NAME already running"
fi

for attempt in $(seq 1 30); do
  if docker exec "$CONTAINER_NAME" pg_isready -U "$PG_USER" -d "$PG_DB" >/dev/null 2>&1; then
    echo "Postgres ready after ${attempt} attempt(s)"
    exit 0
  fi
  echo "Waiting for Postgres (${attempt}/30)..."
  sleep 2
done

echo "Postgres failed to become ready"
exit 1
