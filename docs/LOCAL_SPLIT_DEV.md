# Local split dev: Mac frontend + Dell backend

All traffic stays on your LAN. No cloud deploy steps here.

| Machine  | Role                                           | Host                                                    |
| -------- | ---------------------------------------------- | ------------------------------------------------------- |
| **Mac**  | Frontend (Vite)                                | this machine                                            |
| **Dell** | Backend (`docker compose`: Postgres + FastAPI) | `192.168.50.88` · SSH user `Vamsee` · host alias `dell` |

| Service           | Port                      | Where                                      |
| ----------------- | ------------------------- | ------------------------------------------ |
| Vite dev          | `5173`                    | Mac                                        |
| FastAPI (compose) | `8001` → container `8080` | Dell (LAN)                                 |
| Postgres          | `5432`                    | Dell Docker (bound to Dell localhost only) |

---

## 1. SSH (from Mac)

`~/.ssh/config`:

```
Host dell
  HostName 192.168.50.88
  User Vamsee
  IdentityFile ~/.ssh/id_ed25519
```

```bash
ssh dell
ssh dell "cmd /c hostname"
scp ./file dell:C:/Users/Vamsee/file
```

---

## 2. One-time setup on Dell

Repo path:

```text
C:\Users\Vamsee\Projects\WorkforceGuard-AI
```

### 2.1 Clone (if missing)

```bash
ssh dell "cmd /c if not exist C:\\Users\\Vamsee\\Projects mkdir C:\\Users\\Vamsee\\Projects && cd /d C:\\Users\\Vamsee\\Projects && git clone https://github.com/SVamseekar/workforceguardai.git WorkforceGuard-AI"
```

### 2.2 Docker Desktop

Open **Docker Desktop** on the Dell and wait until it is running.

### 2.2b Docker pulls over SSH (Windows)

SSH sessions cannot use Docker Desktop’s Windows credential vault. If
`docker pull` fails with *“A specified logon session does not exist”*, install a
no-op helper once (already done if you followed the lab setup):

```powershell
# C:\Users\Vamsee\bin\docker-credential-nop.cmd  — returns "credentials not found"
# %USERPROFILE%\.docker\config.json:
#   { "auths": {}, "credsStore": "nop", "currentContext": "desktop-linux" }
# Ensure C:\Users\Vamsee\bin is on PATH (or prefix commands with set PATH=...)
```

Interactive Docker Desktop GUI login is unaffected for most day-to-day use; this
only fixes **non-interactive** `docker pull` / `compose` from SSH.

### 2.3 Env file for Compose

On Dell (PowerShell), from repo root:

```powershell
cd C:\Users\Vamsee\Projects\WorkforceGuard-AI
copy .env.docker.example .env.docker
# Set SESSION_SECRET to a long random string (32+ hex chars).
# On Mac: openssl rand -hex 32  → paste into .env.docker on Dell
notepad .env.docker
```

Do **not** commit `.env.docker`.

### 2.4 Local-only data (gitignored)

Git has public EU parquet. Copy from Mac if you need full local metrics:

```bash
REPO_DELL='C:/Users/Vamsee/Projects/WorkforceGuard-AI'
cd ~/Projects/WorkforceGuard-AI

scp data/workforceguard_analytics.duckdb "dell:${REPO_DELL}/data/"
scp -r data/internal "dell:${REPO_DELL}/data/"
scp -r data/tenants "dell:${REPO_DELL}/data/"
```

### 2.5 Windows firewall (if Mac cannot hit `:8001`)

Admin PowerShell on Dell:

```powershell
New-NetFirewallRule -DisplayName "WorkforceGuard API 8001" -Direction Inbound -Protocol TCP -LocalPort 8001 -Action Allow
```

---

## 3. Start backend on Dell (`docker compose up`)

From repo root on Dell:

```powershell
cd C:\Users\Vamsee\Projects\WorkforceGuard-AI
docker compose up --build -d
docker compose ps
docker compose logs -f api
```

From Mac:

```bash
# One-liner over SSH (Docker Desktop must already be running)
ssh dell 'cmd /c "set PATH=C:\Users\Vamsee\bin;%PATH% & cd /d C:\Users\Vamsee\Projects\WorkforceGuard-AI & docker compose up --build -d"'

curl -sS http://192.168.50.88:8001/health
# expect: {"status":"ok", ...}
```

Stop / restart:

```powershell
docker compose down
docker compose up -d
docker compose restart api
```

Rebuild after backend code changes:

```powershell
docker compose up --build -d
```

What Compose starts:

| Container      | Image / build                        | Role                          |
| -------------- | ------------------------------------ | ----------------------------- |
| `wfg-postgres` | `postgres:16`                        | Auth / sessions DB            |
| `wfg-api`      | build `dashboard/backend/Dockerfile` | FastAPI on host port **8001** |

