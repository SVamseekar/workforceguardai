#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=domains.env
source "$SCRIPT_DIR/domains.env"

echo "=== WorkforceGuard VM Bootstrap ==="

# Update system
sudo apt-get update -y
sudo apt-get upgrade -y

# Install dependencies
sudo apt-get install -y ca-certificates curl git

# Install Docker (official method)
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
  https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update -y
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Start Docker and enable on boot
sudo systemctl start docker
sudo systemctl enable docker

# Add current user to docker group (takes effect on next login)
sudo usermod -aG docker "$USER"

sudo apt-get install -y nginx certbot python3-certbot-nginx

echo ""
echo "=== Bootstrap complete ==="
echo "Log out and back in for docker group to take effect."
echo ""
echo "Next steps:"
echo "  1. In Porkbun DNS, add an A record:"
echo "       ${API_HOST}  ->  <this VM's public IP>"
echo "  2. bash deploy/install-service.sh"
echo "  3. cp deploy/.env.production.example deploy/.env.production  # fill in secrets"
echo "  4. bash deploy/sync-production-env.sh"
echo "  5. sudo systemctl start workforceguard-api"
echo "  6. bash deploy/configure-api-nginx.sh"
echo "  7. bash deploy/verify-production.sh"