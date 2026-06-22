#!/usr/bin/env bash
# On-demand control for WorkforceGuard on GCP.
# Usage:
#   ./deploy/gcp-service.sh start   # start VM + API service
#   ./deploy/gcp-service.sh stop    # stop API service + VM
#   ./deploy/gcp-service.sh status  # show VM and API health
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=domains.env
source "$SCRIPT_DIR/domains.env"

PROJECT=workforceguard-prod
ZONE=us-central1-f
VM=workforceguard-vm

vm_status() {
  gcloud compute instances describe "$VM" --zone="$ZONE" --project="$PROJECT" --format="get(status)"
}

wait_for_ssh() {
  echo "Waiting for SSH on $VM..."
  for _ in $(seq 1 30); do
    if gcloud compute ssh "$VM" --zone="$ZONE" --project="$PROJECT" --command="true" 2>/dev/null; then
      return 0
    fi
    sleep 5
  done
  echo "SSH not ready after 150s"
  return 1
}

case "${1:-status}" in
  start)
    echo "Starting VM $VM..."
    gcloud compute instances start "$VM" --zone="$ZONE" --project="$PROJECT"
    wait_for_ssh
    echo "Starting workforceguard-api service..."
    gcloud compute ssh "$VM" --zone="$ZONE" --project="$PROJECT" --command="
      sudo systemctl enable workforceguard-api
      sudo systemctl start workforceguard-api
      sleep 8
      curl -sf http://localhost:8080/health && echo 'API healthy' || (sudo journalctl -u workforceguard-api -n 20 --no-pager; exit 1)
    "
    echo ""
    echo "VM IP: $(gcloud compute instances describe "$VM" --zone="$ZONE" --project="$PROJECT" --format='get(networkInterfaces[0].accessConfigs[0].natIP)')"
    echo "API (when DNS is set): https://${API_HOST}/health"
    echo "Dashboard: ${FRONTEND_URL}"
    ;;
  stop)
    echo "Stopping API service on $VM..."
    if [[ "$(vm_status)" == "RUNNING" ]]; then
      gcloud compute ssh "$VM" --zone="$ZONE" --project="$PROJECT" --command="
        sudo systemctl stop workforceguard-api || true
        sudo systemctl disable workforceguard-api || true
      " || true
    fi
    echo "Stopping VM $VM..."
    gcloud compute instances stop "$VM" --zone="$ZONE" --project="$PROJECT"
    echo "Stopped. You are not paying for a running VM."
    ;;
  status)
    status="$(vm_status)"
    ip="$(gcloud compute instances describe "$VM" --zone="$ZONE" --project="$PROJECT" --format='get(networkInterfaces[0].accessConfigs[0].natIP)' 2>/dev/null || echo '-')"
    echo "VM: $VM ($status)"
    echo "IP: $ip"
    if [[ "$status" == "RUNNING" ]]; then
      gcloud compute ssh "$VM" --zone="$ZONE" --project="$PROJECT" --command="
        echo -n 'API service: '
        systemctl is-active workforceguard-api 2>/dev/null || echo inactive
        curl -sf http://localhost:8080/health >/dev/null && echo 'Health: OK' || echo 'Health: not responding'
      " 2>/dev/null || echo "SSH unavailable"
      curl -sf --max-time 5 "http://${ip}:8080/health" >/dev/null && echo "Public :8080: reachable" || echo "Public :8080: not reachable"
    fi
    ;;
  *)
    echo "Usage: $0 {start|stop|status}"
    exit 1
    ;;
esac