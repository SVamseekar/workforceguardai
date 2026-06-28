# WorkforceGuard AI — instructions for Claude Code

## Project

EU workforce intelligence and pay-transparency compliance platform.
Stack: FastAPI + DuckDB/dbt backend, React/Vite frontend, Eurostat + internal payroll data.

## Git workflow (required)

- **Never commit or push to `main`.** Always create a branch first:
  `feature/…`, `fix/…`, `refactor/…`, or `chore/…`
- Finish via **pull request**; CI must pass before merge.
- **Do not bypass** pre-commit (`--no-verify`) unless the user explicitly asks.
- One branch per task; keep commits focused.
- Full details: [CONTRIBUTING.md](CONTRIBUTING.md)

## Verify before claiming done

Run checks for the areas you changed:

```bash
# Frontend (dashboard/frontend)
npm run lint && npm run typecheck && npm test

# Backend (dashboard/backend) — needs Postgres for auth tests
export DATABASE_URL=postgresql://test:test@localhost:5432/workforceguard_test
export SESSION_SECRET=local-dev-secret-not-for-production
python -m pytest tests/ -q

# Data scripts (repo root tests/)
python -m pytest tests/ -q

# dbt models (not in CI yet — run when analytics/ changes)
cd analytics && dbt test
```

## Never commit

- `.env` files, API keys, credentials, `*.pem`
- `data/internal/`, `data/tenants/` (real company/tenant data)
- `docs/demos/video_recording/` (raw recordings)
- Files over 5 MB (pre-commit blocks these)

## Code layout

| Path | Purpose |
|------|---------|
| `dashboard/frontend/` | React UI (Vite, TanStack Query, Tailwind) |
| `dashboard/backend/` | FastAPI API, auth, `AnalyticsRepository` |
| `analytics/` | dbt models (Eurostat → marts) |
| `scripts/` | Data ingestion and preparation |
| `data/` | Parquet/DuckDB assets (LFS); `internal/` is gitignored |
| `deploy/` | GCP + Vercel deployment scripts |

## Implementation norms

- Match existing patterns in the file you edit; minimal focused diffs.
- Add or update tests when behavior changes.
- Frontend API routes in `dashboard/frontend/api/` use Node globals (not browser).
- Auth tests require `DATABASE_URL`; others may skip if Postgres is unavailable.

## CI / deploy

- PRs run: secret scan + path-filtered jobs (Python, frontend, dbt compile only when those paths change).
- Production deploy (GCP + Vercel) runs only after CI passes on `main`.
- Smaller private repos: see `.github/workflows/templates/ci-lite.yml`.

## Other tools

The user also uses **Cursor (Grok)** on this repo. If switching tools mid-branch,
commit or stash first, then `git pull` before continuing.
