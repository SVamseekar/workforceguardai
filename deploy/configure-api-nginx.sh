#!/usr/bin/env bash
# Run on the GCP VM after DNS A-record for API_HOST points at this machine's public IP.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=domains.env
source "$SCRIPT_DIR/domains.env"

echo "=== Configuring nginx for ${API_HOST} ==="

sudo tee /etc/nginx/sites-available/workforceguard-api > /dev/null <<NGINX_CONF
server {
    listen 80;
    server_name ${API_HOST};

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
NGINX_CONF

sudo ln -sf /etc/nginx/sites-available/workforceguard-api /etc/nginx/sites-enabled/workforceguard-api
sudo nginx -t
sudo systemctl reload nginx

echo "Requesting TLS certificate..."
sudo certbot --nginx -d "${API_HOST}" --non-interactive --agree-tos -m "${CERTBOT_EMAIL}"

echo ""
echo "API should now be reachable at https://${API_HOST}/health"
curl -sf "https://${API_HOST}/health" && echo " — health check OK" || echo "Health check failed — confirm DNS and systemd service"