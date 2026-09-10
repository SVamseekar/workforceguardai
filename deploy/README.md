# deploy/

Scripts and config for the production VM (`workforceguard-vm`, GCE project
`workforceguard-prod`). Run `setup-vm.sh` once on a fresh VM; the rest are
day-2 operations.

- `setup-vm.sh` — bootstrap a fresh VM (Docker, nginx, certbot)
- `install-service.sh` — install/enable the `workforceguard-api` systemd
  service
- `sync-production-env.sh` — merge `domains.env` into `deploy/.env.production`
- `configure-api-nginx.sh` / `ensure-api-dns.sh` — TLS + DNS for the API
  subdomain
- `ensure-postgres.sh` — local Postgres container for auth/session data
- `gcp-service.sh` — start/stop/status the VM on demand
- `verify-production.sh` — post-deploy smoke checks
- `migrate-legacy-data.sh` — move pre-multi-tenant data into a tenant
- `oauth-production-smoke-test.md` — manual OAuth verification steps
- **`BACKUP_RESTORE_RUNBOOK.md`** — DuckDB warehouse + governance store
  backup/restore procedure, RPO/RTO targets, and one-time GCS setup.
  `backup-databases.sh` / `restore-databases.sh` / `install-backup-timer.sh`
  / `workforceguard-backup.{service,timer}` implement it.
