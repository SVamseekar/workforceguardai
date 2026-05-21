# GCP + Vercel Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy the WorkforceGuard AI backend to a GCP Compute Engine e2-micro VM in Frankfurt (europe-west3) and the React frontend to Vercel, with GitHub Actions CI/CD, all within the $10/month GCP credit.

**Architecture:** FastAPI backend runs in Docker on a persistent GCP VM (e2-micro, 20GB SSD, europe-west3-c). The DuckDB warehouse and SQLite governance log live on the VM's persistent boot disk — no cloud storage needed. The React/Vite frontend deploys to Vercel free tier and calls the VM's public IP via `VITE_API_BASE_URL`.

**Tech Stack:** GCP Compute Engine, Docker, Ubuntu 22.04 LTS, systemd, Vercel CLI, GitHub Actions, FastAPI/uvicorn, React/Vite/TypeScript

---

## Prerequisites (do these before starting)

- `gcloud` CLI installed locally (`brew install google-cloud-sdk` on Mac)
- `vercel` CLI installed locally (`npm install -g vercel`)
- `docker` installed locally (for testing the image before pushing)
- GCP project created and billing account linked (with $10/month Google AI Pro credit)
- GitHub repository for this project (the codebase is already git-tracked)
- Vercel account created (free tier, sign up at vercel.com)

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `dashboard/backend/main.py` | Modify | Replace hardcoded `allow_origins=["*"]` with env-driven CORS |
| `dashboard/backend/Dockerfile` | Modify | Fix COPY paths, add health check |
| `dashboard/backend/.dockerignore` | Modify | Exclude .venv, tests, __pycache__ |
| `dashboard/frontend/vercel.json` | Create | SPA routing rewrites |
| `dashboard/frontend/.env.production` | Create | Production API URL (gitignored) |
| `.github/workflows/deploy.yml` | Create | CI/CD: build + SSH deploy to VM + Vercel deploy |
| `deploy/setup-vm.sh` | Create | One-shot VM bootstrap script (Docker, git, etc.) |
| `deploy/workforceguard-api.service` | Create | systemd unit file for auto-restart |

---

## Task 1: Fix CORS in the Backend

**Files:**
- Modify: `dashboard/backend/main.py:52-58`

The current code has `allow_origins=["*"]` hardcoded. This needs to read from an environment variable so the production deployment can restrict origins to the Vercel URL.

- [ ] **Step 1: Edit `dashboard/backend/main.py`**

Replace lines 52–58 (the `app.add_middleware` block) with:

```python
_raw_origins = os.environ.get("CORS_ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:3000")
_allowed_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

`os` is already imported at line 4 — no new import needed.

- [ ] **Step 2: Verify backend still starts locally**

```bash
cd dashboard/backend
python main.py
```

Expected output: `INFO: Uvicorn running on http://127.0.0.1:8001`

Press Ctrl+C to stop.

- [ ] **Step 3: Commit**

```bash
git add dashboard/backend/main.py
git commit -m "fix: drive CORS allowed origins from CORS_ALLOWED_ORIGINS env var"
```

---

## Task 2: Fix the Dockerfile

**Files:**
- Modify: `dashboard/backend/Dockerfile`
- Modify: `dashboard/backend/.dockerignore`

The current Dockerfile copies `data/` into the image. This bakes the database into the image — every deploy would reset the data. Instead, data must be mounted from the VM's disk at runtime.

- [ ] **Step 1: Rewrite `dashboard/backend/Dockerfile`**

```dockerfile
FROM python:3.12-slim

WORKDIR /app

COPY dashboard/backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY dashboard/backend/ .

ENV WORKFORCEGUARD_ROOT=/data
ENV PORT=8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:${PORT}/health')"

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT}"]
```

Key changes:
- Removed `COPY data/ /app/data/` — data is mounted at runtime
- Changed `WORKFORCEGUARD_ROOT` to `/data` (the mount point)
- Added `HEALTHCHECK`

- [ ] **Step 2: Rewrite `dashboard/backend/.dockerignore`**

```
.venv
__pycache__
*.pyc
*.pyo
tests/
.pytest_cache/
.DS_Store
```

- [ ] **Step 3: Build and test the image locally**

```bash
# From the project root
docker build -t workforceguard-api:latest -f dashboard/backend/Dockerfile .
```

