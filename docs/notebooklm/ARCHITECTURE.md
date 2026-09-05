# Architecture

**Note on sources:** `WORKFORCEGUARD_AI_REFERENCE.md` in the repo root is a detailed but **stale** snapshot (dated 2026-05-07, pre-auth, pre-router, single 2,187-line `Overview.jsx`). Git history and the current file tree show substantial subsequent work (multi-tenant auth, OAuth, a routed multi-section frontend, a research dashboard, TypeScript migration). This document is grounded in the **current** repository state, cross-checked against that history — not the stale reference doc.

## High-level system design

```
Eurostat API ──► scripts/pull_eu_data.py ──► data/eu_raw/*.parquet ──┐
ESCO REST API ──► scripts/pull_esco_api_data.py ──► data/reference/*.parquet ─┤
EGAPRO (France) / UK GPG Service ──► ingest_egapro.py / ingest_uk_gpg.py ─────┤
                                                                               ▼
                                                              dbt (analytics/) — staging → marts
                                                                               │
                                              Internal payroll (CSV upload) ──┤ (tenant-scoped)
                                                                               ▼
                                                        DuckDB warehouse (workforceguard_analytics.duckdb)
                                                                               │ read-only
                                                                               ▼
                                              FastAPI backend (dashboard/backend/)
                                              — AnalyticsRepository, RepositoryRegistry (per-tenant)
                                              — Postgres-backed auth (OAuth, sessions, tenants, roles)
                                              — SQLite governance event store (SHA-256 hash chain)
                                                                               │ HTTPS
                                                                               ▼
                                              React + TypeScript SPA (dashboard/frontend/)
                                              — routed, section-based (Home/Market/Compare/PayAnalysis/
                                                Govern/Research), landing site, auth screens
```

## Major components

### 1. Data layer (`scripts/`, `configs/`, `analytics/`, `data/`)

- **Ingestion scripts** pull from Eurostat's JSON-stat API (16 configured datasets, `configs/eu_sources.yaml`), the ESCO REST API, and country-specific sources (EGAPRO France, UK Gender Pay Gap Service). Output is versioned Parquet under `data/eu_raw/`, `data/reference/`, `data/reference_raw/`.
- **`dbt` project** (`analytics/`) transforms raw Parquet into a layered warehouse: staging views (one Parquet source per model, no joins) → core marts (geography/sector dimensions, the unified labour-market fact table, the four composite semantic metrics) → internal marts (worker-category dimension, internal pay/workforce/hiring/skill facts, internal-vs-market benchmark, pay-transparency review classification) → reference marts (metric registry, data-source catalogue, governance-action registry, passed through from seed CSVs).
- **DuckDB** (`data/workforceguard_analytics.duckdb`) is the compiled warehouse — a single file, no database server, read-only from the API at query time. Tenant-specific internal data lives in per-tenant DuckDB **schemas** (`tenant_<sanitized-id>`) inside the same file, not separate files — see Design Decisions for why.
- **Synthetic/demo data generation** (`scripts/generate_demo_company.py`, `generate_demo_company_cz.py`, `generate_eu_calibrated_data.py`, `seed_demo_tenant.py`) produces realistic-but-fabricated company payroll/HRIS data (e.g., a fictional "AeroTech Europe SAS," ~350 employees) for demo tenants, driven by priors in `configs/eu_priors.yaml`.

### 2. Backend (`dashboard/backend/`)

