#!/usr/bin/env bash
set -euo pipefail

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

sudo tee /etc/nginx/sites-available/workforceguard-api > /dev/null <<'NGINX_CONF'
server {
    listen 80;
    server_name api.workforceguard.example;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
NGINX_CONF

sudo ln -sf /etc/nginx/sites-available/workforceguard-api /etc/nginx/sites-enabled/workforceguard-api
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d api.workforceguard.example --non-interactive --agree-tos -m ops@workforceguard.example

echo ""
echo "=== Bootstrap complete ==="
echo "Log out and back in for docker group to take effect."
echo "Then run: bash deploy/install-service.sh"
