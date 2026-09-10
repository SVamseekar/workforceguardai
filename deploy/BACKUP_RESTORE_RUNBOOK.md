# Database backup and restore runbook

Covers issue #84's ADR-1 gap: WorkforceGuard's single-file DuckDB warehouse
(`data/workforceguard_analytics.duckdb`) and each tenant's governance
hash-chain store (`data/tenants/<tenant_id>/governance_events.sqlite`) had
no backup strategy. Losing either without a restore path is a production
risk — the DuckDB file holds all modeled analytics, and each governance
store holds the tamper-evident audit log that evidence-pack signing
depends on.

Postgres (auth/session data) is out of scope here — it should use its own
managed backup mechanism (e.g. Cloud SQL automated backups, or `pg_dump` on
a separate schedule) if/when auth data moves off the VM's local Postgres.

## What gets backed up

- `data/workforceguard_analytics.duckdb` — the shared modeled analytics
  warehouse (single file; per-tenant internal data lives in its own DuckDB
  schema inside this file via `tenant_schema`)
- `data/tenants/<tenant_id>/governance_events.sqlite` — every tenant's
  governance hash-chain event store, discovered by globbing
  `data/tenants/*/governance_events.sqlite` (there is no separate tenant
  registry to consult; the directory listing *is* the list of tenants)

**Not covered** by this script: per-tenant uploaded payroll/job-architecture
files (`data/tenants/<id>/internal/`) and automation schedules
(`data/tenants/<id>/automation_schedules.json`). Both are re-derived from
re-uploads or reconfiguration and are lower-value to restore than the
warehouse and the governance hash chain — extend `backup-databases.sh` and
`restore-databases.sh` if that changes.

**Never** `deploy/.env.production` or any other secrets file. The backup
script only ever touches the single named analytics-warehouse path and
`governance_events.sqlite` files specifically — it does not glob or tar
the whole `data/` or `data/tenants/<id>/` directory, so there is no way
for a secret or an uploaded payroll file to end up in a backup by
accident.

## Targets

- **RPO (Recovery Point Objective): ≤ 24 hours.** The timer runs daily at
  03:00 UTC. If more frequent backups are needed (e.g. after a period of
  heavy manual data uploads), run `deploy/backup-databases.sh` manually or
  tighten `OnCalendar` in `deploy/workforceguard-backup.timer`.
- **RTO (Recovery Time Objective): ~15–30 minutes** for a manual restore —
  download two files (small: DuckDB analytics build is low-tens-of-MB
  scale, governance store is small JSON-in-SQLite), verify their hashes,
  stop the service, restore, restart, and re-run
  `deploy/verify-production.sh`.

## One-time setup

1. **Create the GCS bucket** (run this yourself with your own `gcloud`
   credentials — this repo's automation never provisions cloud resources):

   ```bash
   gcloud storage buckets create gs://workforceguard-prod-backups \
     --project=workforceguard-prod \
     --location=us-central1 \
     --uniform-bucket-level-access
   ```

2. **Restrict access.** The bucket must not be public, and only the
   backup principal should be able to write to it:

   ```bash
   # Remove any inherited public/broad access, then grant only the VM's
   # service account (or a dedicated backup service account) write access.
   gcloud storage buckets add-iam-policy-binding gs://workforceguard-prod-backups \
     --member="serviceAccount:<vm-service-account>@workforceguard-prod.iam.gserviceaccount.com" \
     --role="roles/storage.objectAdmin"
   ```

   Grant `roles/storage.objectViewer` instead of `objectAdmin` to any
   principal that only needs to run restores, not backups.

3. **Set a retention/lifecycle policy** so old snapshots age out instead of
   accumulating forever (adjust the retention window to your compliance
   needs — 30 days shown here):

   ```bash
   cat > /tmp/backup-lifecycle.json <<'EOF'
   {
     "rule": [
       {"action": {"type": "Delete"}, "condition": {"age": 30}}
     ]
   }
   EOF
   gcloud storage buckets update gs://workforceguard-prod-backups \
     --lifecycle-file=/tmp/backup-lifecycle.json
   ```

4. **Configure the app:** set `WORKFORCEGUARD_BACKUP_BUCKET` in
   `deploy/.env.production` (see `deploy/.env.production.example`), then
   run `deploy/sync-production-env.sh` if applicable.

5. **Install the daily timer** on the VM:

   ```bash
   bash deploy/install-backup-timer.sh
   ```

6. **Verify it works** with a manual run before trusting the schedule:

   ```bash
   sudo systemctl start workforceguard-backup.service
   sudo journalctl -u workforceguard-backup.service -n 30 --no-pager
   ```

## Backup integrity

`deploy/backup-databases.sh` computes a sha256 of each file *before*
upload, uploads a `<file>.sha256` sidecar alongside it, then immediately
re-downloads the just-uploaded object and re-hashes it — so a backup is
only reported successful if the bytes that landed in GCS provably match
what was read locally, not just that the `gcloud storage cp` command
returned zero.

## Restore procedure

1. **Stop the API service** so nothing writes to the database files during
   the restore:

   ```bash
   sudo systemctl stop workforceguard-api
   ```

2. **List available backups** (optional, to pick a specific timestamp
   instead of the latest):

   ```bash
   gcloud storage ls gs://workforceguard-prod-backups/backups/
   ```

3. **Run the restore.** `deploy/restore-databases.sh` refuses to run
   without `--yes`, and always copies the current local file to
   `<file>.pre-restore-backup` before overwriting it — so a restore can
   itself be undone by hand if it turns out to be the wrong call:

   ```bash
   # Restore the most recent backup — analytics warehouse + every tenant's
   # governance store:
   ./deploy/restore-databases.sh --latest --yes

   # Or a specific point in time:
   ./deploy/restore-databases.sh --timestamp 20260910T030000Z --yes

   # Restore only one tenant's governance store, leaving the analytics
   # warehouse and other tenants untouched (e.g. a single tenant's
   # governance data was corrupted, not the whole warehouse):
   ./deploy/restore-databases.sh --latest --yes --tenant acme-corp --no-analytics
   ```

   The script verifies each downloaded file's sha256 against its `.sha256`
   sidecar before writing anything to disk. If one file's hash doesn't
   match, that file is refused (the process exits non-zero) while every
   other file whose hash did match is still restored — a corrupted backup
   of one tenant's governance store doesn't block recovering the warehouse
   or any other tenant.

4. **Restart the service:**

   ```bash
   sudo systemctl start workforceguard-api
   ```

5. **Verify:**

   ```bash
   bash deploy/verify-production.sh
   ```

   Also spot-check `GET /api/governance-events` shows `integrity.verified:
   true` — confirming the restored governance hash chain is internally
   consistent, not just that the file exists.

## Manual backup (outside the schedule)

Run before any risky operation (a schema migration, a bulk data
re-ingestion, a signing-key rotation):

```bash
./deploy/backup-databases.sh
```

## Related

- [SECURITY.md](../SECURITY.md) — secrets and evidence-pack signing key
  rotation (a different kind of "recovery" concern: key material, not
  data files)
- `deploy/gcp-service.sh` — VM start/stop; the backup timer's
  `Persistent=true` setting means a backup that was scheduled while the VM
  was stopped runs as soon as the VM is next started
