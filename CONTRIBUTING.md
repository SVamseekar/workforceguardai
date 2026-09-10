# Contributing to WorkforceGuard AI

Solo maintainer: self-review through a PR plus CI is enough. Do not add
fake multi-person approval requirements.

Secrets: [SECURITY.md](SECURITY.md). Changelog: [CHANGELOG.md](CHANGELOG.md).
License: MIT — [LICENSE](LICENSE).

## Git workflow

1. Update local `main` from `origin/main`. Do not develop features on `main`.
2. Branch: `feature/<name>`, `fix/<name>`, `refactor/<name>`, or `chore/<name>`.
   Short-lived. No GitFlow release/develop branches.
3. Atomic commits — one logical change. Review `git diff` before committing.
4. Conventional Commits:

   `feat:` `fix:` `refactor:` `perf:` `test:` `docs:` `build:` `ci:` `chore:`

   No messages like "update", "changes", "fix", "stuff", or "final".
   Authorship is the maintainer only. Never add `Co-authored-by`,
   `Co-committed-by`, or any agent/tool attribution (Cursor, Claude,
   Copilot, Codex, Grok, …). The commit-msg hook and CI reject them.
5. Open a focused PR into `main`. The **PR title** must be a Conventional
   Commit — squash-merge uses it as the commit subject. Describe what
   changed and why in the body.
6. Required CI must pass. Do not merge with failing required checks.
7. Delete the branch after merge unless there is a reason to keep it.

`main` is production-ready. Direct commits to `main` are blocked by
pre-commit (`no-commit-to-branch`) and by the GitHub ruleset.

History: never rewrite or force-push `main`. If a personal feature branch
must be rewritten, use `git push --force-with-lease`, never `--force`.
Do not run destructive Git commands without checking `git status` and the
current branch.

## Releases

Semantic Versioning: `vMAJOR.MINOR.PATCH`. Tags match
`VERSION` and `dashboard/frontend/package.json`.

- **PATCH** — backward-compatible fix
- **MINOR** — backward-compatible feature
- **MAJOR** — breaking change

The first production tag is `v0.1.0`. Do not invent earlier versions.

Flow: feature/fix branch → PR → `main` → annotated tag.

```bash
# on the release commit (VERSION + package.json + CHANGELOG)
git tag -a vX.Y.Z -m "Release vX.Y.Z"
git push origin vX.Y.Z
```

Pushing the tag runs `.github/workflows/release.yml` and creates the
GitHub Release. Do not move, delete, or retarget a published tag.
Rollback is a new version (e.g. `v1.4.0` → `v1.4.1`).

`CITATION.cff` version is the research paper edition, not the product
version.

## First-time setup

**Runtimes (CI):** Python 3.12, Node 22. Local: Python 3.11+ and Node 20+
are fine for development; match CI before a release.

```bash
git clone https://github.com/SVamseekar/workforceguardai.git
cd workforceguardai
git lfs install
pip install pre-commit
pre-commit install
```

`pre-commit install` sets up both the `pre-commit` and `commit-msg` hooks (Conventional Commits). GitHub Actions re-runs those file hooks on the PR diff, so skipping locally with `--no-verify` still fails CI.

Environment templates: [`.env.example`](.env.example).

## Before you commit

Pre-commit checks file hygiene (whitespace, YAML/JSON/TOML, merge
conflicts, case clashes, shebangs, Python syntax, debug leftovers),
private keys, Gitleaks, files larger than 5 MB, LF line endings, and
commits to `main`. The `commit-msg` hook requires a Conventional Commit
subject (`feat:`, `fix:`, `chore:`, …) and rejects co-author trailers.

Never commit:

- `.env` files, API keys, tokens, private keys, certificates
- Tenant or internal payroll under `data/internal/`, `data/tenants/`
- `docs/` (unpublished working notes)
- `node_modules/`, virtualenvs, `analytics/target/`, `dashboard/frontend/dist/`

