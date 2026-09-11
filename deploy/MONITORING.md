# Uptime monitoring (issue #94)

UptimeRobot is the intended monitor. This repo does not hold account credentials; a maintainer
must provision the account. Until that is done, the public status URL below is a placeholder.

## Checks to create (free tier)

| Monitor | URL | Interval |
|---------|-----|----------|
| Frontend | `https://workforceguardai.souravamseekar.com/` | 5 min |
| API liveness | `https://api.workforceguardai.souravamseekar.com/health` | 5 min |
| API dependencies | `https://api.workforceguardai.souravamseekar.com/health/detailed` | 5 min |

`GET /health` is process-up only. `GET /health/detailed` opens DuckDB via `resolve_filters()` and
runs `SELECT 1` against Postgres when `DATABASE_URL` is set. It returns HTTP 503 when either check
fails (except `auth_db: not configured` in environments without Postgres).

## Alerting

Email the maintainer after **2 consecutive failed checks**. Do not treat this document as proof
that alerting is live.

## Public status page

Placeholder until the UptimeRobot page exists:

`https://stats.uptimerobot.com/` (replace with the workspace-specific public URL)

Footer link: `site.ts` `STATUS_PAGE_URL`.