- **FastAPI** application (`main.py`) — routes, request models, middleware (env-driven CORS allowlist, not wildcard), error mapping.
- **`AnalyticsRepository`** (`service.py`) — the single class that touches DuckDB and the filesystem. Resolves filters, computes/assembles all metric and comparison payloads, builds evidence bundles, and writes governance events. Two connection modes: "modeled" (reads the compiled DuckDB warehouse) and a raw-Parquet fallback if the warehouse or required tables are absent.
- **`RepositoryRegistry`** — caches one `AnalyticsRepository` instance per tenant, each pointed at a tenant-specific internal-data directory and DuckDB schema, while sharing the single underlying analytics DuckDB file (see `tests/test_repository_registry.py`).
- **Auth subsystem** (`dashboard/backend/auth/`) — Postgres-backed. Tables: `tenants`, `users`, `oauth_identities` (Google/Microsoft), `memberships` (role: `admin`/`member`), `sessions`. OAuth login/callback/logout/me routes; signed, expiring session tokens; FastAPI dependencies gate routes by session and role.
- **Governance event store** — currently a JSON/SQLite-backed append-only log with a genuine SHA-256 hash chain (`event_hash`/`previous_hash`, `GENESIS` anchor), verified on read via an internal integrity check.

### 3. Frontend (`dashboard/frontend/`)

- **React + TypeScript + Vite**, React Router–based, organized into routed **sections** (`HomeSection`, `MarketSection`, `PayAnalysisSection`, `GovernSection`, `CompareSection`, `ResearchSection`) rather than the single-file `Overview.jsx` described in the stale reference doc.
- **Auth UI**: `LoginScreen`, `AuthContext`/`useAuth` hook, session-gated app shell (`Sidebar`, `TopBar`, `CopilotPanel`).
- **Landing site**: a separate marketing surface (`components/landing/`) — hero, product tour, demo-request form, mission/privacy/terms/refunds pages, SEO components — served alongside the authenticated app.
- **Shared primitives**: `MetricCard`, `ToneChip`, `ProvenanceBadge`, `StatusBadge`, `FreshnessPill`, `EvidenceDrawer`, `ChartPanel`/`MetricChart`, `FilterBar`.
- **Research components** (`components/research/`): scatter/heatmap/trajectory/finance-bar charts — a dedicated `/app/research` surface presenting the paper's own findings (Combined Risk Quadrant, sector heterogeneity, panel trajectories) inside the product itself.
- **Testing**: Vitest + React Testing Library + MSW, including an explicit `copy-standards.test.tsx` guard that fails if backend/schema terminology (e.g., raw field names) leaks into user-facing copy, and an `axe` accessibility test.

### 4. Deployment (`deploy/`, root `Dockerfile`/`cloudbuild.yaml`)

- **Backend**: containerized (Dockerfile, `.dockerignore`), deployed to **GCP** — both a Cloud Run path (`cloudbuild.yaml`) and a persistent-VM systemd-service path (`deploy/workforceguard-api.service`, `setup-vm.sh`, `install-service.sh`, `ensure-postgres.sh`, `ensure-api-dns.sh`, `configure-api-nginx.sh`). TLS is terminated at the VM (nginx), not proxied in plaintext (an earlier state, per the security audit, proxied plaintext HTTP — since fixed per the `fix: terminate tls on the backend vm` commit).
- **Frontend**: deployed to **Vercel**, proxying `/api/*` to the backend.
- **Postgres**: provisioned on the GCP VM for the auth subsystem (`ensure-postgres.sh`), separate from the DuckDB analytics warehouse.
- **CI/CD**: GitHub Actions (`ci.yml`, `deploy.yml`) — path-filtered jobs (Python/frontend/dbt-compile only run when relevant paths change), secret scanning, and a deploy workflow that runs only after CI passes on `main`.

## Data / request flow

1. A dashboard request (e.g., viewing the Market section) hits `GET /api/overview` with filter query params (country, geography, sector, period, optional benchmark geography/sector).
2. The session/role FastAPI dependency resolves the caller's tenant from their session; the request is routed to that tenant's `AnalyticsRepository` via `RepositoryRegistry`.
3. `AnalyticsRepository.build_overview()` runs a fixed sequence: resolve filters → build the four observed metrics → build five comparative-intelligence benchmarks → build the four composite semantic metrics → build chart series → build narrative/tone/recommendations → build internal-data status → build the company-vs-market benchmark (gated by a trust manifest) → build the Phase-4 pay-transparency simulation (gated by mart availability).
4. Every metric and semantic score in the response carries a `provenance` object (source ID, source name, formula version, human-review flag) and a `coverage` object (status, summary) — this is structural in the response shape, not decorative UI copy.
5. Governance actions (approve/override/reverse/export) POST to `/api/governance-events`, which validates the action against a seed-CSV registry, computes the new hash-chain entry, and persists synchronously.
6. Evidence-pack export (`GET /api/evidence-pack`) reuses `build_overview` and reshapes a compliance-oriented subset for download.

