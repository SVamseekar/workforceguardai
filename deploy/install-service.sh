#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
USERNAME="$(whoami)"
USER_UID="$(id -u)"
USER_GID="$(id -g)"

echo "=== Installing WorkforceGuard systemd service ==="

# Substitute the actual username into the service file
sed -e "s/REPLACE_USER/$USERNAME/g" \
    -e "s/REPLACE_UID/$USER_UID/g" \
    -e "s/REPLACE_GID/$USER_GID/g" \
    "$REPO_DIR/deploy/workforceguard-api.service" \
  > /tmp/workforceguard-api.service
sudo mv /tmp/workforceguard-api.service /etc/systemd/system/workforceguard-api.service

# Reload systemd and enable service on boot
sudo systemctl daemon-reload
sudo systemctl enable workforceguard-api

echo ""
echo "Service installed and enabled."
echo "Start with:  sudo systemctl start workforceguard-api"
echo "Status:      sudo systemctl status workforceguard-api"
echo "Logs:        sudo journalctl -u workforceguard-api -f"
