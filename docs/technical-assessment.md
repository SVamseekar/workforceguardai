# WorkforceGuard AI — Technical Assessment

**Status:** Pre‑GA · **Audience:** Engineering, Data, Product · **Owner:** CTO
**Last reviewed:** 2026‑04‑27 · **Doc type:** Production‑readiness review

---

## TL;DR

WorkforceGuard AI is a single‑tenant FastAPI + React application backed by a
DuckDB warehouse populated by a dbt project (28 models) and a small set of
Python ingestion scripts. The product is functionally end‑to‑end for
EU‑market intelligence (Phase 1) and comparative benchmarking (Phase 2), but it
is **not production‑ready** for a paying EU customer in its current form.

The four issues that block GA, in order of severity:

1. **Data integrity is unverified.** The Eurostat ingestion runs but lacks
   schema contracts, freshness SLAs, and reconciliation against published
   totals. Internal company data is six sample payroll rows. There is no
   provenance table that lets a customer trace a number on screen back to a
   specific Eurostat dataset code, vintage, and pull timestamp.
2. **`service.py` is a 4,180‑line monolith.** All business logic — repository
   I/O, metric computation, narrative generation, evidence packaging,
   governance event handling — lives in one module. This is the single largest
   risk to velocity for Phase 4.
3. **There is no AI layer.** The "analyst response" surface is templated
   string composition over deterministic SQL. This is fine, and arguably
   correct for a compliance product — but it should be named honestly and the
   future LLM surface should be designed before it is built, not after.
4. **The frontend is one 2,041‑line component.** `Overview.jsx` is the entire
   product UI. There is no routing, no design system, no state management
   boundary, and no test harness for UI behaviour.

The remediation plan in §10 is six weeks of focused work to reach a defensible
v1.0 for one design‑partner customer.

---

## 1. Scope of this review

This document covers:

- Architecture and deployment topology
- Data sources, ingestion, lineage, and licensing
- Data model (warehouse + API contracts)
- Backend (FastAPI service, governance, evidence)
- Frontend (React SPA)
- "AI" surface (current templated layer + future LLM design)
- Security, compliance, and audit posture
- Testing, CI/CD, and operability

Out of scope: pricing, GTM, hiring plan.

Every claim about the codebase is grounded in a file and line range. Every
data source named is a public, citable, real‑world source — no synthetic
fixtures, no scraped feeds, no closed‑data assumptions.

---

## 2. Current architecture (as built)

```
                    ┌────────────────────────────────────────────────┐
                    │  Public sources (HTTPS, no auth, all official) │
                    │  Eurostat JSON-stat · ESCO API · EU-SILC       │
                    │  Eurofound EWCS · EIGE GEI · EURES             │
                    └────────────────────┬───────────────────────────┘
                                         │ scripts/pull_eu_data.py
                                         │ scripts/pull_esco_api_data.py
                                         ▼
                    ┌────────────────────────────────────────────────┐
                    │  data/eu_raw/  data/reference_raw/             │
                    │  (versioned Parquet/CSV on local disk)         │
                    └────────────────────┬───────────────────────────┘
                                         │ scripts/build_phase1_workspace.py
                                         ▼
                    ┌────────────────────────────────────────────────┐
                    │  DuckDB file: data/warehouse.duckdb (~9.7 MB)  │
                    │  dbt project: analytics/  (28 models)          │
                    │  staging/ → marts/{core,internal,reference}    │
                    └────────────────────┬───────────────────────────┘
                                         │ DuckDB read‑only handle
                                         ▼
                    ┌────────────────────────────────────────────────┐
                    │  FastAPI: dashboard/backend/                   │
                    │  main.py (184 LOC) · service.py (4,180 LOC)    │
                    │  9 endpoints · governance log → local JSON     │
                    └────────────────────┬───────────────────────────┘
                                         │ HTTP + JSON
                                         ▼
                    ┌────────────────────────────────────────────────┐
                    │  React SPA: dashboard/frontend/                │
                    │  Vite · 1 component (Overview.jsx, 2,041 LOC)  │
                    └────────────────────────────────────────────────┘
```

