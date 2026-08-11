# Local OAuth setup (Mac frontend + Dell backend)

Free tier only. No paid Azure/Google plans required.

Flow:

```text
Browser (Mac) → http://localhost:5173/app
  → Vite proxies /api → http://192.168.50.88:8001
  → OAuth redirect base stays http://localhost:5173
  → Callbacks:
       /api/auth/callback/google
       /api/auth/callback/microsoft
```

Exact redirect URIs to register (must match character-for-character):

```text
http://localhost:5173/api/auth/callback/google
http://localhost:5173/api/auth/callback/microsoft
```

---

## Google (free)

A GCP project already exists for this lab: **`wfg-local-oauth-260811`**
(account: the `gcloud` user on this Mac).

### Console steps (one-time, free)

1. Open credentials for that project:
   [Google Cloud → Credentials (wfg-local-oauth-260811)](https://console.cloud.google.com/apis/credentials?project=wfg-local-oauth-260811)
2. If prompted, configure the **OAuth consent screen**:
   - User type: **External**
   - App name: `WorkforceGuard Local`
   - Support email: your Gmail
   - Developer contact: your Gmail
   - Scopes: defaults are fine (`openid`, `email`, `profile`)
   - Test users: add the Gmail account you will sign in with
     (External apps in “Testing” only allow listed users — free, no verification needed)
3. **Create credentials → OAuth client ID**
   - Application type: **Web application**
   - Name: `WorkforceGuard Local Web`
   - Authorized JavaScript origins: `http://localhost:5173`
   - Authorized redirect URIs:
     `http://localhost:5173/api/auth/callback/google`
4. Copy **Client ID** and **Client secret**.

No billing is required for OAuth client IDs and the testing consent screen.

---

## Microsoft (free)

Azure CLI is installed on this Mac (`brew install azure-cli`).
App registrations for personal Microsoft accounts are free (no paid subscription required when using `--allow-no-subscriptions`).

### One-time login + create app

```bash
export PATH="/opt/homebrew/bin:$PATH"

# Device code login (no paid subscription needed)
az login --use-device-code --allow-no-subscriptions

# Create web app registration with local callback
az ad app create \
  --display-name "WorkforceGuard Local" \
  --sign-in-audience "AzureADandPersonalMicrosoftAccount" \
  --web-redirect-uris "http://localhost:5173/api/auth/callback/microsoft" \
  --enable-id-token-issuance true \
  --enable-access-token-issuance true

# Note the appId from the JSON output, then create a client secret:
az ad app credential reset --id <APP_ID> --append --display-name "local-lab" --years 1
```

From the outputs:

| Azure field | Goes into Dell env as |
|-------------|------------------------|
| `appId` | `MICROSOFT_CLIENT_ID` |
| `password` (from credential reset) | `MICROSOFT_CLIENT_SECRET` |

Optional: in [Entra portal → App registrations](https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade) confirm the redirect URI is listed.

---

## Put secrets on the Dell API

Edit `C:\Users\Vamsee\Projects\WorkforceGuard-AI\.env.docker` on the Dell (never commit this file):

```env
SESSION_SECRET=<already set>
OAUTH_REDIRECT_BASE_URL=http://localhost:5173
FRONTEND_URL=http://localhost:5173/app
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
SESSION_COOKIE_SECURE=0
OAUTH_AUTO_PROVISION=1

GOOGLE_CLIENT_ID=<from Google Console>
GOOGLE_CLIENT_SECRET=<from Google Console>
MICROSOFT_CLIENT_ID=<Azure appId>
MICROSOFT_CLIENT_SECRET=<Azure password>
```

Restart API:

```powershell
cd C:\Users\Vamsee\Projects\WorkforceGuard-AI
docker compose up -d --force-recreate api
```

From Mac:

```bash
ssh dell 'cmd /c "set PATH=C:\Users\Vamsee\bin;%PATH% & cd /d C:\Users\Vamsee\Projects\WorkforceGuard-AI & docker compose up -d --force-recreate api"'
```

---

## Sign in

```bash
cd ~/Projects/WorkforceGuard-AI/dashboard/frontend
export VITE_API_PROXY_TARGET=http://192.168.50.88:8001
npm run dev
```

Open **http://localhost:5173/app** → **Continue with Google** or **Microsoft**.

With `OAUTH_AUTO_PROVISION=1`, the first successful login creates your user + tenant automatically.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `sign_in_unavailable` | Empty/wrong client IDs on Dell; recreate API container after editing `.env.docker` |
| `redirect_uri_mismatch` | Provider console URI must be exactly `http://localhost:5173/api/auth/callback/{provider}` |
| Google “Access blocked: app is in test mode” | Add your Gmail under OAuth consent **Test users** |
| Cookie not sticking | Use `http://localhost:5173` (not the Dell IP) in the browser; `SESSION_COOKIE_SECURE=0` |
| Microsoft personal account rejected | App `signInAudience` must allow personal accounts (`AzureADandPersonalMicrosoftAccount`) |

---

## Cost note

- Google: OAuth client + testing consent screen = **$0**
- Microsoft: Entra app registration + client secret = **$0** (no Azure paid plan required for this)
- You only pay if you later enable paid cloud products unrelated to OAuth