Expected: `Successfully built ...` with no errors.

- [ ] **Step 4: Run the image locally with a data mount to verify it works**

```bash
docker run --rm \
  -p 8080:8080 \
  -e CORS_ALLOWED_ORIGINS="http://localhost:5173" \
  -v $(pwd)/data:/data \
  workforceguard-api:latest
```

In a second terminal:

```bash
curl http://localhost:8080/health
```

Expected:
```json
{"status":"ok","service":"WorkforceGuard Analytics API","generated_at":"..."}
```

Press Ctrl+C to stop the container.

- [ ] **Step 5: Commit**

```bash
git add dashboard/backend/Dockerfile dashboard/backend/.dockerignore
git commit -m "fix: mount data at runtime, remove baked-in data copy from image"
```

---

## Task 3: Create the Vercel Config for SPA Routing

**Files:**
- Create: `dashboard/frontend/vercel.json`

Without this, navigating directly to `/market` or `/govern` on Vercel returns a 404 because Vercel doesn't know these are client-side routes.

- [ ] **Step 1: Create `dashboard/frontend/vercel.json`**

```json
{
  "rewrites": [
    {
      "source": "/((?!api/.*).*)",
      "destination": "/index.html"
    }
  ]
}
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/frontend/vercel.json
git commit -m "feat: add vercel.json SPA routing rewrites"
```

---

## Task 4: Create the VM Bootstrap Script

**Files:**
- Create: `deploy/setup-vm.sh`

This script runs once on a fresh Ubuntu 22.04 VM to install everything needed.

- [ ] **Step 1: Create `deploy/` directory and `setup-vm.sh`**

```bash
mkdir -p deploy
```

Create `deploy/setup-vm.sh`:

```bash
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

echo ""
echo "=== Bootstrap complete ==="
echo "Log out and back in for docker group to take effect."
echo "Then run: deploy/install-service.sh"
```

```bash
chmod +x deploy/setup-vm.sh
```

- [ ] **Step 2: Commit**

```bash
git add deploy/setup-vm.sh
git commit -m "feat: add VM bootstrap script for Ubuntu 22.04"
```

---

## Task 5: Create the systemd Service File

**Files:**
- Create: `deploy/workforceguard-api.service`
- Create: `deploy/install-service.sh`

The systemd service ensures the Docker container auto-restarts if it crashes and starts automatically on VM reboot.

- [ ] **Step 1: Create `deploy/workforceguard-api.service`**

```ini
[Unit]
Description=WorkforceGuard FastAPI Backend
After=docker.service
Requires=docker.service

[Service]
Type=simple
User=%i
WorkingDirectory=/home/%i/WorkforceGuard-AI
EnvironmentFile=/home/%i/WorkforceGuard-AI/deploy/.env.production
ExecStartPre=-/usr/bin/docker stop workforceguard-api
ExecStartPre=-/usr/bin/docker rm workforceguard-api
ExecStart=/usr/bin/docker run \
  --name workforceguard-api \
  -p 8080:8080 \
  -e PORT=8080 \
  -e WORKFORCEGUARD_ROOT=/data \
  -e CORS_ALLOWED_ORIGINS=${CORS_ALLOWED_ORIGINS} \
  -v /home/%i/WorkforceGuard-AI/data:/data \
  workforceguard-api:latest
ExecStop=/usr/bin/docker stop workforceguard-api
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

- [ ] **Step 2: Create `deploy/install-service.sh`**

This script runs on the VM after bootstrap to install the systemd service.

```bash
#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
USERNAME="$(whoami)"

echo "=== Installing WorkforceGuard systemd service ==="

# Substitute the username into the service file
sudo sed "s/%i/$USERNAME/g" "$REPO_DIR/deploy/workforceguard-api.service" \
  > /tmp/workforceguard-api.service
sudo mv /tmp/workforceguard-api.service /etc/systemd/system/workforceguard-api.service

# Reload systemd and enable service
sudo systemctl daemon-reload
sudo systemctl enable workforceguard-api

