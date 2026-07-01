# Contributing to WorkforceGuard AI

## Git workflow

1. **Branch from `main`** using a descriptive name: `feature/pay-gap-export`, `fix/auth-redirect`, `chore/ci-cache`.
2. **Keep commits focused** — one logical change per commit when practical.
3. **Open a pull request** into `main`. Direct pushes to `main` are blocked locally by pre-commit and on GitHub by branch protection.
4. **Wait for CI** — all checks must pass before merge. Deploy runs only after CI succeeds on `main`.

## First-time setup

```bash
# Clone and enter the repo
git clone https://github.com/SVamseekar/workforceguardai.git
cd workforceguardai

# Install Git LFS (required for data assets)
git lfs install

# Install pre-commit hooks (blocks secrets, large files, commits to main)
pip install pre-commit
pre-commit install

# Optional: run all hooks against the full tree
pre-commit run --all-files
```

## Before you commit

Pre-commit runs automatically and checks for:

- Trailing whitespace and mixed line endings
- Invalid YAML/JSON
- Private keys and leaked secrets (Gitleaks)
- Files larger than 5 MB
- Commits directly to `main`

Never commit:

- `.env` files or production credentials
- Tenant or internal payroll data under `data/internal/`, `data/tenants/`
- Raw video recordings under `docs/demos/video_recording/`

## Running checks locally

### Backend

```bash
cd dashboard/backend
python -m venv .venv && source .venv/bin/activate
pip install -r ../../requirements.txt -r ../../requirements-data.txt -r requirements.txt pytest httpx

export DATABASE_URL=postgresql://test:test@localhost:5432/workforceguard_test
export SESSION_SECRET=local-dev-secret-not-for-production

python -m pytest tests/ -q
```

### Frontend

```bash
cd dashboard/frontend
npm ci
npm run lint
npm run typecheck
npm test
```

### Data pipeline scripts

```bash
pip install -r requirements.txt -r requirements-data.txt pytest
python -m pytest tests/ -q
```

## Large files and Git LFS

Binary assets (Parquet, DuckDB, GIFs, MP4s, XLSX, PDFs) are tracked with **Git LFS**. If `git push` fails with an LFS error:

```bash
git lfs install
git lfs pull
```

## Project layout

| Path | Purpose |
|------|---------|
| `dashboard/frontend/` | React UI (Vite, TanStack Query, Tailwind) |
| `dashboard/backend/` | FastAPI API, auth, `AnalyticsRepository` |
| `analytics/` | dbt models (Eurostat → marts) |
| `scripts/` | Data ingestion and preparation |
| `data/` | Parquet/DuckDB assets (LFS); tenant data is gitignored |
| `deploy/` | GCP + Vercel deployment scripts |

## Implementation norms

- Match existing patterns in the file you edit; keep diffs focused.
- Add or update tests when behavior changes.
- Frontend API routes in `dashboard/frontend/api/` use Node globals (not browser).
- Auth tests require `DATABASE_URL`; others may skip if Postgres is unavailable.

## CI cost notes

CI jobs are **path-filtered**: docs-only PRs skip Python, frontend, and dbt work.
For smaller private repos, copy [.github/workflows/templates/ci-lite.yml](.github/workflows/templates/ci-lite.yml).

## Questions

Open a [GitHub issue](https://github.com/SVamseekar/workforceguardai/issues) for bugs or feature requests.