Do not use `git commit --no-verify` unless the maintainer explicitly asks.

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
npm run build
```

### Data pipeline scripts

```bash
pip install -r requirements.txt -r requirements-data.txt pytest
python -m pytest tests/ -q
```

### Analytics (dbt)

CI compiles dbt on `analytics/**` changes. Run tests locally when you change models:

```bash
cd analytics && dbt test
```

## Demo tenants

Two synthetic demo scenarios exist for local development, sales walkthroughs,
and landing-page screenshot captures — both are fully synthetic, generated
data, never real customer data (see the `.gitignore`d `data/tenants/` note
below):

- `aerotech-fr` — a French aerospace company (`scripts/generate_demo_company.py`)
- `meridian-cz` — a Czech finance company (`scripts/generate_demo_company_cz.py`),
  and the only scenario that also produces an upload-ready sample CSV at
  `data/demo_samples/meridian_payroll_upload.csv` for exercising the
  `POST /api/upload/payroll` flow by hand

**Seed (or reset) a demo tenant:**

```bash
bash scripts/setup_demo_environment.sh <scenario> [tenant-id]
# e.g.
bash scripts/setup_demo_environment.sh aerotech-fr
bash scripts/setup_demo_environment.sh meridian-cz a0000000-0000-4000-8000-000000000002
```

This is **idempotent** — re-running it for the same `tenant-id` regenerates
the synthetic payroll/job-architecture data, overwrites the tenant's
`internal/` parquet files and manifest from scratch (no duplication or
accumulation across runs), rebuilds that tenant's `tenant_<id>` dbt schema,
and records a fresh `trust_promoted` governance event for each trusted
asset — so the Govern screen's event log grows with each reset the same
way it would for a real admin action, while the underlying data stays
consistent.

`tenant-id` defaults to `a0000000-0000-4000-8000-000000000001` if omitted.
There is no separate "reset" command — running the same seed command again
*is* the reset. To remove a demo tenant entirely instead of resetting it,
delete its directory: `rm -rf data/tenants/<tenant-id>`.

The script prints a health summary after seeding, including whether
company-aware benchmarking (Pay Analysis) is actually available for that
tenant — if it prints `Company-aware benchmarking available: False`, Pay
Analysis will show an empty state and something needs investigating before
using that tenant for a demo (see `AnalyticsRepository._build_internal_data_status`
for what it checks).

**Never commit** anything under `data/internal/` or `data/tenants/` — both
are `.gitignore`d specifically so real customer data can never land in this
repo by accident, even from a demo-seeding session run against a locally
migrated production-shaped dataset.

## Large files and Git LFS

Binary assets (Parquet, XLSX, and similar) use **Git LFS**. If `git push`
fails with an LFS error:

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
| `assets/demos/` | Product walkthrough GIFs |

Match existing patterns. Add or update tests when behavior changes.
Frontend API routes in `dashboard/frontend/api/` use Node globals.
Auth tests require `DATABASE_URL`; others may skip if Postgres is unavailable.

## CI

PRs and pushes to `main` run pre-commit on the changed files (same hooks
as locally), secret scan, plus path-filtered Python, frontend (including
production build), and dbt compile. PR titles are checked as Conventional
Commits. Commit messages and the PR body must not contain co-author
trailers. Jobs fail on errors.

Deploy (GCP + Vercel) runs only after CI succeeds on `main`.

Docs-only PRs skip Python/frontend/dbt work. For smaller private copies of
this stack, see [`.github/workflows/templates/ci-lite.yml`](.github/workflows/templates/ci-lite.yml).

Lockfiles: commit `dashboard/frontend/package-lock.json`. Install with `npm ci`
in CI. Python uses `requirements*.txt` constraints (no pip-tools lockfile).

## Questions

Open a [GitHub issue](https://github.com/SVamseekar/workforceguardai/issues).