echo "Service installed. Start with:"
echo "  sudo systemctl start workforceguard-api"
echo "Check status with:"
echo "  sudo systemctl status workforceguard-api"
```

```bash
chmod +x deploy/install-service.sh
```

- [ ] **Step 3: Create `deploy/.env.production.example`**

This is the template — the actual `.env.production` is created on the VM and never committed.

```bash
# Copy this to deploy/.env.production on the VM and fill in values
CORS_ALLOWED_ORIGINS=https://your-app.vercel.app
```

- [ ] **Step 4: Add `.env.production` to `.gitignore`**

```bash
echo "deploy/.env.production" >> .gitignore
```

- [ ] **Step 5: Commit**

```bash
git add deploy/workforceguard-api.service deploy/install-service.sh deploy/.env.production.example .gitignore
git commit -m "feat: add systemd service and install script for VM deployment"
```

---

## Task 6: Create the GCP VM

This task is run **on your local machine** using `gcloud` CLI.

- [ ] **Step 1: Authenticate with GCP**

```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
```

Replace `YOUR_PROJECT_ID` with your actual GCP project ID (visible at console.cloud.google.com).

- [ ] **Step 2: Create the VM**

```bash
gcloud compute instances create workforceguard-api \
  --zone=europe-west3-c \
  --machine-type=e2-micro \
  --boot-disk-type=pd-ssd \
  --boot-disk-size=20GB \
  --image-project=ubuntu-os-cloud \
  --image-family=ubuntu-2204-lts \
  --tags=http-server \
  --project=YOUR_PROJECT_ID
```

Expected output:
```
NAME                  ZONE            MACHINE_TYPE  PREEMPTIBLE  INTERNAL_IP  EXTERNAL_IP     STATUS
workforceguard-api    europe-west3-c  e2-micro                   10.156.0.x   XX.XX.XX.XX     RUNNING
```

Note the `EXTERNAL_IP` — you will need it in later tasks.

- [ ] **Step 3: Open port 8080**

```bash
gcloud compute firewall-rules create allow-workforceguard \
  --allow=tcp:8080 \
  --source-ranges=0.0.0.0/0 \
  --target-tags=http-server \
  --description="WorkforceGuard API port"
```

- [ ] **Step 4: Verify SSH works**

```bash
gcloud compute ssh workforceguard-api \
  --zone=europe-west3-c \
  --project=YOUR_PROJECT_ID
```

Expected: You are now inside the VM shell. Type `exit` to leave.

- [ ] **Step 5: Set a billing budget alert**

```bash
# First get your billing account ID
gcloud billing accounts list
```

Then in the GCP Console:
1. Go to Billing → Budgets & alerts
2. Click "Create budget"
3. Name: `WorkforceGuard Monthly`
4. Amount: `10 USD`
5. Alert thresholds: 50%, 90%, 100%
6. Click "Finish"

---

## Task 7: Bootstrap the VM

All commands in this task run **inside the VM** (after `gcloud compute ssh`).

- [ ] **Step 1: SSH into the VM**

```bash
gcloud compute ssh workforceguard-api \
  --zone=europe-west3-c \
  --project=YOUR_PROJECT_ID
```

- [ ] **Step 2: Clone the repository**

```bash
cd ~
git clone https://github.com/YOUR_GITHUB_USERNAME/WorkforceGuard-AI.git
cd WorkforceGuard-AI
```

Replace `YOUR_GITHUB_USERNAME` with your GitHub username or org.

- [ ] **Step 3: Run the bootstrap script**

```bash
bash deploy/setup-vm.sh
```

Expected final output:
```
=== Bootstrap complete ===
Log out and back in for docker group to take effect.
```

- [ ] **Step 4: Log out and back in (required for docker group)**

```bash
exit
```

Then SSH back in:

```bash
gcloud compute ssh workforceguard-api \
  --zone=europe-west3-c \
  --project=YOUR_PROJECT_ID