Volumes: `./data` and `./analytics` mounted at `/app_root/...` (same layout as production).

---

## 3b. OAuth login (Google + Microsoft)

Full free setup: **[LOCAL_OAUTH_SETUP.md](./LOCAL_OAUTH_SETUP.md)**.

Redirect URIs (register on both providers):

```text
http://localhost:5173/api/auth/callback/google
http://localhost:5173/api/auth/callback/microsoft
```

Put client IDs/secrets in Dell `.env.docker`, then:

```powershell
docker compose up -d --force-recreate api
```

Open `http://localhost:5173/app` and use **Continue with Google** / **Microsoft**.
`OAUTH_AUTO_PROVISION=1` creates your tenant on first login.

## 4. Start frontend on Mac

```bash
cd ~/Projects/WorkforceGuard-AI/dashboard/frontend
export VITE_API_PROXY_TARGET=http://192.168.50.88:8001
npm install   # first time
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

Optional gitignored file `dashboard/frontend/.env.local`:

```env
VITE_API_PROXY_TARGET=http://192.168.50.88:8001
```

Browser stays on Mac localhost; Vite proxies `/api` and `/health` to the Dell.

---

## 5. Git: keep both machines updated

- **Never commit or push to `main`.** Use `feature/…`, `fix/…`, etc., and open a PR.
- Never commit `.env`, `.env.docker`, keys, `data/internal/`, `data/tenants/`.

### Pull latest on both

```bash
# Mac
cd ~/Projects/WorkforceGuard-AI
git checkout main
git pull origin main

# Dell
ssh dell "cmd /c cd /d C:\\Users\\Vamsee\\Projects\\WorkforceGuard-AI && git checkout main && git pull origin main"
```

After backend-related pulls on Dell, rebuild:

```bash
ssh dell "cmd /c cd /d C:\\Users\\Vamsee\\Projects\\WorkforceGuard-AI && docker compose up --build -d"
```

### After you change code on Mac

```bash
git checkout -b feature/my-change
# edit, test, commit
git push -u origin HEAD
# open PR, merge
```

Then on Dell:

```bash
ssh dell "cmd /c cd /d C:\\Users\\Vamsee\\Projects\\WorkforceGuard-AI && git checkout main && git pull origin main && docker compose up --build -d"
```

### Confirm SHAs match

```bash
git rev-parse --short HEAD
ssh dell "cmd /c cd /d C:\\Users\\Vamsee\\Projects\\WorkforceGuard-AI && git rev-parse --short HEAD"
```

---

## 6. Quick start cheat sheet

cd C:\Users\Vamsee\Projects\WorkforceGuard-AI
docker compose up --build -d    # start / rebuild
docker compose ps
docker compose logs -f api
docker compose down             # stop


```bash
# Mac: backend up?
curl -sS http://192.168.50.88:8001/health

# Mac: frontend
cd ~/Projects/WorkforceGuard-AI/dashboard/frontend
export VITE_API_PROXY_TARGET=http://192.168.50.88:8001
npm run dev
```

```powershell
# Dell: backend (Docker Desktop running)
cd C:\Users\Vamsee\Projects\WorkforceGuard-AI
docker compose up --build -d
```

```bash
# After git updates
git pull   # Mac
ssh dell "cmd /c cd /d C:\\Users\\Vamsee\\Projects\\WorkforceGuard-AI && git pull && docker compose up --build -d"
```

---

## 7. Troubleshooting

| Symptom                            | Check                                                           |
| ---------------------------------- | --------------------------------------------------------------- |
| `docker compose` fails             | Docker Desktop running on Dell                                  |
| SSH `logon session does not exist` | Install `docker-credential-nop` (section 2.2b); put it on PATH  |
| Missing env                        | `.env.docker` exists (copy from `.env.docker.example`)          |
| `SESSION_SECRET` error             | Set a non-placeholder value in `.env.docker`                    |
| Mac `curl :8001` hangs             | Firewall rule for 8001; `docker compose ps` shows `wfg-api` up  |
| Frontend proxy 502                 | `VITE_API_PROXY_TARGET=http://192.168.50.88:8001`, API healthy  |
| Empty metrics                      | Copy duckdb / tenants from Mac (section 2.4)                    |
| Legacy migration error             | Local `.env.docker` has `WORKFORCEGUARD_SKIP_MIGRATION_CHECK=1` |
| Postgres port conflict             | Only one stack using Dell `127.0.0.1:5432`                      |

Useful logs:

```powershell
docker compose logs -f api
docker compose logs -f postgres
```

---

## 8. What stays local-only

- LAN IP / SSH (`dell` → `192.168.50.88`)
- Compose Postgres password `wfg_local` (lab only)
- `.env.docker` secrets
- No Vercel/GCP steps in this doc
- Frontend origin remains `http://localhost:5173` on the Mac
