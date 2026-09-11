# Uptime monitoring (issue #94)

This environment cannot create a third-party UptimeRobot account. Provisioning is a
two-minute task once a maintainer has signed up (free tier is enough).

## Click-by-click (no API key)

1. Open https://uptimerobot.com/signUp and create the account with
   `workforceguardai@souravamseekar.com` (or the maintainer inbox that should receive
   downtime mail).
2. Confirm the signup email.
3. **My Settings → Alert Contacts**: add that same email if it is not already the
   default. Leave SMS off on the free tier.
4. **Add New Monitor** (type HTTP(s), interval 5 minutes) for each row:

   | Friendly name | URL |
   |---------------|-----|
   | WorkforceGuard frontend | `https://workforceguardai.souravamseekar.com/` |
   | WorkforceGuard API liveness | `https://api.workforceguardai.souravamseekar.com/health` |
   | WorkforceGuard API dependencies | `https://api.workforceguardai.souravamseekar.com/health/detailed` |

5. On each monitor, set **Alert Contacts** to the maintainer email. Under
   **When to alert**, choose notification after **2 consecutive failed checks**
   (UptimeRobot labels this as the threshold / “alert after” control).
6. **Status Pages → Create Status Page**, name it `WorkforceGuard status`, attach
   all three monitors, set visibility to public.
7. Copy the public URL (typically `https://stats.uptimerobot.com/<id>`).
8. Replace `STATUS_PAGE_URL` in `dashboard/frontend/src/components/landing/site.ts`
   with that URL and deploy the frontend.

## Scripted path (API key)

After the account exists:

1. **My Settings → API** → create a **Main API Key** (read-write). Monitor-specific
   keys cannot create monitors.
2. From the repo root:

   ```bash
   export UPTIMEROBOT_API_KEY='uXXXX-...'
   export UPTIMEROBOT_ALERT_EMAIL='workforceguardai@souravamseekar.com'
   python scripts/provision_uptime_monitors.py
   ```

3. The script is idempotent on URL: it reuses existing monitors, creates the
   missing ones, ensures an email alert contact, and creates a public status page
   named `WorkforceGuard status` if none exists. It prints the public URL to paste
   into `STATUS_PAGE_URL`.

`GET /health` is process-up only. `GET /health/detailed` opens DuckDB via
`resolve_filters()` and runs `SELECT 1` against Postgres when `DATABASE_URL` is
set. It returns HTTP 503 when either check fails (except `auth_db: not configured`
in environments without Postgres).

Footer link: `site.ts` `STATUS_PAGE_URL` — still a placeholder until step 8.