```

- [ ] **Step 5: Verify Docker works without sudo**

```bash
docker ps
```

Expected: `CONTAINER ID   IMAGE   COMMAND   CREATED   STATUS   PORTS   NAMES` (empty list, no error).

---

## Task 8: Build and Start the Backend on the VM

All commands run **inside the VM**.

- [ ] **Step 1: Build the Docker image**

```bash
cd ~/WorkforceGuard-AI
docker build -t workforceguard-api:latest -f dashboard/backend/Dockerfile .
```

Expected final line: `Successfully tagged workforceguard-api:latest`

This takes 2–4 minutes on first run (pip install).

- [ ] **Step 2: Create the production env file on the VM**

You need the Vercel URL for this. If you haven't deployed to Vercel yet, use a placeholder and update after Task 9.

```bash
cat > ~/WorkforceGuard-AI/deploy/.env.production << 'EOF'
CORS_ALLOWED_ORIGINS=https://PLACEHOLDER.vercel.app
EOF
```

- [ ] **Step 3: Install the systemd service**

```bash
cd ~/WorkforceGuard-AI
bash deploy/install-service.sh
```

Expected:
```
=== Installing WorkforceGuard systemd service ===
Service installed. Start with:
  sudo systemctl start workforceguard-api
```

- [ ] **Step 4: Start the service**

```bash
sudo systemctl start workforceguard-api
```

- [ ] **Step 5: Verify the service is running**

```bash
sudo systemctl status workforceguard-api
```

Expected: `Active: active (running)` with no errors.

- [ ] **Step 6: Test the health endpoint**

```bash
curl http://localhost:8080/health
```

Expected:
```json
{"status":"ok","service":"WorkforceGuard Analytics API","generated_at":"..."}
```

- [ ] **Step 7: Test from your local machine**

Replace `VM_EXTERNAL_IP` with the IP from Task 6 Step 2:

```bash
curl http://VM_EXTERNAL_IP:8080/health
```

Expected: same JSON response.

---

## Task 9: Deploy the Frontend to Vercel

All commands run **on your local machine** from the project root.

- [ ] **Step 1: Log in to Vercel CLI**

```bash
vercel login
```

Follow the browser prompt to authenticate.

- [ ] **Step 2: Link the frontend project**

```bash
cd dashboard/frontend
vercel link
```

When prompted:
- Set up and deploy: `Y`
- Which scope: select your account
- Link to existing project: `N`
- Project name: `workforceguard-ai` (or your preferred name)
- In which directory is your code located: `./` (current directory)

- [ ] **Step 3: Set the API URL environment variable**

Replace `VM_EXTERNAL_IP` with your VM's public IP from Task 6:

```bash
vercel env add VITE_API_BASE_URL production
```

When prompted for value, enter:
```
http://VM_EXTERNAL_IP:8080/api
```

- [ ] **Step 4: Deploy to production**

```bash
vercel deploy --prod
```

Expected final output:
```
✅  Production: https://workforceguard-ai-XXXX.vercel.app [3s]
```

Note the production URL — you need it for the next step.

- [ ] **Step 5: Update CORS on the VM with the real Vercel URL**

SSH back into the VM:

```bash
gcloud compute ssh workforceguard-api \
  --zone=europe-west3-c \
  --project=YOUR_PROJECT_ID
```

Update the env file:

```bash
cat > ~/WorkforceGuard-AI/deploy/.env.production << 'EOF'
CORS_ALLOWED_ORIGINS=https://YOUR_VERCEL_URL.vercel.app
EOF
```

Restart the service:

```bash
sudo systemctl restart workforceguard-api
```

Exit the VM:

```bash
exit
```

- [ ] **Step 6: Verify the full stack works**

Open the Vercel URL in your browser. The dashboard should load and display data.

If you see CORS errors in the browser console, double-check the `CORS_ALLOWED_ORIGINS` value on the VM matches the Vercel URL exactly (including `https://`).

---

## Task 10: Set Up GitHub Actions CI/CD

**Files:**
- Create: `.github/workflows/deploy.yml`

On every push to `main`, this workflow SSHes into the VM, pulls the latest code, rebuilds the Docker image, restarts the service, and redeploys the frontend to Vercel.

- [ ] **Step 1: Generate a dedicated SSH key for GitHub Actions (on your local machine)**

```bash
ssh-keygen -t ed25519 -C "github-actions-workforceguard" \
  -f ~/.ssh/github_actions_wfg \
  -N ""
```

This creates two files:
- `~/.ssh/github_actions_wfg` — private key (goes into GitHub Secrets)
- `~/.ssh/github_actions_wfg.pub` — public key (goes onto the VM)

- [ ] **Step 2: Add the public key to the VM**

```bash
gcloud compute ssh workforceguard-api \
  --zone=europe-west3-c \
  --project=YOUR_PROJECT_ID \
  --command="echo '$(cat ~/.ssh/github_actions_wfg.pub)' >> ~/.ssh/authorized_keys"
```

