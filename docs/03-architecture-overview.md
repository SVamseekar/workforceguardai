# WorkforceGuard AI — Architecture Overview

**Audience:** Engineers joining the team, on day one
**Read time:** ~20 minutes end-to-end
**Owner:** CTO
**Last reviewed:** 2026-04-27
**Related:** `docs/01-technical-design.md` (the *why*), `docs/02-launch-readiness.md` (the *what's shipping*)

---

## How to read this document

This is the doc that explains where things are and how the parts fit. It
does not justify the choices; that is in the Technical Design Document.
It does not list what is shipping; that is in the Launch Readiness
Document. If you want to know where the Eurostat ingestion lives, what
the API returns, or how a number gets from a public dataset to the
screen, this is the doc.

Read top to bottom on day one. Bookmark it. The file map at the end is
the index you will keep coming back to.

---

## 1. The thirty-second tour

WorkforceGuard AI is a Python + TypeScript application that helps an EU
employer compare itself to public EU labour-market data and produce a
signed report for compliance with the Pay Transparency Directive.

It runs as **one process per customer**, on **one Linux VM in an EU
region**, against **one DuckDB file on local disk**. There is no message
bus, no cache, no separate worker, no managed cloud database.

The data comes from Eurostat, ESCO, EURES, EIGE, EU-SILC, and Eurofound
EWCS. All of these are public, citable, free. The customer also uploads
their own payroll and job architecture, which never leaves the VM.

The product surface is four pages: **Overview** (comparative metrics),
**Compare** (side-by-side country/sector), **Evidence** (drawer + pack
export), **Governance** (event log).

That is the whole product.

---

## 2. The system, one diagram

```
                    External (EU public) ── nightly ─────► Raw zone (parquet/csv)
                                                                  │
   Customer (SFTP CSV) ─────────────────────────────────────────► │
                                                                  ▼
                                             ┌────────────────────────────────┐
                                             │  Warehouse: DuckDB             │
                                             │  dbt project (analytics/)      │
                                             │  staging → marts               │
                                             └────────────────┬───────────────┘
                                                              │ read-only
                                                              ▼
                                             ┌────────────────────────────────┐
                                             │  FastAPI (dashboard/backend/)  │
                                             │  api · domain · repository ·   │
                                             │  policy                        │
                                             │  + governance (SQLite, hash    │
                                             │    chain) + evidence (signed   │
                                             │    JSON + PDF)                 │
                                             └────────────────┬───────────────┘
                                                              │ HTTPS, OIDC
                                                              ▼
                                             ┌────────────────────────────────┐
                                             │  React SPA                     │
                                             │  (dashboard/frontend/)         │
                                             │  4 pages, TypeScript,          │
                                             │  TanStack Query                │
                                             └────────────────────────────────┘
```

Everything inside the VM is the dotted box from the warehouse downwards.
Everything above the warehouse is either public-internet (sources) or a
push from outside (customer CSVs).

---

## 3. Components

Each component has one job. Each is owned by one part of the codebase.
If a change touches two components, the change is allowed but the
contract between them must stay stable.

### 3.1 Ingestion scripts (`scripts/`)

Plain Python that pulls public data and validated customer data into
the raw zone. Runs under cron. No web server, no API.

- `pull_eu_data.py` — pulls Eurostat datasets named in
  `configs/eu_sources.yaml`. One file per (dataset, vintage) under
  `data/eu_raw/<code>/<pulled_at>.parquet`.
- `pull_esco_api_data.py` — pulls the ESCO occupation hierarchy and
  skills.
- `pull_eures_data.py` — EURES vacancy statistics (new in v1.0).
- `pull_eige_data.py` — EIGE Gender Equality Index (new in v1.0).
- `prepare_internal_company_data.py` — validates a customer CSV and
  writes a per-row error report.
- `prepare_reference_data.py` — small reference seeds (NACE, ISCO).
- `build_phase1_workspace.py` — orchestrates a clean rebuild end-to-end.

Each script is idempotent: rerunning it on the same input produces the
same output. Each writes a `_manifest.json` next to its output naming
the source URL, vintage, pulled_at, and licence.

### 3.2 Warehouse (`analytics/`)

A dbt project on top of DuckDB. The DuckDB file is on local disk; dbt
writes it; the API reads it.

- `analytics/seeds/` — small static reference tables (NACE, ISCO,
  countries).
- `analytics/models/staging/eurostat/` — one staging model per Eurostat
  dataset code. Reshapes JSON-stat into long format.
- `analytics/models/staging/internal/` — staging for customer payroll,
  job architecture, HRIS snapshot, ATS, learning.
- `analytics/models/staging/eures/`, `analytics/models/staging/eige/` —
  new in v1.0.
- `analytics/models/marts/core/` — `dim_geography`, `dim_sector`,
  `dim_date`, `dim_occupation`, `fct_labour_market_region_sector`,
  `mart_semantic_metrics`, `mart_workforce_command_center`.
- `analytics/models/marts/internal/` — internal facts and the
  `mart_internal_market_pay_benchmark` and
  `mart_company_decision_support` marts.
- `analytics/models/marts/reference/` — `dim_data_sources`,
  `dim_governance_actions`, `dim_metric_registry`.
- `analytics/tests/generic/` — `provenance_complete`,
  `trust_level_valid`.
- `analytics/tests/reconciliation/` — asserts our headline numbers
  match the publisher's.

The contract from the warehouse to the API is **`mart_semantic_metrics`
plus the dimension tables**. Anything the API needs is a row in a mart;
the API never queries staging.

### 3.3 Backend (`dashboard/backend/`)

A FastAPI application split into four layers. The split is the most
important architectural rule in the codebase: the boundary between
`domain/` and `repository/` is **strict** — no I/O in `domain/`, no
business logic in `repository/`.

- `main.py` — app entry, middleware, router wiring, request id.
- `settings.py` — env-driven config validated by `pydantic-settings`.
- `api/` — FastAPI routers. One file per resource. Routers do shape and
  validation; they call into `domain/`.
- `domain/` — pure functions. No `import duckdb`, no file reads. Returns
  typed objects.
- `repository/` — all warehouse and filesystem reads. One module per
  store.
- `policy/` — guardrails: `trust.py`, `freshness.py`. The only place in
  the codebase that decides "may we show this?".
- `contracts/` — JSON Schemas for every API response. Source of truth
  for frontend types.
- `templates/` — `evidence_pack.html`, fluent (`.ftl`) translation
  files for narratives.
- `tests/unit/`, `tests/contract/`, `tests/e2e/`.

### 3.4 Frontend (`dashboard/frontend/`)

A Vite-built React SPA in TypeScript.

- `src/app/` — router, providers, error boundary.
- `src/pages/` — Overview, Compare, Evidence, Governance.
- `src/components/primitives/` — design system: Button, Card, Tag,
  Tooltip, FreshnessPill, ProvenanceChip.
- `src/components/charts/` — `MetricChart` decides line vs bar from
  `dim_metric_registry` data.
- `src/components/filters/` — country, sector, period pickers.
- `src/components/evidence/` — drawer, provenance list, pack list.
- `src/hooks/` — `useFilters`, `useOverview`, `useEvidencePack`,
  `useGovernance`.
- `src/api/` — one typed fetcher per backend route. Wraps TanStack Query.
- `src/types/` — generated from `dashboard/backend/contracts/*.json`.
- `src/lib/` — formatters, period helpers, locale.

### 3.5 Governance (SQLite)

Sits next to the warehouse. One table, hash-chained.
`repository/governance.py` is the only writer. The verifier
(`policy/freshness.py` reuses the same module) reads the chain and
asserts integrity on every read and on a schedule.

### 3.6 Reverse proxy and process supervision

- **Caddy** handles TLS, HSTS, and the OIDC-aware reverse proxy in
  front of FastAPI.
- **systemd** runs the API and the cron jobs. systemd units live in
  `infra/systemd/` and are version-controlled.

### 3.7 Backups

`borgbackup` to a sibling EU bucket, daily. The borg config is in
`infra/backup/`.

---

## 4. Contracts between components

If two components need to talk, they talk through a contract. A
contract is a typed thing the team has agreed on; changing it requires
a code review on both sides.

### 4.1 Public sources → ingestion

The contract is the publisher's API. We pin a baseline of dimension
names per dataset in `configs/source_schemas/<code>.json`. Ingestion
fails if the baseline does not match. We do not depend on undocumented
endpoints.

### 4.2 Ingestion → warehouse

The contract is the **raw zone layout**:

```
data/<zone>/<code>/<pulled_at>.parquet
data/<zone>/<code>/_manifest.json
```

Where `<zone>` is one of `eu_raw`, `reference_raw`, `internal_raw`. The
manifest is required; if it is missing or malformed, dbt staging refuses
the file.

### 4.3 Warehouse → backend

The contract is **`mart_semantic_metrics` plus the dimension tables**,
plus the `dim_metric_registry` and `dim_data_sources` tables. The
backend reads these tables only; it never reads staging or raw. Schema
of the contract:

```
mart_semantic_metrics
  metric_id           text   fk dim_metric_registry
  geography_id        text   fk dim_geography
  sector_id           text   fk dim_sector
  period_id           text   fk dim_date
  value               numeric
  unit                text
  comparison_value    numeric  nullable
  comparison_geo_id   text     nullable
  source_publisher    text
  source_dataset_code text
  source_url          text
  source_vintage      text
  source_pulled_at    timestamp
  licence             text
  data_trust_level    text
```

A migration to this table is a versioned dbt change reviewed by the
backend lead.

### 4.4 Backend → frontend

The contract is `dashboard/backend/contracts/*.json` (JSON Schema). The
frontend's `src/types/api.ts` is generated from these files; a
mismatch fails CI.

### 4.5 Backend → customer's IdP

The contract is OIDC. We require:

- ID tokens signed with RS256 or ES256.
- `email`, `email_verified`, `aud`, `exp`, `iss` claims.
- Issuer URL configured per deployment.

### 4.6 Backend → governance store

`repository/governance.py` is the only module that knows the SQLite
schema. Everything else calls
`record_event(actor_email, action_code, target, reason, context)` and
gets back an event id.

### 4.7 Backend → evidence pack consumers

The signed JSON pack is itself a contract. The schema is at
`dashboard/backend/contracts/evidence_pack.v1.json`. Any change to it is
a major version (`evidence_pack.v2.json`); the API serves both for at
least one customer cycle to allow audit re-verification.

---

## 5. Where things live (file map)

The full map of the repo, with a one-line note on each top-level path.
If the path is not listed here, it does not exist or it is detritus
that should be removed.

```
/
├── README.md                      ─ project intro for first-time visitors
├── DATA_GENERATION.md             ─ legacy, being merged into 03/04 docs
├── DATA_INGESTION.md              ─ legacy, being merged into 03 doc
├── RESEARCH_LOG.md                ─ chronological research notes (not authoritative)
├── VARIABLES_MATRIX.md            ─ cross-walk between EU sources and our metric ids
├── eu_hr_analytics_sources.md     ─ master source catalogue (authoritative for sources)
├── requirements.txt               ─ backend + scripts dependencies
├── requirements-data.txt          ─ ingestion-only dependencies (for the data VM)
│
├── analytics/                     ─ dbt project: warehouse layer
│   ├── dbt_project.yml
│   ├── seeds/                     ─ NACE, ISCO, country reference codes
│   ├── models/
│   │   ├── staging/eurostat/      ─ one model per Eurostat dataset code
│   │   ├── staging/internal/      ─ payroll, job arch, HRIS, ATS, learning
│   │   ├── staging/eures/         ─ EURES vacancy statistics (v1.0)
│   │   ├── staging/eige/          ─ EIGE GEI (v1.0)
│   │   └── marts/{core,internal,reference}/
│   ├── tests/generic/             ─ provenance_complete, trust_level_valid
│   └── tests/reconciliation/      ─ headline-number assertions vs publishers
│
├── configs/                       ─ ingestion + source configuration
│   ├── eu_sources.yaml            ─ Eurostat dataset registry (16 datasets)
│   ├── eu_priors.yaml             ─ default filter priors (e.g. EU27_AVG)
│   ├── internal_sources.yaml      ─ customer-data schema definitions
│   ├── reference_sources.yaml     ─ ESCO, NACE, ISCO references
│   └── source_schemas/            ─ pinned dimension baselines per dataset
│
├── scripts/                       ─ ingestion and orchestration
│   ├── pull_eu_data.py
│   ├── pull_esco_api_data.py
│   ├── pull_eures_data.py         ─ v1.0
│   ├── pull_eige_data.py          ─ v1.0
│   ├── prepare_internal_company_data.py
│   ├── prepare_reference_data.py
│   └── build_phase1_workspace.py  ─ end-to-end clean rebuild
│
├── data/                          ─ raw + processed data, NOT in git
│   ├── eu_raw/                    ─ <code>/<pulled_at>.parquet + _manifest.json
│   ├── reference_raw/
│   ├── internal_raw/<customer_id>/<pulled_at>/
│   ├── warehouse.duckdb           ─ the DuckDB file the API reads
│   └── governance.sqlite          ─ the hash-chained event log
│
├── dashboard/
│   ├── backend/
│   │   ├── main.py                ─ FastAPI app entry
│   │   ├── settings.py            ─ env-driven config
│   │   ├── api/                   ─ FastAPI routers (one file per resource)
│   │   ├── domain/                ─ pure logic (no I/O, no DB import)
│   │   ├── repository/            ─ warehouse + filesystem reads
│   │   ├── policy/                ─ trust + freshness gates
│   │   ├── contracts/             ─ JSON Schemas (source of truth for FE types)
│   │   ├── templates/             ─ evidence pack HTML, narrative .ftl files
│   │   └── tests/{unit,contract,e2e}/
│   └── frontend/
│       └── src/
│           ├── app/               ─ router, providers, error boundary
│           ├── pages/             ─ Overview, Compare, Evidence, Governance
│           ├── components/        ─ primitives, charts, filters, evidence
│           ├── hooks/             ─ data hooks
│           ├── api/               ─ typed fetchers
│           ├── types/             ─ generated from backend contracts
│           └── lib/               ─ formatters, locale
│
├── infra/
│   ├── caddy/                     ─ Caddyfile, TLS config
│   ├── systemd/                   ─ service units for API and cron
│   ├── backup/                    ─ borgbackup config + scripts
│   └── ansible/                   ─ provisioning playbooks (one VM, one customer)
│
├── docs/
│   ├── 01-technical-design.md     ─ the why and the how (this product)
│   ├── 02-launch-readiness.md     ─ scope, rollout, risks, sign-off
│   ├── 03-architecture-overview.md─ this document
│   ├── 04-product-brief.md        ─ external brief for design partners / investors
│   ├── technical-assessment.md    ─ source of truth for the v1.0 plan
│   ├── runbooks/                  ─ on-call procedures
│   ├── reviews/                   ─ day-14, day-30, day-90 review notes
│   └── prd-*.md                   ─ legacy phase PRDs (kept for context)
│
├── tests/                         ─ cross-cutting integration tests
└── projects/                      ─ legacy / reference projects (not part of v1.0)
```

The legacy paths (`projects/`, `dashboard/frontend/src/components/Overview.jsx`
in its current 2,041-line form, the root-level `*.md` legacy docs) will
be archived or rewritten during weeks 1–4.

---

## 6. Local development setup

### 6.1 Prerequisites

- macOS or Linux. Windows works under WSL2; no native Windows support.
- Python 3.12.
- Node 20 LTS, pnpm.
- DuckDB CLI 0.10+ (optional but useful for inspecting the warehouse).
- A GitHub account with read access to this repo.

### 6.2 First-time setup (15 minutes)

From the repo root:

```bash
# 1. Python env for ingestion + backend
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
pip install -r requirements-data.txt

# 2. Pull a small fixture warehouse (no real customer data)
python scripts/build_phase1_workspace.py --fixture

# 3. dbt build against the fixture
cd analytics && dbt build --target dev && cd ..

# 4. Backend
cd dashboard/backend && pip install -e . && cd ../..

# 5. Frontend
cd dashboard/frontend && pnpm install && cd ../..
```

Two things to verify:

- `data/warehouse.duckdb` exists.
- `data/governance.sqlite` exists with the genesis event row.

### 6.3 Running locally

In three terminals:

```bash
# terminal 1 — backend
cd dashboard/backend && uvicorn main:app --reload --port 8001

# terminal 2 — frontend
cd dashboard/frontend && pnpm dev

# terminal 3 — ad-hoc
duckdb data/warehouse.duckdb
```

The frontend runs on `http://localhost:5173`. It proxies `/api/*` to
`http://localhost:8001`. OIDC is bypassed in dev (a fixture user is
injected); production never bypasses.

### 6.4 Running tests

```bash
# backend
cd dashboard/backend && pytest -q

# dbt
cd analytics && dbt build --target dev && dbt test --target dev

# frontend
cd dashboard/frontend && pnpm tsc --noEmit && pnpm test && pnpm build

# end-to-end smoke
cd dashboard/backend && pytest tests/e2e -q
```

The end-to-end smoke test loads the fixture warehouse, calls overview →
ask → evidence → governance, and asserts hash-chain integrity on the
resulting pack. If this is green, the system is functioning.

### 6.5 Working with real customer data locally

Don't, unless you must, and then only against a synthetic copy. Real
customer data lives only on the deployed VM. If you need to debug an
issue against a customer's data, use a one-off worktree on the VM,
never copy data to a laptop.

If you need a representative fixture, generate one with
`scripts/prepare_internal_company_data.py --fixture` which produces a
synthetic but structurally realistic payroll snapshot.

---

## 7. End-to-end walkthrough: a single user request

This is the path of one HTTP request from the browser to the warehouse
and back. If you want to understand how the system works, read this
section once carefully.

### 7.1 The request

User loads the Overview page. The browser issues:

```
GET /api/overview?country=DE&geography=DE&sector=K_FINANCE&period=2024
Authorization: Bearer <oidc_jwt>
X-Request-ID: req_01J...
```

### 7.2 In the browser

`src/pages/Overview/index.tsx` mounts. It reads the filter state from
the URL via `useFilters()`. It calls `useOverview(filters)`, which is a
TanStack Query hook in `src/hooks/useOverview.ts`. The hook calls the
typed fetcher in `src/api/overview.ts`. The fetcher emits the request
above and waits for a typed `OverviewResponse`.

### 7.3 In the reverse proxy

Caddy terminates TLS. It validates the OIDC JWT against the customer's
IdP issuer (cached JWKS). On valid token, it injects
`X-User-Email: anna.schmidt@design-partner.eu` and forwards to FastAPI
on `127.0.0.1:8001`.

### 7.4 In FastAPI middleware

`main.py` runs three middleware in order:

1. Request-ID middleware: take `X-Request-ID` or generate a new ULID.
2. Logging middleware: bind `request_id`, `user_email`, and `path` into
   `structlog`'s context.
3. CORS middleware: allowlist for the production frontend origin only.

### 7.5 In the router

`api/overview.py` defines `GET /api/overview`. It validates the query
params into a `FilterState` (a typed dataclass), then calls
`domain.metrics.build_overview(filters)`.

### 7.6 In the domain layer

`domain/metrics.py:build_overview` is a pure function. It calls four
sibling functions:

```python
metrics      = repository.warehouse.fetch_metrics(filters)
comparison   = repository.warehouse.fetch_comparison(filters)
narratives   = domain.narratives.render_overview(metrics, comparison)
freshness    = repository.warehouse.fetch_freshness()
```

Then it asks `policy.trust.gate(metrics)` and `policy.trust.gate(comparison)`
to suppress any rows whose `data_trust_level` is below
`customer_reconciled`. The gate returns a redacted view, not an
exception.

It composes an `OverviewView` typed object and returns.

### 7.7 In the repository layer

`repository/warehouse.py:fetch_metrics` opens a read-only DuckDB
connection (cached at process start) and runs:

```sql
SELECT metric_id, value, unit, comparison_value,
       source_publisher, source_dataset_code, source_url,
       source_vintage, source_pulled_at, licence,
       data_trust_level
FROM mart_semantic_metrics
WHERE geography_id = ? AND sector_id = ? AND period_id = ?
```

DuckDB returns rows from local disk in under 50 ms. The repository wraps
the rows in typed objects and returns.

### 7.8 Back up the stack

`api/overview.py` shapes the `OverviewView` into the response JSON
matching `contracts/overview.v1.json`. FastAPI serialises and adds
headers including `X-Data-Vintage`. Caddy adds HSTS and TLS. The
browser receives 200 OK.

### 7.9 Back in the browser

TanStack Query caches the response keyed on the filter state.
`Overview/index.tsx` renders metric tiles via `<MetricChart>`, the
freshness pill, and provenance chips. A click on a chip opens the
evidence drawer.

The total wall-clock budget for this request is **800 ms p95**. Today's
profile from the fixture warehouse: ~200 ms.

---

## 8. Common engineering tasks

### 8.1 "Add a new Eurostat dataset"

1. Add an entry to `configs/eu_sources.yaml` with `name`, `code`,
   `filters`.
2. Add a baseline `configs/source_schemas/<code>.json`. Get it by
   running the pull once with `--snapshot-baseline`.
3. Create a staging model
   `analytics/models/staging/eurostat/stg_eurostat__<name>.sql`.
4. Add the metric to `dim_metric_registry` (in seed CSV) with
   `metric_id`, display name, unit, direction_good, watch_threshold.
5. Update `mart_semantic_metrics` to include the new metric.
6. Add a reconciliation test in `analytics/tests/reconciliation/` that
   asserts our headline equals the publisher's.
7. The API and frontend pick up the new metric automatically because
   they read `dim_metric_registry`. No code change in either.

### 8.2 "Add a new API endpoint"

1. Define the response schema in
   `dashboard/backend/contracts/<name>.v1.json`.
2. Write the domain function in `domain/`.
3. Write the repository read in `repository/` if it needs warehouse data.
4. Write the router in `api/<name>.py`.
5. Wire the router in `main.py`.
6. Add a contract test in `tests/contract/`.
7. Regenerate frontend types: `pnpm gen:types`.
8. Write a typed fetcher in `src/api/`.

### 8.3 "Change the evidence pack format"

The evidence pack schema is **versioned**. You add `evidence_pack.v2.json`,
ship the new version behind `?format=json&version=v2`, and keep `v1`
serving for at least one customer cycle. Never break existing packs.

### 8.4 "Reconcile a new customer's data"

Procedure documented in `docs/runbooks/customer-reconciliation.md`.
Summary:

1. SFTP drop arrives at `data/internal_raw/<customer_id>/<pulled_at>/`.
2. Run `python scripts/prepare_internal_company_data.py
   --customer <id> --pulled-at <ts>`. Inspect error report.
3. If error rate < 0.5%, run `dbt run --select +mart_company_decision_support`.
4. Inspect headcount + total comp totals against customer's stated
   numbers. Tolerance: 0.1%.
5. With the customer's data owner present, click
   "I confirm these totals" in the UI. This writes a
   `customer_reconciliation` event to the governance log and flips the
   trust level on the affected fact rows.

### 8.5 "Investigate a hash-chain break"

Procedure in `docs/runbooks/hash-chain-break.md`. Do not deploy a fix
until root cause is understood. The chain break is a hard signal that
something is wrong with the writer or with the disk; fixing the symptom
without the cause is how you compound the problem.

### 8.6 "Bump a Python or Node dependency"

Run `pip-audit` (Python) or `pnpm audit` (frontend). Address criticals
within 7 days, highs within 30. Pin versions in `requirements.txt` and
`pnpm-lock.yaml`. CI runs the audit on every push.

### 8.7 "Promote a code change to production"

The flow is:

1. Branch from `main`. Implement and test locally.
2. Open a PR. CI must be green: lint, dbt build, dbt test, backend
   pytest, frontend tsc + build + axe, dependency audit.
3. One reviewer approves.
4. Merge to `main`.
5. Tag a release (`git tag v1.x.y && git push --tags`).
6. SSH to the production VM, `git pull`, run the deploy script
   (`infra/ansible/deploy.yml`), verify `/health`.
7. If anything is wrong, `git checkout v1.x.y-1 && systemctl restart`.

There is no separate staging environment in v1.0. The fixture warehouse
+ end-to-end smoke test are the staging environment.

---

## 9. Things that look strange but aren't

### 9.1 Why is there no separate worker process?

Because there is no work that requires one. Ingestion runs under cron;
the API serves reads. There are no long-running jobs initiated by user
actions. If we add LLM calls in v1.1 that take more than a few seconds,
they will run in-process with a request timeout, not in a worker.

### 9.2 Why DuckDB and not Postgres?

Because DuckDB on local disk is faster, simpler, and produces
byte-identical files for evidence-pack determinism. Postgres becomes
correct at customer #3.

### 9.3 Why is there no Redis cache?

Because the working set is under 100 MB and DuckDB holds it in memory.
A Redis cache would add an operational dependency and a consistency
question for nothing.

### 9.4 Why is the governance log SQLite and not Postgres?

Because we want it next to the warehouse, hash-chained, and trivial to
back up. SQLite + WAL is the right tool.

### 9.5 Why is the narrative layer not using an LLM?

Because a compliance product fails closed on hallucinations. The LLM
ships in v1.1 with a verifier that asserts every emitted number appears
in the tool-call results, and a templated fallback when verification
fails.

### 9.6 Why are evidence packs both JSON and PDF?

Because compliance buyers staple PDFs to filings, and auditors verify
JSON. The two are derived from the same canonical claim set; the
content is identical.

### 9.7 Why does every metric carry six provenance fields?

Because the buyer's job is to defend a number to a regulator. A number
without provenance is not defensible.

---

## 10. Glossary

- **Claim** — a numeric statement we render to the user. A claim has a
  metric, a value, optional comparison, and provenance.
- **Comparator** — the geography or sector being compared against
  (e.g., EU-27 average for a country, peer country for a country, peer
  sector for a sector).
- **Contract** — a typed agreement between two components. Either a
  JSON Schema, a SQL table shape, or a Python typed-dataclass interface.
- **dbt** — the framework we use to build the warehouse. See
  [docs.getdbt.com](https://docs.getdbt.com).
- **dim_** — prefix for dimension tables in the warehouse.
- **DuckDB** — the embedded analytical database we use as the
  warehouse. Single file on local disk.
- **Evidence pack** — the signed JSON + PDF report a customer attaches
  to their compliance filing.
- **fct_** — prefix for fact tables.
- **Filter state** — the tuple of (country, geography, sector, period,
  benchmark_geography, benchmark_sector) selecting rows for the UI.
- **Governance event** — an action recorded in the hash-chained log:
  approve, override, reverse, export, customer_reconciliation.
- **mart_** — prefix for mart-layer tables (the contract surface to the
  API).
- **MetricView** — the typed object that carries a number from the
  domain layer to the narrative layer.
- **OIDC** — OpenID Connect, the authentication protocol we use.
- **Provenance** — the six required fields on every numeric row:
  publisher, dataset code, URL, vintage, pulled_at, licence.
- **Raw zone** — the on-disk layer where we land published data with
  manifests, before staging.
- **Staging** — the dbt layer that reshapes raw inputs into typed long
  tables.
- **stg_** — prefix for staging models.
- **Trust level** — the enum on internal fact rows (`sample`,
  `customer_unverified`, `customer_reconciled`) controlling whether a
  company-specific claim may be displayed.
- **Vintage** — the date the publisher published or last refreshed the
  data, distinct from `pulled_at` (when we fetched it).

---

## 11. Where to ask for help

- Architecture questions: this document, then the Technical Design Doc.
- Scope questions ("are we shipping X?"): the Launch Readiness Doc.
- Source questions: `eu_hr_analytics_sources.md`.
- Code-level questions: ask in the team channel; do not open a PR
  without context.
- On-call / incident questions: `docs/runbooks/`.

If a thing is not in any of those, write it down. The wiki is the next
person's lifeline; treat it that way.

---

*End of Architecture Overview.*
