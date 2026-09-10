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
5. Open a focused PR into `main`. Describe what changed and why.
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

Environment templates: [`.env.example`](.env.example).

## Before you commit

Pre-commit checks trailing whitespace, YAML/JSON, private keys, Gitleaks,
files larger than 5 MB, and commits to `main`.

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

PRs and pushes to `main` run secret scan plus path-filtered Python, frontend
(including production build), and dbt compile. Jobs fail on errors.

Deploy (GCP + Vercel) runs only after CI succeeds on `main`.

Docs-only PRs skip Python/frontend/dbt work. For smaller private copies of
this stack, see [`.github/workflows/templates/ci-lite.yml`](.github/workflows/templates/ci-lite.yml).

Lockfiles: commit `dashboard/frontend/package-lock.json`. Install with `npm ci`
in CI. Python uses `requirements*.txt` constraints (no pip-tools lockfile).

## Questions

Open a [GitHub issue](https://github.com/SVamseekar/workforceguardai/issues).