- [ ] **Step 3: Get the VM's external IP**

```bash
gcloud compute instances describe workforceguard-api \
  --zone=europe-west3-c \
  --format='get(networkInterfaces[0].accessConfigs[0].natIP)'
```

Note this IP.

- [ ] **Step 4: Get your Vercel token**

Go to vercel.com → Account Settings → Tokens → Create token named `github-actions`.
Copy the token value.

- [ ] **Step 5: Add GitHub Secrets**

Go to your GitHub repo → Settings → Secrets and variables → Actions → New repository secret.

Add these four secrets:

| Secret name | Value |
|-------------|-------|
| `GCP_VM_SSH_KEY` | Contents of `~/.ssh/github_actions_wfg` (the private key, including `-----BEGIN...` and `-----END...` lines) |
| `GCP_VM_IP` | The VM external IP from Step 3 |
| `GCP_VM_USER` | Your GCP username (run `whoami` inside the VM to confirm — usually your Google account prefix) |
| `VERCEL_TOKEN` | The token from Step 4 |

- [ ] **Step 6: Create `.github/workflows/deploy.yml`**

```bash
mkdir -p .github/workflows
```

```yaml
name: Deploy WorkforceGuard

on:
  push:
    branches: [main]

jobs:
  deploy-backend:
    name: Deploy backend to GCP VM
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Set up SSH agent
        uses: webfactory/ssh-agent@v0.9.0
        with:
          ssh-private-key: ${{ secrets.GCP_VM_SSH_KEY }}

      - name: Deploy to VM
        run: |
          ssh -o StrictHostKeyChecking=no \
            ${{ secrets.GCP_VM_USER }}@${{ secrets.GCP_VM_IP }} \
            'set -euo pipefail
             cd ~/WorkforceGuard-AI
             git pull origin main
             docker build -t workforceguard-api:latest -f dashboard/backend/Dockerfile .
             sudo systemctl restart workforceguard-api
             sleep 5
             curl -sf http://localhost:8080/health || (echo "Health check failed" && exit 1)
             echo "Backend deployed successfully"'

  deploy-frontend:
    name: Deploy frontend to Vercel
    runs-on: ubuntu-latest
    needs: deploy-backend

    steps:
      - uses: actions/checkout@v4

      - name: Set up Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: dashboard/frontend/package-lock.json

      - name: Install dependencies
        working-directory: dashboard/frontend
        run: npm ci

      - name: Deploy to Vercel
        working-directory: dashboard/frontend
        run: npx vercel deploy --prod --token=${{ secrets.VERCEL_TOKEN }}
        env:
          VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
          VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
```

- [ ] **Step 7: Get Vercel org and project IDs**

```bash
cd dashboard/frontend
cat .vercel/project.json
```

Expected output:
```json
{"orgId":"YOUR_ORG_ID","projectId":"YOUR_PROJECT_ID"}
```

Add two more GitHub Secrets:

| Secret name | Value |
|-------------|-------|
| `VERCEL_ORG_ID` | `orgId` from above |
| `VERCEL_PROJECT_ID` | `projectId` from above |

- [ ] **Step 8: Commit and push to trigger the workflow**

```bash
git add .github/workflows/deploy.yml
git commit -m "feat: add GitHub Actions CI/CD for GCP VM + Vercel deployment"
git push origin main
```

- [ ] **Step 9: Verify the workflow runs successfully**

Go to your GitHub repo → Actions tab. You should see the `Deploy WorkforceGuard` workflow running.

Expected: Both `deploy-backend` and `deploy-frontend` jobs show green checkmarks.

If `deploy-backend` fails at the SSH step, verify the `GCP_VM_USER` secret matches the username on the VM exactly.

---

## Task 11: Smoke Test the Full Production Stack

- [ ] **Step 1: Open the Vercel URL in a browser**

Navigate to `https://YOUR_APP.vercel.app`

Expected: The WorkforceGuard dashboard loads, showing the Home section with metric cards.

- [ ] **Step 2: Navigate all five sections**

Click through: Home → Market → Compare → Pay Analysis → Govern

Expected: All sections load without blank screens or console errors.

- [ ] **Step 3: Check the network tab**

