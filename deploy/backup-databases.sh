#!/usr/bin/env bash
# Snapshot the DuckDB analytics warehouse and every tenant's governance
# SQLite store to GCS, with a sha256 sidecar per file so a restore can
# verify integrity.
#
# Backs up only these files -- never the whole data/ or deploy/ tree --
# so secrets (deploy/.env.production, OAuth client credentials, the
# session/signing keys) are never included in a backup. Per-tenant
# uploaded payroll/job-architecture data (data/tenants/<id>/internal/) and
# automation schedules are NOT covered by this script; they are re-derived
# from re-uploads and are lower-value to restore than the warehouse and
# the governance hash chain. Extend this script if that changes.
#
# Usage:
#   WORKFORCEGUARD_BACKUP_BUCKET=gs://workforceguard-prod-backups \
#     ./deploy/backup-databases.sh
#
# Run on the production VM (cron/systemd timer — see
# deploy/workforceguard-backup.timer) or manually before a risky operation.
# See deploy/BACKUP_RESTORE_RUNBOOK.md for setup and the restore procedure.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DATA_DIR="$REPO_DIR/data"

DUCKDB_FILE="$DATA_DIR/workforceguard_analytics.duckdb"
TENANTS_DIR="$DATA_DIR/tenants"

: "${WORKFORCEGUARD_BACKUP_BUCKET:?Set WORKFORCEGUARD_BACKUP_BUCKET, e.g. gs://workforceguard-prod-backups (see deploy/BACKUP_RESTORE_RUNBOOK.md)}"

if ! command -v gcloud >/dev/null 2>&1; then
  echo "gcloud CLI not found. Install the Google Cloud SDK first (preinstalled on standard GCE images)." >&2
  exit 1
fi

TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DEST_PREFIX="${WORKFORCEGUARD_BACKUP_BUCKET%/}/backups/${TIMESTAMP}"

# Uploads $1 (a local file) to $2 (a full gs:// object path), then
# re-downloads it and compares hashes -- so success means the bytes that
# landed in GCS provably match what was read locally, not just that
# `gcloud storage cp` returned zero.
upload_with_verification() {
  local src="$1"
  local dest_object="$2"
  local name
  name="$(basename "$src")"

  local sha256_file
  sha256_file="$(mktemp)"
  local verify_file
  verify_file="$(mktemp)"
  trap 'rm -f "$sha256_file" "$verify_file"' RETURN

  local local_hash
  local_hash="$(shasum -a 256 "$src" | awk '{print $1}')"
  echo "${local_hash}  ${name}" > "$sha256_file"

  echo "Uploading ${name} (sha256 ${local_hash:0:12}...) to ${dest_object}"
  gcloud storage cp "$src" "$dest_object"
  gcloud storage cp "$sha256_file" "${dest_object}.sha256"

  gcloud storage cp "$dest_object" "$verify_file"
  local remote_hash
  remote_hash="$(shasum -a 256 "$verify_file" | awk '{print $1}')"

  if [[ "$local_hash" != "$remote_hash" ]]; then
    echo "INTEGRITY CHECK FAILED for ${name}: local ${local_hash} != uploaded ${remote_hash}" >&2
    return 1
  fi
  echo "Integrity verified for ${name}."
}

echo "=== WorkforceGuard database backup — ${TIMESTAMP} ==="
STATUS=0

if [[ -f "$DUCKDB_FILE" ]]; then
  upload_with_verification "$DUCKDB_FILE" "${DEST_PREFIX}/analytics/workforceguard_analytics.duckdb" || STATUS=1
else
  echo "Skipping analytics warehouse — not found at ${DUCKDB_FILE}."
fi

if [[ -d "$TENANTS_DIR" ]]; then
  shopt -s nullglob
  tenant_governance_files=("$TENANTS_DIR"/*/governance_events.sqlite)
  shopt -u nullglob

  if [[ ${#tenant_governance_files[@]} -eq 0 ]]; then
    echo "No tenant governance stores found under ${TENANTS_DIR}."
  fi

  for governance_file in "${tenant_governance_files[@]}"; do
    tenant_id="$(basename "$(dirname "$governance_file")")"
    upload_with_verification "$governance_file" "${DEST_PREFIX}/governance/${tenant_id}/governance_events.sqlite" || STATUS=1
  done
else
  echo "Skipping governance stores — ${TENANTS_DIR} does not exist yet."
fi

if [[ "$STATUS" -eq 0 ]]; then
  echo ""
  echo "Backup complete: ${DEST_PREFIX}/"
else
  echo ""
  echo "Backup finished with errors — see above. Not all files were verified." >&2
fi
exit "$STATUS"