## Technology choices and domain fit

| Choice | Domain rationale |
|---|---|
| DuckDB, single file, no server | Compliance data doesn't need a managed database cluster; a file-based warehouse is trivially portable, inspectable, and backup-able per tenant/deployment, matching a small-customer-count B2B compliance product. |
| dbt for all business-metric logic | Keeps the formulas that produce legally-relevant numbers in versioned, testable SQL rather than scattered in application code — directly serves the "metrics before LLMs" and "deterministic numeric layer" principles. |
| DuckDB schema-per-tenant rather than DB-per-tenant | Cheaper isolation than a DB-per-tenant model while still giving hard schema boundaries; chosen deliberately after an earlier cross-tenant data leak was found and fixed (see Design Decisions). |
| FastAPI + Postgres for auth, separate from the DuckDB analytics store | Auth/session state needs transactional guarantees and standard OAuth plumbing that Postgres is well suited for; keeping it separate from the analytics warehouse avoids coupling compliance-metric storage to session lifecycle. |
| React Router, TypeScript, section components | Directly replaces the single 2,187-line untyped `Overview.jsx` that the security/technical-debt review flagged as a structural risk (no tests, no boundaries) — this is now addressed. |
| SHA-256 hash-chained governance log | A compliance audit trail must be tamper-evident; a hash chain is the minimal mechanism that lets a regulator or internal auditor detect after-the-fact edits to the approve/override/reverse/export history. |

## Multi-tenancy, compliance, and audit constraints

- **Multi-tenant, not single-tenant.** This directly contradicts the stale master reference doc's claim of "single-tenant deployment... no multi-tenancy in the current build." Current auth schema has `tenants`, `memberships` (with roles), and per-tenant DuckDB schema isolation, with dedicated tests (`test_tenant_schema_isolation.py`) and at least one committed fix for a cross-tenant leak (`949ae89 fix: close residual cross-tenant leak via main-schema fallback`).
- **Trust gating.** Company-specific claims (internal pay-gap figures, benchmarks) are suppressed in API responses unless an internal-data manifest marks the payroll and job-architecture assets `trusted_for_company_claims: true` — this prevents partially-uploaded or unvalidated tenant data from silently appearing in a compliance evidence pack.
- **Governance action registry is data, not code.** The five permissible actions (`review_required`, `approved`, `overridden`, `reversed`, `exported`) and which ones require a reason are defined in a seed CSV, not hardcoded — auditability of *what actions are even possible* is itself versioned.
- **Provenance is structural.** Every rendered metric traces to a source ID, dataset version, and formula version in the response schema itself, not just in documentation.

## Deployment shape

- **Local development**: `dbt run`/`dbt test` against local Parquet → DuckDB, FastAPI via `uvicorn`/`python main.py` on `127.0.0.1:8001`, Vite dev server on `localhost:5173` with an API proxy.
- **Production**: GCP-hosted backend (VM with systemd + nginx TLS termination, or Cloud Run via `cloudbuild.yaml`) with a provisioned Postgres instance for auth; Vercel-hosted frontend; custom domain (`workforceguardai.souravamseekar.com`), with `/app` as the authenticated dashboard and `/app/research` as the public research-panel view. GCP backend is described in commit history as made "on-demand" (start/stop scripts) — consistent with a low-traffic demo/portfolio deployment rather than an always-on multi-customer SaaS at this stage.
- **CI gates production deploy**: deploy workflow runs only after CI (tests, lint, secret scan) passes on `main`.