Open browser DevTools → Network tab → filter by `/api/`.

Expected: All API calls return `200 OK` pointing to `http://VM_EXTERNAL_IP:8080/api/...`.

- [ ] **Step 4: Verify governance log works**

In the Govern section, trigger any action (e.g., approve a recommendation).

Then SSH into the VM and check:

```bash
gcloud compute ssh workforceguard-api \
  --zone=europe-west3-c \
  --project=YOUR_PROJECT_ID \
  --command="ls -la ~/WorkforceGuard-AI/data/governance_events.sqlite"
```

Expected: File exists and `modified` timestamp is recent.

- [ ] **Step 5: Verify data persists across container restart**

```bash
gcloud compute ssh workforceguard-api \
  --zone=europe-west3-c \
  --project=YOUR_PROJECT_ID \
  --command="sudo systemctl restart workforceguard-api && sleep 8 && curl -sf http://localhost:8080/health"
```

Expected: `{"status":"ok",...}` — data survived the restart because it's mounted from disk, not inside the container.

---

## Task 12: Optional — Upgrade to HTTPS with a Free Domain

This task is optional but recommended before showing the product to any customer. It requires a domain name (free options: `.vercel.app` is already HTTPS; for the backend API, use a free subdomain or Cloudflare tunnel).

**Option A — Keep HTTP for now (simplest)**

The Vercel frontend is already HTTPS. The backend API calls go to `http://VM_IP:8080`. This works but browsers may warn about mixed content. Acceptable for internal demos.

**Option B — Cloudflare Tunnel (free HTTPS for the backend, no domain needed)**

- [ ] **Step 1: Install cloudflared on the VM**

```bash
gcloud compute ssh workforceguard-api \
  --zone=europe-west3-c \
  --project=YOUR_PROJECT_ID
```

Inside the VM:

```bash
curl -L --output cloudflared.deb \
  https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared.deb
```

- [ ] **Step 2: Create a free tunnel**

```bash
cloudflared tunnel --url http://localhost:8080
```

Expected output includes a line like:
```
https://random-words-here.trycloudflare.com
```

This is your free HTTPS URL for the backend.

- [ ] **Step 3: Update Vercel env variable with the HTTPS URL**

```bash
cd dashboard/frontend
vercel env rm VITE_API_BASE_URL production
vercel env add VITE_API_BASE_URL production
# Enter: https://random-words-here.trycloudflare.com/api
vercel deploy --prod
```

Note: The free tunnel URL changes every time cloudflared restarts. For a stable URL, set up a named tunnel with a Cloudflare account (still free).

---

## Cost Verification

After Task 8, run this to confirm you're on track within budget:

```bash
gcloud billing accounts list
# Get BILLING_ACCOUNT_ID

gcloud billing budgets list \
  --billing-account=BILLING_ACCOUNT_ID
```

Expected monthly cost breakdown:
- e2-micro (europe-west3, 730 hours): ~$7.11
- 20GB pd-ssd (europe-west3): ~$2.00
- Network egress (minimal): ~$0.10
- **Total: ~$9.21/month** — within $10 credit

---

## Troubleshooting Reference

| Symptom | Check |
|---------|-------|
| `curl: (7) Failed to connect` from local machine | Firewall rule created in Task 6 Step 3? VM is running? |
| CORS error in browser console | `CORS_ALLOWED_ORIGINS` on VM matches Vercel URL exactly? Restart service after editing `.env.production` |
| Container exits immediately | `sudo journalctl -u workforceguard-api -n 50` — check for Python import errors |
| `FileNotFoundError` in backend logs | Data directory mount correct? Check `-v /home/USER/WorkforceGuard-AI/data:/data` in service file |
| GitHub Actions SSH fails | `GCP_VM_USER` secret — confirm by running `whoami` inside the VM |
| Vercel shows blank page | SPA routing — `vercel.json` committed and deployed? |
| Frontend shows API error | `VITE_API_BASE_URL` set in Vercel env? Redeploy after setting env vars |

---

## Logs and Monitoring

**Check backend logs on the VM:**
```bash
sudo journalctl -u workforceguard-api -f
```

**Check Docker container logs directly:**
```bash
docker logs -f workforceguard-api
```

**Check Vercel deployment logs:**
```bash
cd dashboard/frontend
vercel logs --prod
```