**What works:**
- The pipeline executes end‑to‑end. A `dbt build` followed by a backend boot
  produces a UI that renders real Eurostat data.
- The dbt layering is sensible: `staging/eurostat/*` → `marts/core/*` with
  a `mart_semantic_metrics` model that downstream code reads from.
- CORS, error mapping (`guarded()` in `main.py:45`), and a `/health` endpoint
  exist.

**What does not work for production:**
- No process supervisor, no container, no reverse proxy in front of FastAPI.
- No environment separation (dev / staging / prod is one box).
- DuckDB file is committed to disk with no replication or backup.
- Governance audit log is a local JSON file (`record_governance_event`).
- `allow_origins=["*"]` (`main.py:39`) — must be a per‑deployment allowlist.

---

## 3. Data sources — the genuineness contract

This product's defensibility is the data. We commit to **only public,
official, citable, freely‑licensed sources**. No scraping, no closed
republishing, no synthetic numbers leaking into customer‑facing claims.

### 3.1 Sources that are in scope (real, used, or to be wired)

| # | Source | Publisher | Update cadence | Licence | Status |
|---|---|---|---|---|---|
| 1 | Eurostat JSON‑stat API (`ec.europa.eu/eurostat/api/dissemination`) | EC | Quarterly / annual per dataset | CC‑BY 4.0 ([eurostat policy](https://ec.europa.eu/eurostat/about-us/policies/copyright)) | **Wired** — 16 datasets in `configs/eu_sources.yaml` |
| 2 | ESCO classification (occupations + skills) | EC / ELA | ~Annual | EUPL / CC‑BY | **Wired** — `scripts/pull_esco_api_data.py` |
| 3 | EU‑SILC indicators (housing overburden, income) | Eurostat | Annual | CC‑BY 4.0 | **Wired** — `TESSI162/164/166`, `ilc_di03`, `ilc_di12` |
| 4 | EURES job vacancy statistics | EURES / ELA | Quarterly | EU open data | **Not wired** — gap; required for Phase 3 demand signals |
| 5 | Eurofound EWCS 2024 (job quality, working conditions) | Eurofound | 5‑yearly + first‑findings updates | CC‑BY 4.0 | **Not wired** — PDF + microdata; needed for "job quality" claims |
| 6 | EIGE Gender Equality Index | EIGE | Annual | CC‑BY 4.0 | **Not wired** — gap for pay‑equity narrative |
| 7 | ILOSTAT (cross‑check vs Eurostat) | ILO | Continuous | CC‑BY 4.0 | **Not wired** — used only for reconciliation, not primary |
| 8 | NACE Rev. 2 + ISCO‑08 reference codes | EC / UNSD | Static, versioned | Public | **Wired** as seeds in `analytics/seeds/` (verify) |
| 9 | National statistics offices (INSEE, Destatis, ISTAT, INE) — used **only** for country‑level reconciliation, not as primary | NSIs | Varies | Mostly CC‑BY equivalents | **Optional**, Phase 3+ |

### 3.2 Sources that are **out of scope** (and why)

- **Consulting reports** (Deloitte HCT, McKinsey State of AI, BCG, Bain, EY,
  PwC, Mercer). Useful as marketing references; **never** as a number that
  drives a customer claim. They are point‑in‑time samples, often gated, and
  republishing their figures inside a paid product is a licensing problem.
  Citable in narrative ("per Eurofound EWCS 2024 …"), not as warehouse rows.
- **LinkedIn / job‑board scrapes.** Forbidden. ToS and GDPR exposure.
- **Glassdoor / Levels.fyi / payscale.** Forbidden as primary. Permitted only
  if the customer has a paid licence and wants their own subscription wired in.
- **Synthetic pay data.** Permitted only behind the `--trust-company-data`
  guardrail, never surfaced as a benchmark.

### 3.3 What's broken in the current ingestion

1. **No schema contract.** Eurostat occasionally changes dimension names
   (`unit`, `nace_r2` filter behaviour). The pull script applies filters "if
   the dimension exists" and silently skips otherwise — meaning a renamed
   dimension can produce a much larger or smaller dataset than expected and
   nothing fails. Fix: snapshot the dimension list per dataset on each pull
   and assert against a checked‑in baseline.
2. **No freshness SLA.** There is no `pulled_at` column propagated through
   staging into marts, and nothing in the API surfaces "as of" to the UI. Fix:
   add `source_pulled_at`, `source_dataset_code`, `source_vintage` to every
   staging model and carry it through to `mart_semantic_metrics`.
3. **No reconciliation.** We never assert that, e.g., our EU‑27 unemployment
   rate for 2024Q4 matches the headline figure on the Eurostat page. Fix: a
   `tests/reconciliation/` suite that downloads the headline value via the
   same API (no scraping) and asserts equality within tolerance.
4. **No source‑of‑truth registry surfaced to the UI.** `dim_data_sources`
   exists in `marts/reference/` — good — but the API does not expose it on
   evidence packs. Fix below in §6.
5. **Licensing metadata is not stored.** Each row should know its licence
   string so evidence‑pack exports can attribute correctly.

### 3.4 The non‑negotiable rule

**Every numeric claim rendered in the UI must be traceable to:**
`(source_publisher, source_dataset_code, source_url, source_vintage, source_pulled_at, licence)`.

If any of those six fields is null, the claim does not render. This is a
warehouse‑level constraint enforced as a `not_null` test on
`mart_semantic_metrics`, not a UI nicety.

---

## 4. Data model — what's wrong

The dbt layering is correct in shape but has gaps that will hurt as soon as a
second customer or a second analyst joins.

### 4.1 What exists

- `staging/eurostat/*` — 6 staging models (employment, unemployment, vacancy,
  pay gap, flows, slack). Each maps a JSON‑stat dump to long format.
- `staging/internal/*` — 5 staging models (HRIS snapshot, payroll, job
  architecture, ATS, learning). Today these read CSVs the customer hands over.
- `marts/core/*` — `dim_geography`, `dim_sector`,
  `fct_labour_market_region_sector`, `mart_semantic_metrics`,
  `mart_workforce_command_center`.
- `marts/internal/*` — internal dims/facts plus
  `mart_internal_market_pay_benchmark` and `mart_company_decision_support`.
- `marts/reference/*` — `dim_data_sources`, `dim_governance_actions`,
  `dim_metric_registry`.

### 4.2 What's missing or wrong

| Issue | Why it matters | Fix |
|---|---|---|
| No `dim_date` / period dimension | Period codes are strings sorted by a Python `period_sort_key` in `service.py:130`. Comparisons across quarterly + annual datasets break silently. | Add `dim_date` with `(period_code, period_start, period_end, grain)` and join everywhere. |
| No surrogate keys, only natural keys | Dimension changes (e.g., NACE Rev. 2 → Rev. 2.1) will rewrite history. | Use `dbt_utils.generate_surrogate_key` on dim tables; SCD‑2 on `dim_sector` and `dim_geography`. |
| No tests on uniqueness / not_null on marts | A duplicated period in staging silently doubles a metric. | Add `unique` + `not_null` schema tests on every mart's primary key. |
| Provenance columns missing | See §3.3.2. | Required. |
| `mart_semantic_metrics` is the only contract the API reads, but there is no metric registry tying metric_id → display name → unit → tone thresholds | Tone (`good`/`watch`) is currently hardcoded in `service.py`. | Move tone thresholds into `dim_metric_registry` rows; the API derives tone from data. |
| Internal vs external pay benchmarks share a numeric column with no flag for "trusted" | Customers will mix sample data with real data. | Add `data_trust_level ∈ {sample, customer_unverified, customer_reconciled}` and refuse to render the benchmark unless `≥ customer_reconciled`. |
| ESCO occupation hierarchy is loaded but not modelled as a recursive dim | Aggregations across 1‑/2‑/3‑digit ISCO will be inconsistent. | Build `dim_occupation` with parent_key + level. |

### 4.3 Warehouse choice

DuckDB is correct for a single‑tenant analyst product at this size. It stays
correct up to ~10 GB and one customer per file. The migration trigger to
Postgres is **multi‑tenant**, not size — see §10.

---

## 5. Backend — what's wrong

### 5.1 The `service.py` problem

`dashboard/backend/service.py` is 4,180 lines and exports one class
(`AnalyticsRepository`) plus a `FilterState` dataclass. Top‑level functions
visible from a quick scan: `clamp_score`, `parse_bool`, `escape_path`,
`period_sort_key`, `format_signed_delta` (`service.py:118‑144`). Everything
else is methods on the repository.

This is the single biggest engineering risk in the codebase. It conflates:

- **I/O** (DuckDB queries, file reads, evidence‑pack JSON building, governance
  JSON read/write).
- **Domain logic** (metric computation, comparative deltas, tone
  classification, narrative templating).
- **API shaping** (the exact JSON the React app consumes).
- **Authorization** (the `--trust-company-data` guardrail, applied inline).

Phase 4 (compliance workflows) cannot be added to this module without making
it worse. Refactor target:

```
dashboard/backend/
├── api/                # FastAPI routers, request/response models
│   ├── overview.py
│   ├── ask.py
│   ├── evidence.py
│   └── governance.py
├── domain/             # Pure functions, no I/O
│   ├── metrics.py
│   ├── comparisons.py
│   ├── narratives.py   # templated text generation today; LLM tomorrow
│   └── tone.py
├── repository/         # All DuckDB + filesystem reads
│   ├── warehouse.py
│   ├── evidence.py
│   └── governance.py
├── policy/             # Guardrails: trust levels, data freshness gates
│   └── trust.py
└── settings.py
```

**Acceptance criteria for the refactor:** no module exceeds 500 LOC; `domain/`
has zero `import duckdb`; `policy/trust.py` is the only place
`--trust-company-data` is read.

### 5.2 Specific backend defects

1. **Bare `except Exception` in `main.py:52`** maps everything to 500. Fine as
   a safety net, but the exception is logged as `str(error)` to the client —
   this leaks file paths. Mask in production, log full trace server‑side.
2. **`allow_origins=["*"]`** (`main.py:39`) — replace with an env‑driven
   allowlist. Required before any deployment.
3. **No request IDs / structured logs.** Add `structlog` with a per‑request
   correlation ID; log the filter state on every `/api/overview`.
4. **No rate limiting.** A single curl loop on `/api/ask` will spin up DuckDB
   reads in series. Add `slowapi` or front with nginx + `limit_req`.
5. **Governance log is a JSON file.** Race conditions on concurrent writes,
   no integrity, no actor identity. Move to a SQLite table inside the same
   DuckDB file (DuckDB supports attaching SQLite) or a sibling SQLite file
   with `journal_mode=WAL`. Schema:
   `(event_id UUID, occurred_at, actor_email, action_code, target_type,
   target_id, reason, context_json, prev_event_hash, event_hash)` — the hash
   chain gives tamper‑evidence without needing a real append‑only store yet.
6. **No auth.** No login, no API key, nothing. For a single design‑partner
   pilot this is acceptable behind a VPN or a simple reverse‑proxy basic auth;
   for anything else it is not. Decide explicitly per deployment.
7. **`/api/overview` recomputes everything on every request.** Add an
   in‑process LRU keyed on the filter tuple, with TTL = data freshness window.

---

## 6. Evidence packs — half‑built

`/api/evidence-pack` returns JSON. It is the most important compliance feature
in the product and is the weakest. Required changes:

1. **Embed full provenance per claim** (the six fields in §3.4).
2. **Sign the export.** Compute a SHA‑256 over the canonicalised JSON and
   include it in the response; persist the (claim_set_hash, generated_at,
   actor_email) into the governance log so a customer can later prove the pack
   they hold is the pack we issued.
3. **Render to PDF.** Compliance buyers staple PDFs to filings, not JSON.
   Use WeasyPrint or a server‑side React render; the PDF embeds the JSON +
   hash on the last page.
4. **Snapshot the warehouse vintage.** Record the dbt run id and source
   `pulled_at` per dataset that the pack depends on. Without this, "regenerate
   this pack 12 months later" is undefined.

---

## 7. The "AI" surface — what it actually is, and what it should be

### 7.1 Current state

There is no model. The "analyst response" is templated string composition
inside `service.py` — deterministic, fast, auditable. **This is a feature,
not a bug**, for a compliance product. Call it what it is in marketing copy:
"explainable analyst narratives", not "AI".

### 7.2 Where an LLM helps, and where it does not

**Helps (low risk, real value):**
- Rewriting a templated narrative into the customer's house tone of voice.
- Translating evidence‑pack narratives into FR/DE/ES/IT (the four EU
  languages a pay‑transparency filing typically needs).
- Suggesting follow‑up questions the analyst should ask, given the current
  filter state. (This is what `CONSOLE_FOLLOW_UPS` in `Overview.jsx:69` is
  approximating with a hardcoded list.)
- Drafting the "narrative summary" page of an evidence‑pack PDF.

**Does not help (high risk, do not do):**
- Generating numbers. Every number must come from the warehouse. The LLM is
  never on the path between data and a numeric claim.
- Free‑form Q&A over the warehouse without a tool layer. A buyer will ask
  "what was the gender pay gap in finance in Germany in Q3 2025" and the
  model will hallucinate. Either expose typed tools (filter setters, metric
  fetchers) and let the model orchestrate them, or do not ship Q&A at all.

### 7.3 Recommended design (when we build it)

- **Provider:** Anthropic Claude (Opus 4.7 for narrative generation, Haiku 4.5
  for cheap classification of follow‑ups). Use the Anthropic SDK with prompt
  caching on the system prompt and the metric registry (cache hit rate is the
  cost lever here).
- **Tool surface:** `get_metric(metric_id, filters)`, `compare(filters_a,
  filters_b)`, `list_available_metrics()`, `cite(source_id)`. The model emits
  a draft narrative; the deterministic layer **verifies every numeric token
  appears in the tool results** before the response is returned. Mismatches
  fail closed.
- **Guardrails:** model never sees customer payroll rows; only sees aggregates
  that have already cleared the trust gate.
- **Audit:** every model call logs `(prompt_hash, response_hash, tool_calls,
  cost_usd, latency_ms)` to the governance store.

### 7.4 What to do this quarter

Do not build the LLM layer yet. Build the tool surface (`domain/metrics.py`
exposing pure functions) first, because it is also what the React app and
the evidence pack should be calling. The LLM is a thin client of that
surface, added in 4–6 weeks once it is stable.

---

## 8. Frontend — what's wrong

### 8.1 The single‑component problem

`dashboard/frontend/src/components/Overview.jsx` is 2,041 lines and is the
entire product UI. `App.jsx` is 12 lines and renders it directly. There is:

- No router (single page only).
- No design system; styling is in `App.css` + inline.
- No state management beyond `useState` + `startTransition`.
- One `class Component` (`Overview.jsx:1`) and the rest function components,
  inconsistently.
- No tests for UI behaviour (the "frontend prod build passing" claim is a
  Vite build, not a behavioural test).

### 8.2 Refactor target

```
dashboard/frontend/src/
├── app/                  # Routing, providers, error boundary
├── pages/
│   ├── Overview/
│   ├── Compare/
│   ├── Evidence/
│   └── Governance/
├── components/
│   ├── primitives/       # Button, Card, Tag, Tooltip — design system
│   ├── charts/           # Recharts wrappers with consistent props
│   ├── filters/
│   └── evidence/
├── hooks/                # useFilters, useOverview, useEvidencePack
├── api/                  # Typed fetchers (one file per backend route)
└── lib/                  # formatters, period helpers
```

**Decisions to lock in:**
- **TypeScript.** The backend returns a complex shape (overview JSON has
  filters, metrics, charts, narratives, governance — each nested). Without
  types, every refactor breaks something silently.
- **TanStack Query** for the API layer (cache, retry, dedupe, stale‑while
  revalidate). Today every `useEffect` refetch is hand‑rolled.
- **A single chart wrapper** over Recharts that takes `(metric, series,
  comparison)` and decides line vs bar. Today chart configs are repeated.
- **Storybook** for the primitives. Compliance buyers buy with their eyes;
  the primitives must be tight before pages are.

### 8.3 Specific frontend defects

1. `axios` is fine but unconfigured — no base URL interceptor, no error
   normaliser, no request ID propagation.
2. `Intl.NumberFormat('en-US', …)` (`Overview.jsx:59`) — for an EU product,
   default to the user's locale; pin to `de-DE` in evidence packs because
   that is what most EU compliance filings expect.
3. `class Component` mixed with function components. Pick one (function +
   hooks).
4. No empty / loading / error states are documented; they exist inline. Move
   to a `<DataState>` wrapper.
5. No accessibility audit. Compliance customers run automated axe checks
   before procurement. Run axe in CI now, fix what fails.

---

## 9. Security, compliance, operability — what's missing

| Area | Current | Required for first paying customer |
|---|---|---|
| AuthN | None | OIDC via the customer's IdP (Azure AD / Okta) for the dashboard; API keys for ingestion |
| AuthZ | None | One role for v1 (`analyst`); evidence‑pack export and governance writes gated |
| Secrets | None used yet | `.env` + a secret manager when LLM keys land |
| Transport | HTTP | TLS terminated at a reverse proxy (Caddy or nginx); HSTS |
| GDPR — data residency | Local laptop | EU‑region hosted (Hetzner FSN, OVH GRA, Scaleway PAR, or AWS eu‑central‑1). No US transfer for customer data |
| GDPR — DPA | None | DPA template prepared, signed at contract |
| GDPR — DSR support | None | Documented procedure to export / delete a single customer's data |
| Backups | None | Nightly DuckDB snapshot + governance log snapshot to S3‑compatible EU bucket; 30‑day retention; quarterly restore drill |
| Logging | `print` / default uvicorn | Structured JSON logs, 30‑day retention, no PII in logs |
| Monitoring | None | Healthcheck pings + a single uptime monitor + an alert on dbt freshness |
| CI | "tests run locally" | GitHub Actions: lint + dbt build + backend pytest + frontend build + axe + a smoke test against a fixture warehouse |
| CD | None | Manual `git pull && systemctl restart` is acceptable for one customer; document it |
| Dependency hygiene | `requirements.txt` (56 bytes) is suspicious | Pin everything, run `pip-audit` and `npm audit` in CI |

---

## 10. Remediation plan (six weeks to defensible v1.0)

Not a wishlist — an ordered plan with explicit acceptance gates. Done means
all gates pass on `main`.

### Week 1 — Data integrity foundation
- Add provenance columns (`source_dataset_code`, `source_url`,
  `source_vintage`, `source_pulled_at`, `licence`) to every staging model;
  carry through to `mart_semantic_metrics`.
- Add `dim_date` and migrate period sorts off `service.py:130`.
- Add `data_trust_level` enum to internal facts.
- Add reconciliation tests for 3 headline Eurostat figures (EU‑27
  unemployment, gender pay gap total, employment rate 20‑64).
- **Gate:** `dbt build && dbt test` is green on a fresh pull, and at least
  one reconciliation test fails the build if Eurostat changes its number.

### Week 2 — Backend split
- Carve `service.py` into `api/`, `domain/`, `repository/`, `policy/` per
  §5.1.
- Move governance log to SQLite with the hash‑chained schema in §5.2.6.
- Replace `allow_origins=["*"]` with env‑driven allowlist.
- Add structured logging with request IDs.
- **Gate:** no module > 500 LOC; `pytest` is green; one e2e smoke test
  exercises overview → ask → evidence → governance.

### Week 3 — Evidence packs that hold up in an audit
- Embed full provenance per claim.
- Hash + sign the JSON; persist hash to governance.
- PDF rendering with WeasyPrint, including a "data vintage" page.
- **Gate:** a pack generated today regenerates byte‑identical tomorrow if no
  data changed; a pack from a stale warehouse refuses to issue.

### Week 4 — Frontend refactor (part 1)
- Convert to TypeScript.
- Split `Overview.jsx` into pages + primitives.
- Introduce TanStack Query.
- Add axe to CI; fix the top 10 violations.
- **Gate:** Storybook runs locally with primitives; `tsc --noEmit` is clean;
  Vite build size drops or stays flat.

### Week 5 — Frontend refactor (part 2) + ingestion gaps
- Wire EURES vacancy statistics + EIGE Gender Equality Index ingestions
  (sources #4 and #6 in §3.1).
- Build the `<DataState>` wrapper, evidence drawer page, governance page.
- Localise number/date formatting.
- **Gate:** the four pages in §8.2 render; EURES + EIGE data is visible in
  the UI with full provenance.

### Week 6 — Production posture
- TLS, OIDC login (one IdP), env separation (`dev`, `staging`, `prod`),
  EU‑region deploy, backups + restore drill, runbooks.
- GitHub Actions: lint, dbt build, dbt test, backend pytest, frontend build
  + axe, dependency audit.
- DPA template ready; data residency statement published.
- **Gate:** a customer can be onboarded in a single working day from a clean
  VM; restore drill from yesterday's snapshot succeeds.

---

## 11. What we are explicitly **not** doing in v1.0

- Multi‑tenant isolation. One deployment per customer. The migration trigger
  is customer #3, not customer #2.
- LLM features. Tool surface yes (it doubles as the API), model layer no.
- Phase 4 approval workflow. The spec for this comes from watching the
  design partner's first real Pay Transparency Directive filing in
  June 2026, not from imagination in April.
- Mobile app. Compliance buyers work in a browser on a laptop.
- Real‑time anything. Daily refresh is fine; quarterly is fine for most
  Eurostat datasets. Real‑time is a distraction.

---

## 12. Open questions for the team

1. **Hosting decision.** Hetzner / OVH / Scaleway / AWS eu‑central‑1?
   Decision blocks Week 6.
2. **PDF rendering.** WeasyPrint vs a headless‑Chromium service. WeasyPrint
   is simpler and ships in‑process; Chromium handles arbitrary CSS. Default
   recommendation: WeasyPrint.
3. **Auth IdP for the design partner.** Azure AD or Okta? Determines the
   OIDC integration in Week 6.
4. **Will the design partner share a real dbt seed of their job
   architecture under NDA before Week 1?** If yes, internal models become
   real in Week 3 instead of Week 8. If no, internal models stay behind the
   trust gate through v1.0.

---

## 13. Appendix — file map referenced in this document

- `configs/eu_sources.yaml` — Eurostat dataset registry (16 datasets).
- `scripts/pull_eu_data.py` — Eurostat ingestion.
- `scripts/pull_esco_api_data.py` — ESCO ingestion.
- `scripts/build_phase1_workspace.py` — orchestrates a clean rebuild.
- `analytics/models/staging/eurostat/*` — 6 staging models.
- `analytics/models/staging/internal/*` — 5 staging models.
- `analytics/models/marts/core/*` — 5 marts incl. `mart_semantic_metrics`.
- `analytics/models/marts/internal/*` — 7 marts.
- `analytics/models/marts/reference/*` — 3 dims incl. `dim_data_sources`.
- `dashboard/backend/main.py` (184 LOC) — FastAPI app + 9 routes.
- `dashboard/backend/service.py` (4,180 LOC) — `AnalyticsRepository`.
- `dashboard/frontend/src/App.jsx` (12 LOC) — shell.
- `dashboard/frontend/src/components/Overview.jsx` (2,041 LOC) — UI.
- `eu_hr_analytics_sources.md` — long‑form source catalogue (master list).

---

*This document is the source of truth for v1.0 scope. Changes to the plan
require updating this file, not a side‑channel.*
