# OAuth production smoke test

Run after deploying API + frontend env changes (`OAUTH_REDIRECT_BASE_URL`, `OAUTH_AUTO_PROVISION`, cookie settings).

## Preconditions

1. `deploy/sync-production-env.sh` applied on the VM (`OAUTH_REDIRECT_BASE_URL` = frontend origin, `OAUTH_AUTO_PROVISION=0`).
2. Google Cloud + Azure app registrations include **exact** callback URLs:
   - `https://workforceguardai.souravamseekar.com/api/auth/callback/google`
   - `https://workforceguardai.souravamseekar.com/api/auth/callback/microsoft`
3. API restarted: `sudo systemctl restart workforceguard-api`
4. Vercel frontend redeployed with latest `vercel.json` (same-origin `/api` proxy).

## Smoke test (manual)

| Step | Action | Expected |
|------|--------|----------|
| 1 | Open `https://workforceguardai.souravamseekar.com/app` | Login screen loads |
| 2 | Click **Sign in with Google** (unprovisioned account) | Redirect to Google, then back with `auth_error=not_provisioned` when `OAUTH_AUTO_PROVISION=0` |
| 3 | Sign in with a **provisioned** admin account | Lands on `/app` dashboard |
| 4 | DevTools → Application → Cookies | `wfg_session` present on `workforceguardai.souravamseekar.com`, `HttpOnly`, `Secure`, `SameSite=Lax` |
| 5 | `GET https://workforceguardai.souravamseekar.com/api/auth/me` (while signed in) | `200` with `user_id`, `tenant_id`, `role` |
| 6 | Sign out → `POST /api/auth/logout` | Cookie cleared; `/api/auth/me` returns `401` |

## Local HTTP dev

```bash
# dashboard/backend/.env
OAUTH_REDIRECT_BASE_URL=http://localhost:5173
SESSION_COOKIE_SECURE=0   # optional explicit override
OAUTH_AUTO_PROVISION=1    # auto-create tenant for local captures
```

Vite proxies `/api` to the backend; OAuth state and session cookies must stay on `localhost:5173`.

## Automated checks (CI / laptop)

```bash
export SESSION_SECRET=local-dev-secret-not-for-production
export DATABASE_URL=postgresql://test:test@localhost:5432/workforceguard_test
export WORKFORCEGUARD_SKIP_MIGRATION_CHECK=1

cd dashboard/backend
python -m pytest tests/test_oauth.py tests/test_session_cookie.py tests/test_auth_oauth_routes.py -q
```

## Rollback

- Set `OAUTH_AUTO_PROVISION=1` only for emergency self-serve testing (not recommended in production).
- Revert redirect URIs in Google/Azure if callback domain was wrong.
- Clear stale cookies in browser before retesting.
