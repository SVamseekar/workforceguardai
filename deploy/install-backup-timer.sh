#!/usr/bin/env bash
# Installs and enables the daily database backup timer on the VM.
# Run this once after setting WORKFORCEGUARD_BACKUP_BUCKET in
# deploy/.env.production. See deploy/BACKUP_RESTORE_RUNBOOK.md.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
USERNAME="$(whoami)"

echo "=== Installing WorkforceGuard backup timer ==="

sed "s/REPLACE_USER/$USERNAME/g" \
    "$REPO_DIR/deploy/workforceguard-backup.service" \
  > /tmp/workforceguard-backup.service
sudo mv /tmp/workforceguard-backup.service /etc/systemd/system/workforceguard-backup.service

sudo cp "$REPO_DIR/deploy/workforceguard-backup.timer" /etc/systemd/system/workforceguard-backup.timer

sudo systemctl daemon-reload
sudo systemctl enable --now workforceguard-backup.timer

echo ""
echo "Timer installed and enabled."
echo "Next scheduled run:"
systemctl list-timers workforceguard-backup.timer --no-pager | sed -n '1,2p'
echo "Run a backup immediately:  sudo systemctl start workforceguard-backup.service"
echo "Logs:                      sudo journalctl -u workforceguard-backup.service -f"
