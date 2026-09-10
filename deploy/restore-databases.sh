#!/usr/bin/env bash
# Restore the DuckDB analytics warehouse and/or tenant governance SQLite
# stores from a GCS backup written by deploy/backup-databases.sh.
#
# This is destructive to the LOCAL copies of these files (they are
# replaced), so it always backs up each current local file first, verifies
# every downloaded file's sha256 sidecar before touching anything, and
# refuses to run without --yes.
#
# Usage:
#   WORKFORCEGUARD_BACKUP_BUCKET=gs://workforceguard-prod-backups \
#     ./deploy/restore-databases.sh --timestamp 20260910T030000Z --yes
#   WORKFORCEGUARD_BACKUP_BUCKET=gs://workforceguard-prod-backups \
#     ./deploy/restore-databases.sh --latest --yes
#
# By default restores the analytics warehouse and every tenant's
# governance store found in the chosen backup. Pass --tenant <id> one or
# more times to restore only specific tenants' governance stores (the
# analytics warehouse is still restored unless --no-analytics is given).
#
# See deploy/BACKUP_RESTORE_RUNBOOK.md for the full restore procedure,
# including stopping the service first.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DATA_DIR="$REPO_DIR/data"

DUCKDB_FILE="$DATA_DIR/workforceguard_analytics.duckdb"
TENANTS_DIR="$DATA_DIR/tenants"

: "${WORKFORCEGUARD_BACKUP_BUCKET:?Set WORKFORCEGUARD_BACKUP_BUCKET, e.g. gs://workforceguard-prod-backups (see deploy/BACKUP_RESTORE_RUNBOOK.md)}"

TIMESTAMP=""
CONFIRMED=false
RESTORE_ANALYTICS=true
TENANT_FILTER=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --timestamp)
      TIMESTAMP="$2"
      shift 2
      ;;
    --latest)
      TIMESTAMP="latest"
      shift
      ;;
    --yes)
      CONFIRMED=true
      shift
      ;;
    --tenant)
      TENANT_FILTER+=("$2")
      shift 2
      ;;
    --no-analytics)
      RESTORE_ANALYTICS=false
      shift
      ;;
    *)
      echo "Unknown argument: $1" >&2
      echo "Usage: $0 (--timestamp YYYYMMDDTHHMMSSZ | --latest) --yes [--tenant ID ...] [--no-analytics]" >&2
      exit 1
      ;;
  esac
done

if [[ -z "$TIMESTAMP" ]]; then
  echo "Pass --timestamp YYYYMMDDTHHMMSSZ or --latest." >&2
  exit 1
fi

if ! command -v gcloud >/dev/null 2>&1; then
  echo "gcloud CLI not found. Install the Google Cloud SDK first." >&2
  exit 1
fi

BUCKET="${WORKFORCEGUARD_BACKUP_BUCKET%/}"

if [[ "$TIMESTAMP" == "latest" ]]; then
  echo "Resolving latest backup under ${BUCKET}/backups/..."
  TIMESTAMP="$(gcloud storage ls "${BUCKET}/backups/" | sed -E 's#.*/backups/([^/]+)/?$#\1#' | sort | tail -1)"
  if [[ -z "$TIMESTAMP" ]]; then
    echo "No backups found under ${BUCKET}/backups/." >&2
    exit 1
  fi
  echo "Latest backup: ${TIMESTAMP}"
fi

SRC_PREFIX="${BUCKET}/backups/${TIMESTAMP}"

if [[ "$CONFIRMED" != true ]]; then
  echo "This will REPLACE local database file(s) with the backup from ${TIMESTAMP}."
  if [[ "$RESTORE_ANALYTICS" == true ]]; then
    echo "  ${DUCKDB_FILE}"
  fi
  echo "  Tenant governance stores under ${TENANTS_DIR}/ (all tenants in this backup, unless --tenant is given)"
  echo "Current local files are copied to *.pre-restore-backup first, but re-run with --yes to actually proceed."
  exit 1
fi

# Downloads $1 (a full gs:// object path) to local path $2, verifying its
# sha256 sidecar before returning success. Refuses (non-zero exit) rather
# than writing a file whose hash doesn't match.
download_with_verification() {
  local remote_object="$1"
  local dest="$2"
  local name
  name="$(basename "$dest")"

  local tmp_file tmp_sha256
  tmp_file="$(mktemp)"
  tmp_sha256="$(mktemp)"
  trap 'rm -f "$tmp_file" "$tmp_sha256"' RETURN

  echo "Downloading ${name} from ${remote_object}..."
  gcloud storage cp "$remote_object" "$tmp_file"
  gcloud storage cp "${remote_object}.sha256" "$tmp_sha256"

  local expected_hash actual_hash
  expected_hash="$(awk '{print $1}' "$tmp_sha256")"
  actual_hash="$(shasum -a 256 "$tmp_file" | awk '{print $1}')"
  if [[ "$expected_hash" != "$actual_hash" ]]; then
    echo "INTEGRITY CHECK FAILED for ${name}: expected ${expected_hash}, got ${actual_hash}. Refusing to restore." >&2
    return 1
  fi
  echo "Integrity verified for ${name}."

  if [[ -f "$dest" ]]; then
    local safety_copy="${dest}.pre-restore-backup"
    cp "$dest" "$safety_copy"
    echo "Current local ${name} saved to ${safety_copy} before overwrite."
  fi

  mkdir -p "$(dirname "$dest")"
  mv "$tmp_file" "$dest"
  echo "Restored ${name} from backup ${TIMESTAMP}."
}

echo "=== WorkforceGuard database restore — from ${TIMESTAMP} ==="
STATUS=0

if [[ "$RESTORE_ANALYTICS" == true ]]; then
  analytics_object="${SRC_PREFIX}/analytics/workforceguard_analytics.duckdb"
  if gcloud storage ls "$analytics_object" >/dev/null 2>&1; then
    download_with_verification "$analytics_object" "$DUCKDB_FILE" || STATUS=1
  else
    echo "No analytics warehouse found in backup ${TIMESTAMP} — skipping."
  fi
fi

echo "Listing tenant governance stores in backup ${TIMESTAMP}..."
backed_up_tenants=()
while IFS= read -r tenant_id; do
  [[ -n "$tenant_id" ]] && backed_up_tenants+=("$tenant_id")
done < <(gcloud storage ls "${SRC_PREFIX}/governance/" 2>/dev/null | sed -E 's#.*/governance/([^/]+)/?$#\1#')

if [[ ${#backed_up_tenants[@]} -eq 0 ]]; then
  echo "No tenant governance stores found in backup ${TIMESTAMP}."
else
  for tenant_id in "${backed_up_tenants[@]}"; do
    if [[ ${#TENANT_FILTER[@]} -gt 0 ]]; then
      match=false
      for wanted in "${TENANT_FILTER[@]}"; do
        [[ "$tenant_id" == "$wanted" ]] && match=true
      done
      [[ "$match" == true ]] || continue
    fi
    remote_object="${SRC_PREFIX}/governance/${tenant_id}/governance_events.sqlite"
    dest="${TENANTS_DIR}/${tenant_id}/governance_events.sqlite"
    download_with_verification "$remote_object" "$dest" || STATUS=1
  done
fi

if [[ "$STATUS" -eq 0 ]]; then
  echo ""
  echo "Restore complete. Restart the API service:"
  echo "  sudo systemctl restart workforceguard-api"
else
  echo ""
  echo "Restore finished with errors — see above." >&2
fi
exit "$STATUS"
