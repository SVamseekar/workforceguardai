# WorkforceGuard AI — Master Reference Document
## Part 1 of 4: Business Overview, Architecture & Data Strategy

---

## 1. BUSINESS OVERVIEW

### What is WorkforceGuard AI?

WorkforceGuard AI is a European workforce intelligence and compliance platform for HR, strategy, and compensation teams. It helps employers understand labour-market conditions across Europe, benchmark their internal workforce against public data, and prepare for regulatory obligations — in particular the EU Pay Transparency Directive (2023/970), which requires employers with 100+ workers to publish pay gaps by worker category and justify any unadjusted gap above 5%.

The product runs as a single-tenant deployment (one instance per customer) against a DuckDB file on a local or EU-hosted VM. There is no multi-tenancy in the current build.

### Primary Users

| Role                                     | Primary Use                                    |
| ---------------------------------------- | ---------------------------------------------- |
| HR Directors                             | Labour-market intelligence, workforce strategy |
| People Analytics teams                   | Comparative benchmarking, metric evidence      |
| Compensation and Benefits teams          | Pay-gap analysis, pay-transparency simulation  |
| Workforce Planning teams                 | Regional comparisons, transition readiness     |
| Compliance / Legal teams                 | Evidence packs, governance audit trail         |
| Works council / employee representatives | Review of pay-transparency findings            |

### Product Capabilities by Phase

| Phase   | Capability                                                                        | Status                    |
| ------- | --------------------------------------------------------------------------------- | ------------------------- |
| Phase 1 | EU market intelligence — Eurostat-backed labour metrics, evidence packs           | Complete                  |
| Phase 2 | Comparative intelligence — EU, peer-country, sector, prior-period benchmarks      | Complete                  |
| Phase 3 | Company-aware decision support — internal pay and workforce benchmarking          | Implemented (first slice) |
| Phase 4 | Compliance and governance suite — pay-transparency simulation, governance console | Started                   |
| Phase 5 | AI copilot and workflow automation                                                | Complete                  |

### Regulatory Context

The EU Pay Transparency Directive (2023/970):
- Transposition deadline: **7 June 2026**
- Employers with 100+ workers must publish pay gaps by worker category
- Unadjusted gaps ≥ 5% must be justified with objective, gender-neutral criteria
- First reports due in 2027 for 2026 data
- This creates a hard commercial deadline: customers must be collecting 2026 data live, not reconstructing it later

---

## 2. ARCHITECTURE OVERVIEW

### System Topology

```
External (EU public datasets) ── scripts/ ──► data/eu_raw/       (Parquet)
                                              data/reference_raw/ (Parquet)

Customer payroll/HRIS (CSV) ─────────────► data/internal/        (Parquet)

                     ┌──────────────────────────────────────┐
                     │  DuckDB warehouse                     │
                     │  data/workforceguard_analytics.duckdb │
                     │  dbt project (analytics/)             │
                     │  staging → marts (~31 models)         │
                     └──────────────────┬───────────────────┘
                                        │ read-only
                                        ▼
                     ┌──────────────────────────────────────┐
                     │  FastAPI (dashboard/backend/)         │
                     │  main.py  +  service.py              │
                     │  AnalyticsRepository (4,458 lines)   │
                     │  9 HTTP endpoints                     │
                     │  governance events (SQLite, SHA-256)  │
                     └──────────────────┬───────────────────┘
                                        │ HTTPS / /api
                                        ▼
                     ┌──────────────────────────────────────┐
                     │  React SPA (dashboard/frontend/)      │
                     │  Vite + React 19                      │
                     │  Overview.jsx (2,187 lines)           │
                     │  Single page, Recharts                │
                     └──────────────────────────────────────┘
```

One process per customer. No message bus. No cache layer. No managed cloud database. All customer data stays on the VM.

### Architecture Principles

1. **Compliance first** — Every recommendation must be traceable and reviewable.
2. **Metrics before LLMs** — Business logic lives in SQL models, not prompts.
3. **Metadata is a product feature** — Every number carries its source, formula version, and coverage state.
4. **Europe-first semantics** — Regions, occupations, sectors, and skills align with official European standards (NUTS, ESCO, NACE, Eurostat).
5. **Human oversight by design** — Recommendations can be reviewed, overridden, and reversed.
6. **Deterministic numeric layer** — Every number rendered to the user is computed in SQL and read directly by the API. No model inference on the path between data and a numeric claim.

### Technology Stack

| Layer            | Technology                                                  |
| ---------------- | ----------------------------------------------------------- |
| Ingestion        | Python 3.12, pandas, pyarrow, requests, pyyaml              |
| Warehouse        | DuckDB (single file, read-only access from API)             |
| Transformation   | dbt (~31 models — staging views, mart tables)               |
| API              | FastAPI + uvicorn, Python 3.12                              |
| Frontend         | React 19, Vite 7, Recharts 3, Axios, Lucide React, Tailwind |
| Data format      | Parquet (eu_raw, internal, reference)                       |
| Governance store | SQLite (`governance_events.sqlite`, SHA-256 hash chain)     |

### Runtime Ports

| Service              | Default                            | Override                                     |
| -------------------- | ---------------------------------- | -------------------------------------------- |
| FastAPI backend      | `http://127.0.0.1:8001`            | `WORKFORCEGUARD_HOST`, `WORKFORCEGUARD_PORT` |
| React frontend (dev) | `http://localhost:5173`            | Vite default                                 |
| Vite proxy to API    | `/api/*` → `http://127.0.0.1:8001` | `vite.config.js`                             |

---

## 3. DATA STRATEGY

### 3.1 External European Data Layer

All EU data is public, official, and free. The ingestion pipeline (`scripts/pull_eu_data.py`) pulls from the Eurostat JSON-stat API and writes versioned Parquet files to `data/eu_raw/`.

**16 configured datasets (`configs/eu_sources.yaml`):**

| Dataset Name                      | Eurostat Code     | Primary Signal                                 |
| --------------------------------- | ----------------- | ---------------------------------------------- |
| `job_vacancy_rate`                | `jvs_q_nace2`     | Quarterly vacancy rate by NACE sector          |
| `unemployment_rate`               | `une_rt_a`        | Annual unemployment rate                       |
| `long_term_unemployment`          | `une_ltu_a`       | Long-term unemployment share                   |
| `employment_rate`                 | `lfsi_emp_a`      | Employment rate, age 20–64                     |
| `labour_market_flows`             | `lfsi_long_q`     | Employment/unemployment/inactivity transitions |
| `labour_market_slack`             | `lfsi_sla_q`      | Labour market slack and underemployment        |
| `gender_pay_gap_sector`           | `earn_gr_gpgr2`   | Gender pay gap by NACE sector                  |
| `gender_pay_gap_age`              | `earn_gr_gpgr2ag` | Gender pay gap by age group                    |
| `at_risk_of_poverty_or_exclusion` | `ilc_peps01n`     | Poverty and social exclusion rate              |
| `median_equivalised_income`       | `ilc_di03`        | Median household income                        |
| `gini_coefficient`                | `ilc_di12`        | Income inequality (Gini)                       |
| `housing_overburden_total`        | `TESSI162`        | Housing cost overburden                        |
| `housing_overburden_by_tenure`    | `TESSI164`        | Housing burden by tenure type                  |
| `housing_overburden_by_income`    | `TESSI166`        | Housing burden by income quintile              |
| `gdp_per_capita`                  | `nama_10_pc`      | GDP per capita                                 |
| `commuting_time`                  | `lfso_19plwk28`   | Average commuting time                         |

**Geographic coverage:** All 27 EU member states (AT, BE, BG, HR, CY, CZ, DK, EE, FI, FR, DE, EL, HU, IE, IT, LV, LT, LU, MT, NL, PL, PT, RO, SK, SI, ES, SE) plus EU27 aggregate proxies.

**Time range configured:** 2019–2025 (annual and quarterly depending on dataset).

### 3.2 Reference Data Layer

ESCO (European Skills, Competences, Qualifications and Occupations taxonomy) provides the occupational and skills backbone.

**Files in `data/reference/`:**

| File                                      | Content                                                             |
| ----------------------------------------- | ------------------------------------------------------------------- |
| `esco_occupations.parquet`                | ESCO occupation hierarchy v1.2.1                                    |
| `esco_skills.parquet`                     | ESCO skills with `digital_skill_indicator`, `green_skill_indicator` |
| `esco_occupation_skill_relations.parquet` | Occupation → skill mappings                                         |
| `esco_nace_crosswalk.parquet`             | ESCO URI → NACE Rev.2 code bridge                                   |
| `manifest.json`                           | ESCO pull manifest (version, pulled_at)                             |

Script: `scripts/pull_esco_api_data.py` — pulls from the ESCO REST API.

### 3.3 Internal Company Data Layer

Internal data lives in `data/internal/`. It is never pushed to external systems. Company-specific claims in the API are disabled unless the internal data manifest marks the payroll and job-architecture assets as `trusted_for_company_claims: true`.

**Five internal data schemas:**

| File                               | Content                             | Required Fields                                                                                                |
| ---------------------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `payroll_snapshot.parquet`         | Employee pay facts                  | `employee_id`, `job_code`, `country_code`, `worker_category_id`, `gender`, `base_pay_amount`, `snapshot_date`  |
| `job_architecture.parquet`         | Role-to-category mapping            | `job_code`, `job_title`, `worker_category_id`, `job_family`, `job_level`, `nace_code`, `esco_uri`              |
| `hris_workforce_snapshot.parquet`  | Workforce headcount and composition | `employee_id`, `country_code`, `worker_category_id`, `gender`, `employment_type`, `hire_date`, `snapshot_date` |
| `ats_requisition_snapshot.parquet` | Open hiring demand                  | `requisition_id`, `job_code`, `country_code`, `worker_category_id`, `open_date`, `snapshot_date`               |
| `learning_skill_snapshot.parquet`  | Employee skills coverage            | `employee_id`, `skill_uri`, `proficiency_level`, `snapshot_date`                                               |

**Trust gate:** `data/internal_meta/manifest.json` — must have `trusted_for_company_claims: true` for payroll and job-architecture assets before company-specific claims are activated.

### 3.4 Data Sources Registry (Seed)

`analytics/seeds/reference/ref_data_sources.csv` — the canonical source catalogue loaded into `dim_data_sources` mart:

| source_id                         | source_family | Version     |
| --------------------------------- | ------------- | ----------- |
| eurostat_lfs                      | eurostat      | 2026-Q1     |
| eurostat_jvs                      | eurostat      | 2026-Q1     |
| esco_taxonomy                     | esco          | 1.2.1       |
| esco_nace_crosswalk               | esco          | 2026-rev2.1 |
| cedefop_skills                    | cedefop       | 2026        |
| eurofound_conditions              | eurofound     | 2026        |
| internal_payroll_snapshot         | internal      | local       |
| internal_job_architecture         | internal      | local       |
| internal_hris_workforce_snapshot  | internal      | local       |
| internal_ats_requisition_snapshot | internal      | local       |
| internal_learning_skill_snapshot  | internal      | local       |

---

## 4. CANONICAL BUSINESS ENTITIES

These are the core concepts modeled across the semantic and mart layers.

| Entity                 | Definition                                                 |
| ---------------------- | ---------------------------------------------------------- |
| `region`               | Europe, country, NUTS 2 as default (NUTS 3 when supported) |
| `sector`               | NACE-based economic activity code                          |
| `occupation`           | ESCO occupation URI                                        |
| `skill`                | ESCO skill or knowledge concept URI                        |
| `worker_category`      | Employer-defined category of workers / work of equal value |
| `time_period`          | Year (`YYYY`) or quarter (`YYYY-QN`) depending on source   |
| `metric_definition`    | Versioned, approved business formula for a signal          |
| `recommendation_event` | A generated recommendation and its evidence bundle         |
| `governance_event`     | Review, override, approval, reversal, or export action     |

---

## 5. METRIC REGISTRY

The metric registry (`analytics/seeds/reference/ref_metric_registry.csv`) is the single source of truth for all approved business metrics. The LLM / analyst layer must not invent formulas.

**Four registered metrics (all implemented in `mart_semantic_metrics`):**

| metric_id               | Group               | Formula Version | Human Review | Status     |
| ----------------------- | ------------------- | --------------- | ------------ | ---------- |
| `hiring_pressure_index` | market_intelligence | 1.2             | Yes          | proxy_live |
| `labour_resilience`     | market_intelligence | 1.1             | No           | live       |
| `equity_risk_score`     | compliance          | 1.0             | Yes          | proxy_live |
| `transition_readiness`  | skills_intelligence | 0.2             | Yes          | proxy_live |

**Formula logic (from `mart_semantic_metrics.sql`):**

```
hiring_pressure_raw =
  vacancy_rate * 11
  + max(0, 9 - unemployment_rate) * 4
  + max(0, 12 - labour_slack_rate) * 2.8   (if available)
  + flow_to_employment * 0.9
  + flow_to_inactivity * 0.6

labour_resilience_raw =
  employment_rate * 0.95
  - unemployment_rate * 3.8
  + employment_continuity * 0.3

equity_risk_raw =
  pay_gap * 5.5

transition_readiness =
  labour_resilience * 0.45
  + max(0, 100 - hiring_pressure_index) * 0.25
  + min(100, (digital_skill_coverage + green_skill_coverage) * 4) * 0.30
```

All four scores are clamped to [0, 100].

---

## 6. GOVERNANCE AND COMPLIANCE DESIGN

### 6.1 Governance Actions Registry

`analytics/seeds/governance/ref_governance_actions.csv` defines the five permissible governance actions:

| action_code       | action_name            | requires_reason |
| ----------------- | ---------------------- | --------------- |
| `review_required` | Human review required  | No              |
| `approved`        | Approved               | No              |
| `overridden`      | Overridden             | **Yes**         |
| `reversed`        | Reversed               | **Yes**         |
| `exported`        | Evidence pack exported | No              |

### 6.2 Governance Event Storage

Events are persisted to `data/governance_events.sqlite` (legacy JSON loader retained for migration). Current implementation:
- SHA-256 hash chain: each event stores `event_hash` and `previous_hash` (GENESIS anchor)
- Integrity verified on read via `_governance_integrity()` (`verified: false` on tampering)
- Persisted synchronously on every `POST /api/governance-events`
- Loaded on `AnalyticsRepository` initialisation

**Event schema:**
```json
{
  "event_id": "evt_0001",
  "action_code": "approved",
  "action_name": "Approved",
  "target_type": "semantic_metric",
  "target_id": "hiring_pressure_index::DE::A",
  "reason": null,
  "context": {},
  "created_at": "2026-05-07T10:30:00+00:00"
}
```

### 6.3 Pay Transparency Review States

The Phase 4 mart (`mart_pay_transparency_category_review`) classifies each worker-category pay gap into one of three states:

| review_state             | Trigger                                                | Priority       |
| ------------------------ | ------------------------------------------------------ | -------------- |
| `justified_difference`   | `abs(internal_gap) < 5%`                               | low            |
| `observed_gap`           | `5% ≤ abs(internal_gap) < 10%`                         | medium         |
| `unresolved_review_item` | `abs(internal_gap) ≥ 10%` OR `abs(gap_to_market) ≥ 2%` | high or medium |

Thresholds are stored in the mart (not in application code): `observed_gap_threshold_pct = 5.0`, `unresolved_review_threshold_pct = 10.0`, `market_delta_threshold_pct = 2.0`.

All rows carry `human_review_required = true` and `formula_version = 'pay-transparency-review-v1'`.

---

## 7. PHASED PRODUCT ROADMAP

### Phase 1 — External Data Foundation (Complete)
- Eurostat ingestion (6 datasets actively modeled)
- ESCO + NACE crosswalk reference load
- dbt staging and mart layers
- Command-centre dashboard with evidence packs
- Governance event logging

### Phase 2 — Comparative Intelligence (Complete)
- EU27, peer-country, sector, prior-period benchmarks
- Benchmark confidence and coverage state signals
- Benchmark-aware analyst console responses
- Country-level comparison across all 27 EU member states

### Phase 3 — Company-Aware Decision Support (Implemented — first slice)
- Internal payroll, HRIS, ATS, job architecture, and learning ingestion
- Worker category dimension (`dim_worker_category`)
- Internal vs market pay benchmark (`mart_internal_market_pay_benchmark`)
- Company-aware API responses behind trust gate
- Internal data status with manifest-driven trust logic

### Phase 4 — Compliance and Governance Suite (Started)
- Pay-transparency category-review simulation (`mart_pay_transparency_category_review`)
- API-level review classification (observed gap / monitored difference / unresolved review item)
- Governance console in dashboard with approve / override / reverse / export actions
- Evidence pack includes pay-transparency simulation results

### Phase 5 — AI Copilot and Workflow Automation (Complete)
- Grounded copilot contract using approved metric, semantic, comparison, compliance, and governance surfaces
- Evidence-backed executive brief payloads, recurring brief templates, and persistent schedule configuration
- Scheduled-run generation for executive briefs and compliance evidence packs
- Threshold alerts for semantic and compliance review signals
- Human-approved workflow handoffs with governance targets
- Enterprise command centre panel for briefs, alerts, and approvals

---

## 8. KNOWN GAPS AND PRODUCTION BLOCKERS

The following gaps were formally documented in `docs/technical-assessment.md` (last reviewed 2026-04-27):

| Gap                                             | Severity | Detail                                                                                                               |
| ----------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------- |
| No data provenance columns on staging models    | High     | Cannot trace a dashboard number back to a Eurostat dataset code and pull timestamp                                   |
| `service.py` is a 4,458-line monolith           | High     | All repository I/O, metric composition, narrative generation, evidence packaging, and governance in one module       |
| No AI layer                                     | Medium   | Analyst responses are templated string composition over SQL — acceptable for compliance but must be explicitly named |
| `Overview.jsx` is 2,187 lines, single component | High     | No router, no design system, no state management boundary, no UI tests                                               |
| No authentication                               | High     | CORS wildcard (`allow_origins=["*"]`), no OIDC, no role-based access                                                 |
| No CI/CD                                        | Medium   | Tests run locally; no GitHub Actions pipeline                                                                        |
| No backup strategy                              | Medium   | No scheduled DuckDB snapshots, no restore drill                                                                      |
| GDPR residency                                  | High     | No documented EU-region deployment or DPA template                                                                   |
| Internal data is 6 sample payroll rows          | Medium   | Phase 3 trust gate limits company-specific claims until real data connected                                          |

**Six-week remediation plan** (from `docs/01-technical-design.md`):
1. **Week 1** — Data integrity: provenance columns on all staging models, reconciliation tests
2. **Week 2** — Backend split: `api/`, `domain/`, `repository/`, `policy/`; SQLite governance; structured logging
3. **Week 3** — Evidence packs: hash-signed JSON + PDF rendering (WeasyPrint)
4. **Week 4** — Frontend part 1: TypeScript, component split, TanStack Query, axe CI
5. **Week 5** — Frontend part 2: EURES + EIGE ingestion, four-page structure
6. **Week 6** — Production posture: TLS, OIDC, EU-region deploy, backups, runbooks

---

*Continued in Part 2: Analytics Layer — dbt Models, Staging, Marts, Macros*


# WorkforceGuard AI — Master Reference Document
## Part 2 of 4: Analytics Layer — dbt Project, Staging Models, Mart Models, Macros

---

## 9. DBT PROJECT OVERVIEW

**Location:** `/analytics`
**Project name:** `workforceguard_analytics`
**Version:** 0.1.0
**Profile:** `workforceguard_analytics` (DuckDB via `profiles.yml`)
**Total models:** 28 (6 staging Eurostat, 5 staging internal, 5 core marts, 7 internal marts, 3 reference marts, 2 seeds groups)
**Materialization:** staging = `view`, marts = `table`

### Project Structure

```
analytics/
├── dbt_project.yml          # Project config, vars, materialization rules
├── profiles.yml             # DuckDB connection profile
├── macros/
│   ├── eu_paths.sql         # eu_parquet() — reads eu_raw Parquet
│   ├── internal_paths.sql   # internal_parquet() — reads internal Parquet
│   ├── reference_paths.sql  # reference_parquet() — reads reference Parquet
│   └── periods.sql          # Period helper macros
├── models/
│   ├── staging/
│   │   ├── eurostat/        # 6 staging views + _staging_models.yml
│   │   └── internal/        # 5 staging views + _internal_staging_models.yml
│   └── marts/
│       ├── core/            # 5 core mart tables + _core_models.yml
│       ├── internal/        # 7 internal mart tables + _internal_models.yml
│       └── reference/       # 3 reference mart tables
├── seeds/
│   ├── reference/
│   │   ├── ref_metric_registry.csv
│   │   └── ref_data_sources.csv
│   └── governance/
│       └── ref_governance_actions.csv
└── target/                  # Compiled SQL + run artifacts (not committed)
```

### dbt Variables

```yaml
vars:
  eu_raw_path:               "data/eu_raw"
  internal_path:             "data/internal"
  reference_path:            "data/reference"
  metric_registry_seed_version: "2026.03"
```

---

## 10. MACROS

All macros resolve to DuckDB `read_parquet()` calls against the relevant raw data directory.

### `eu_parquet(filename)` — `macros/eu_paths.sql`

```sql
{% macro eu_parquet(filename) -%}
read_parquet('{{ var("eu_raw_path") }}/{{ filename }}')
{%- endmacro %}
```

Used by all Eurostat staging models. Example: `{{ eu_parquet('employment_rate.parquet') }}`

### `internal_parquet(filename)` — `macros/internal_paths.sql`

```sql
{% macro internal_parquet(filename) -%}
read_parquet('{{ var("internal_path") }}/{{ filename }}')
{%- endmacro %}
```

Used by all internal staging models.

### `reference_parquet(filename)` — `macros/reference_paths.sql`

```sql
{% macro reference_parquet(filename) -%}
read_parquet('{{ var("reference_path") }}/{{ filename }}')
{%- endmacro %}
```

Used by core mart models that join ESCO and crosswalk reference data.

---

## 11. STAGING MODELS — EUROSTAT

**Location:** `models/staging/eurostat/`
**Materialization:** view
**Pattern:** All staging models select from the Parquet macro, standardise column names, cast types, and filter nulls. No joins in staging.

### `stg_eurostat__employment_rate`

**Source:** `eu_parquet('employment_rate.parquet')`
**Key columns:**

```
region_code, region_label, period_code (varchar), period_type ('year')
indicator_code, indicator_label, sex_code, age_code, unit_code
metric_value (double), dataset_name ('employment_rate')
```

**Filter:** `geo IS NOT NULL AND value IS NOT NULL`

### `stg_eurostat__unemployment_rate`

**Source:** `eu_parquet('unemployment_rate.parquet')`
**Same shape as employment rate.** `dataset_name = 'unemployment_rate'`

### `stg_eurostat__job_vacancy_rate`

**Source:** `eu_parquet('job_vacancy_rate.parquet')`
**Extra columns:** `nace_r2` (sector code), `nace_r2_label` — the only Eurostat staging model with sector grain.
**dataset_name:** `'job_vacancy_rate'`

### `stg_eurostat__gender_pay_gap_sector`

**Source:** `eu_parquet('gender_pay_gap_sector.parquet')`
**Extra columns:** `nace_r2`, `nace_r2_label`
**dataset_name:** `'gender_pay_gap_sector'`

### `stg_eurostat__labour_market_flows`

**Source:** `eu_parquet('labour_market_flows.parquet')`
**Extra columns:** `indic_em`, `indic_em_label` — distinguishes employment/unemployment/inactivity flow type.
**Optional fallback:** The service layer creates an empty schema-matched view if the Parquet file is absent, so downstream models do not fail.
**dataset_name:** `'labour_market_flows'`

### `stg_eurostat__labour_market_slack`

**Source:** `eu_parquet('labour_market_slack.parquet')`
**Extra columns:** `wstatus`, `wstatus_label` — work status categories (fully underemployed, marginally attached, etc.)
**Optional fallback:** Same empty-schema fallback as flows.
**dataset_name:** `'labour_market_slack'`

---

## 12. STAGING MODELS — INTERNAL

**Location:** `models/staging/internal/`
**Materialization:** view
**Pattern:** All internal staging models apply `upper()` to country codes, `lower()` to categoricals (gender, employment_type, employment_status), cast date columns, filter rows missing required business keys, and attach a `dataset_name` constant.

### `stg_internal__payroll_snapshot`

**Source:** `internal_parquet('payroll_snapshot.parquet')`
**Key transformations:**
- `upper(country_code)` — normalise to ISO 3166-1 alpha-2
- `lower(gender)` — normalise to `'female'` / `'male'`
- `upper(pay_currency)` — ISO 4217
- `cast(base_pay_amount as double)`
- `cast(snapshot_date as date)`

**Filter:** `employee_id IS NOT NULL AND job_code IS NOT NULL AND country_code IS NOT NULL AND worker_category_id IS NOT NULL AND base_pay_amount > 0`

### `stg_internal__job_architecture`

**Source:** `internal_parquet('job_architecture.parquet')`
**Key columns:** `job_code`, `job_title`, `worker_category_id`, `job_family`, `job_level`, `nace_code`, `esco_uri`
**Filter:** `job_code IS NOT NULL AND worker_category_id IS NOT NULL`

### `stg_internal__hris_workforce_snapshot`

**Source:** `internal_parquet('hris_workforce_snapshot.parquet')`
**Key transformations:**
- `upper(country_code)`, `lower(gender)`, `lower(employment_type)`, `lower(employment_status)`
- `cast(hire_date as date)`, `cast(termination_date as date)`, `cast(snapshot_date as date)`

**Filter:** `employee_id IS NOT NULL AND country_code IS NOT NULL AND worker_category_id IS NOT NULL AND snapshot_date IS NOT NULL`

### `stg_internal__ats_requisition_snapshot`

**Source:** `internal_parquet('ats_requisition_snapshot.parquet')`
**Key columns:** `requisition_id`, `job_code`, `country_code`, `worker_category_id`, `open_date`, `snapshot_date`

### `stg_internal__learning_skill_snapshot`

**Source:** `internal_parquet('learning_skill_snapshot.parquet')`
**Key columns:** `employee_id`, `skill_uri`, `proficiency_level`, `snapshot_date`

---

## 13. MART MODELS — CORE

**Location:** `models/marts/core/`
**Materialization:** table
**Tests:** `unique` + `not_null` on all primary keys

### `dim_geography`

Common geography dimension. Derived from the union of all Eurostat staging region codes.

**Columns:**
```
geo_id (PK), nuts_code, nuts_level, parent_nuts_code
country_code, region_name, coverage_status
```

**Tests:** `unique(geo_id)`, `not_null(geo_id)`

### `dim_sector`

Common sector dimension. Derived from NACE codes found in the vacancy and pay-gap extracts.

**Columns:**
```
sector_id (PK, NACE code or 'ALL'), sector_name, nace_level
```

**Tests:** `unique(sector_id)`, `not_null(sector_id)`

### `fct_labour_market_region_sector`

Core fact table. Aligns all Eurostat signal sources to a common `(geo_id, sector_id, signal_name, period_code)` grain.

**Columns:**
```
signal_id (PK), geo_id, sector_id, period_code, period_type
signal_name, signal_value (double)
```

**signal_name values in live data:**
- `employment_rate`
- `unemployment_rate`
- `job_vacancy_rate`
- `gender_pay_gap`
- `labour_market_slack_rate`
- `labour_flow_to_employment`
- `labour_flow_to_inactivity`
- `employment_continuity`

**Tests:** `unique(signal_id)`, `not_null(signal_id)`

### `mart_semantic_metrics`

The primary output mart for the API. Computes the four approved business metrics from the latest available signal periods. Joins ESCO skill coverage from reference Parquet.

**Columns:**
```
semantic_metric_id (PK — geo_id::sector_id::metric_id)
geo_id, sector_id, metric_id, metric_value (double)
primary_source_id, implementation_status, evidence_summary
```

**Four metric rows per (geo_id, sector_id):** `hiring_pressure_index`, `labour_resilience`, `equity_risk_score`, `transition_readiness`

**Key intermediate CTEs (in order):**

| CTE                     | Purpose                                                               |
| ----------------------- | --------------------------------------------------------------------- |
| `latest_signal_periods` | Max period per signal — ensures latest-only semantics                 |
| `country_signals`       | Pivots country-level signals (employment, unemployment, slack, flows) |
| `sector_pairs`          | Builds all (geo, sector) combinations including ALL                   |
| `sector_signals`        | Pivots sector-level signals (vacancy, gender pay gap)                 |
| `skill_flags`           | Per-occupation digital/green skill flags from ESCO + skill relations  |
| `sector_skill_context`  | Aggregates digital/green coverage % per NACE sector                   |
| `raw_scores`            | Applies formula weights to raw signals                                |
| `clamped_scores`        | `LEAST(100, GREATEST(0, ROUND(raw)))` on all four metrics             |
| `final_scores`          | Computes transition_readiness from the other three                    |
| `unioned`               | UNION ALL of four metric rows per (geo, sector) pair                  |

**Tests:** `unique(semantic_metric_id)`, `not_null(metric_value)`

### `mart_workforce_command_center`

Curated command-centre join for the dashboard. Latest signal per name, enriched with geography and sector labels.

**Columns:**
```
mart_row_id (PK — geo_id::sector_id::signal_name)
signal_name, signal_value, period_code, period_type
country_code, region_name, nuts_level, sector_name
```

**Tests:** `unique(mart_row_id)`, `not_null(mart_row_id)`

---

## 14. MART MODELS — INTERNAL

**Location:** `models/marts/internal/`
**Materialization:** table

### `dim_worker_category`

Explicit worker-category dimension. Derived from the internal job architecture.

**Columns:**
```
worker_category_id (PK), worker_category_label
primary_job_family, representative_job_level, representative_nace_code
headcount_proxy, esco_uri
```

**Tests:** `unique(worker_category_id)`, `not_null(worker_category_id)`

### `fct_internal_pay_snapshot`

Internal pay facts aggregated by country, worker category, and snapshot date. Computes internal gender pay gap.

**Source:** `stg_internal__payroll_snapshot` joined with `stg_internal__job_architecture`

**Filter applied:** `employment_status IN ('active', 'employed') AND gender IN ('female', 'male') AND base_pay_amount > 0`

**Columns:**
```
internal_pay_snapshot_id (PK — country::worker_category::snapshot_date)
country_code, snapshot_date, worker_category_id
nace_code, esco_uri, pay_currency
headcount, female_count, male_count
avg_base_pay, female_avg_base_pay, male_avg_base_pay
internal_gender_pay_gap  -- ((male_avg - female_avg) / male_avg) * 100, null if either gender missing
```

**Gap formula:** `ROUND(((male_avg_base_pay - female_avg_base_pay) / male_avg_base_pay) * 100, 1)` — null when either gender is absent or `male_avg = 0`.

**Tests:** `unique(internal_pay_snapshot_id)`, `not_null(internal_pay_snapshot_id)`

### `fct_internal_workforce_snapshot`

Internal HRIS workforce facts aggregated by country, worker category, and snapshot date.

**Columns:**
```
internal_workforce_snapshot_id (PK)
country_code, snapshot_date, worker_category_id
headcount, female_count, male_count
active_count, full_time_count, part_time_count
avg_tenure_months
```

**Tests:** `unique(internal_workforce_snapshot_id)`, `not_null(internal_workforce_snapshot_id)`

### `fct_internal_hiring_demand`

Internal ATS hiring demand aggregated by country, worker category, and snapshot date.

**Columns:**
```
internal_hiring_demand_id (PK)
country_code, snapshot_date, worker_category_id
open_requisition_count
```

**Tests:** `unique(internal_hiring_demand_id)`, `not_null(internal_hiring_demand_id)`

### `fct_internal_skill_snapshot`

Internal employee skills coverage aggregated by country, worker category, and snapshot date.

**Columns:**
```
internal_skill_snapshot_id (PK)
country_code, snapshot_date, worker_category_id
distinct_skills_covered, avg_proficiency
```

### `mart_internal_market_pay_benchmark`

Joins the latest internal pay snapshot against the latest market gender pay gap for the matching country and sector. Core input to the Phase 4 simulation.

**Key join logic:**
- Finds the latest `gender_pay_gap` signal from `fct_labour_market_region_sector`
- Prefers sector `B-S` (business economy), falls back to `A-S` (all sectors)
- Joins to latest internal pay snapshot by `country_code`
- Computes `gap_to_market = internal_gender_pay_gap - market_gender_pay_gap`
- Sets `market_benchmark_available = true/false`

**Primary key:** `benchmark_row_id = country_code::worker_category_id::snapshot_date`

**Tests:** `unique(benchmark_row_id)`, `not_null(benchmark_row_id)`

### `mart_pay_transparency_category_review` (Phase 4)

Classifies each worker-category pay gap row from `mart_internal_market_pay_benchmark` into a pay-transparency review state. This is the compliance simulation output.

**Source:** `mart_internal_market_pay_benchmark` filtered to `internal_gender_pay_gap IS NOT NULL`

**Classification logic:**

```sql
CASE
  WHEN abs(internal_gender_pay_gap) >= 10.0
    OR abs(coalesce(gap_to_market, 0)) >= 2.0
    THEN 'unresolved_review_item'
  WHEN abs(internal_gender_pay_gap) >= 5.0
    THEN 'observed_gap'
  ELSE 'justified_difference'
END AS review_state
```

**Priority assignment:**

```sql
CASE
  WHEN abs(internal_gender_pay_gap) >= 10.0 THEN 'high'
  WHEN abs(gap_to_market) >= 2.0
    OR abs(internal_gender_pay_gap) >= 5.0  THEN 'medium'
  ELSE 'low'
END AS review_priority
```

**Thresholds stored in mart output (not hardcoded in application code):**
- `observed_gap_threshold_pct = 5.0`
- `unresolved_review_threshold_pct = 10.0`
- `market_delta_threshold_pct = 2.0`

**All rows carry:** `human_review_required = true`, `formula_version = 'pay-transparency-review-v1'`

**Primary key:** `pay_transparency_review_id = benchmark_row_id`

**Tests:** `unique(pay_transparency_review_id)`, `not_null(pay_transparency_review_id)`

---

## 15. MART MODELS — REFERENCE

**Location:** `models/marts/reference/`
**Materialization:** table

### `dim_metric_registry`

Passes through the `ref_metric_registry` seed. Powers the API's metric metadata and the evidence drawer's formula-version display.

**Columns (from seed):**
```
metric_id, metric_name, metric_group, grain, definition
owner, formula_version, human_review_required, implementation_status, notes
```

### `dim_data_sources`

Passes through the `ref_data_sources` seed. Powers provenance badges in the dashboard.

**Columns (from seed):**
```
source_id, source_name, source_family, source_version, coverage_notes
```

### `dim_governance_actions`

Passes through the `ref_governance_actions` seed. Powers the governance console's available-actions list.

**Columns (from seed):**
```
action_code, action_name, requires_reason
```

---

## 16. DBT TESTING SUMMARY

All primary-key columns across every mart carry `unique` and `not_null` dbt tests. Tests run on `dbt test` and are part of the build gate.

**Total test count:**
- `dim_geography`: 2 tests
- `dim_sector`: 2 tests
- `fct_labour_market_region_sector`: 2 tests
- `mart_workforce_command_center`: 2 tests
- `mart_semantic_metrics`: 3 tests (unique + not_null on semantic_metric_id, not_null on metric_value)
- `dim_worker_category`: 2 tests
- `fct_internal_pay_snapshot`: 2 tests
- `fct_internal_workforce_snapshot`: 2 tests
- `fct_internal_hiring_demand`: 2 tests
- `mart_internal_market_pay_benchmark`: 2 tests
- `mart_pay_transparency_category_review`: 2 tests

**Known gap:** No reconciliation tests against published Eurostat headline figures (required before v1.0 GA — see technical assessment §10 Week 1 gate).

---

## 17. DBT PROFILES AND CONNECTION

`analytics/profiles.yml` configures the DuckDB connection. The warehouse file is `data/workforceguard_analytics.duckdb` (relative to repo root).

**`profiles.yml.example`** is committed; the real `profiles.yml` is gitignored if it contains an absolute path.

**Run commands:**
```bash
# From analytics/ directory
dbt run            # Build all models
dbt test           # Run all data tests
dbt run --select staging    # Run only staging views
dbt run --select marts      # Run only mart tables
dbt seed           # Load reference and governance CSVs
dbt build          # seed + run + test in dependency order
```

**Build workspace script:** `scripts/build_phase1_workspace.py` — orchestrates a full clean rebuild: pull EU data → pull ESCO → prepare internal data → dbt build.

---

## 18. DATA INGESTION SCRIPTS

**Location:** `scripts/`

| Script                                  | Purpose                                                                        |
| --------------------------------------- | ------------------------------------------------------------------------------ |
| `pull_eu_data.py`                       | Pulls 16 Eurostat datasets via JSON-stat API, writes Parquet to `data/eu_raw/` |
| `pull_esco_api_data.py`                 | Pulls ESCO occupation hierarchy and skills, writes to `data/reference/`        |
| `prepare_reference_data.py`             | Prepares ESCO-NACE crosswalk for the reference layer                           |
| `prepare_internal_company_data.py`      | Generates sample internal data (payroll, HRIS, ATS, job arch, learning)        |
| `prepare_france_public_company_data.py` | Prepares France public-company reference data                                  |
| `generate_eu_calibrated_data.py`        | Generates calibrated EU-context sample data                                    |
| `build_phase1_workspace.py`             | Orchestrates full clean rebuild (pull → prep → dbt build)                      |

**`pull_eu_data.py` behaviour:**
- Reads `configs/eu_sources.yaml` for dataset registry
- Accepts `--datasets` CLI arg to narrow the pull
- Validates dimension filters against Eurostat API discovery endpoint
- Writes one Parquet per dataset to `data/eu_raw/`
- Writes a manifest JSON (`data/eu_meta/manifest.json`) with pull timestamps
- Safe for incremental re-runs: no destructive overwrites on prior vintages

**Dependencies (`requirements.txt`):**
```
numpy
pandas
pyarrow
pyyaml
openpyxl
requests
urllib3<2
```

---

*Continued in Part 3: Backend API — FastAPI Service, Repository Methods, Endpoints, Response Contracts*


# WorkforceGuard AI — Master Reference Document
## Part 3 of 4: Backend API — FastAPI Service, Repository, Endpoints, Response Contracts

---

## 19. BACKEND OVERVIEW

**Location:** `dashboard/backend/`
**Framework:** FastAPI + uvicorn
**Python:** 3.12 recommended
**Main entry point:** `main.py`
**Core service module:** `service.py` (4,458 lines — `AnalyticsRepository` class)
**Default port:** `http://127.0.0.1:8001`
**Port override:** `WORKFORCEGUARD_HOST`, `WORKFORCEGUARD_PORT` environment variables

**Files:**
```
dashboard/backend/
├── main.py                  # FastAPI app, request models, route definitions (184 lines)
├── service.py               # AnalyticsRepository — all business logic (4,458 lines)
├── requirements.txt         # fastapi, uvicorn, duckdb, pandas, pyarrow
└── tests/
    └── test_service.py      # AnalyticsRepositoryTests (722 lines)
```

---

## 20. FASTAPI APPLICATION (main.py)

### Request Models

```python
class AskRequest(BaseModel):
    question: str
    country: str = "ALL"
    geography: str = "EU27_AVG"
    sector: str = "ALL"
    period: str = "latest"
    benchmark_geography: Optional[str] = None
    benchmark_sector: Optional[str] = None

class GovernanceEventRequest(BaseModel):
    action_code: str
    target_type: str
    target_id: str
    reason: Optional[str] = None
    context: Optional[Dict[str, Any]] = None
```

### Middleware

- **CORS:** `allow_origins=["*"]` — wildcard, all origins allowed (production blocker — must be replaced with env-driven allowlist before GA)
- **Error handling:** `guarded()` wrapper catches `FileNotFoundError` → 404, `ValueError` → 400, all others → 500

### All 9 HTTP Endpoints

| Method | Path                     | Purpose                                                            |
| ------ | ------------------------ | ------------------------------------------------------------------ |
| GET    | `/`                      | Root health + filter options + available governance actions        |
| GET    | `/health`                | Service health check                                               |
| GET    | `/api/overview`          | Full command-centre overview payload                               |
| POST   | `/api/ask`               | Analyst console question answering                                 |
| GET    | `/api/evidence-pack`     | Exportable evidence pack for compliance review                     |
| POST   | `/api/governance-events` | Record a governance action (approve / override / reverse / export) |
| GET    | `/api/governance-events` | List recent governance events and available actions                |
| GET    | `/api/unemployment`      | Convenience: unemployment trend series for charts                  |
| GET    | `/api/employment`        | Convenience: employment trend series for charts                    |
| GET    | `/api/vacancies`         | Convenience: vacancy by sector series for charts                   |
| GET    | `/api/gender_pay_gap`    | Convenience: pay gap by sector series for charts                   |

**Note:** The four convenience endpoints (`/api/unemployment`, `/api/employment`, `/api/vacancies`, `/api/gender_pay_gap`) delegate to `build_overview` and extract the relevant chart series. They are thin wrappers kept for frontend compatibility.

### Query Parameters (overview, evidence-pack, convenience endpoints)

| Parameter             | Default      | Notes                                       |
| --------------------- | ------------ | ------------------------------------------- |
| `country`             | `"ALL"`      | ISO 3166-1 alpha-2 or `"ALL"`               |
| `geography`           | `"EU27_AVG"` | Geo ID from `dim_geography` or `"EU27_AVG"` |
| `sector`              | `"ALL"`      | NACE sector ID or `"ALL"`                   |
| `period`              | `"latest"`   | Year string or `"latest"`                   |
| `benchmark_geography` | `None`       | Optional comparison geo                     |
| `benchmark_sector`    | `None`       | Optional comparison sector                  |

---

## 21. ANALYTICSREPOSITORY CLASS (service.py)

`AnalyticsRepository` is initialised once at process start with the repo root path. It holds all path references, loads the three seed CSV registries into memory, and exposes public methods for the API layer.

### Constructor

```python
AnalyticsRepository(
    root_dir: Path,
    governance_events_path: Optional[Path] = None,
    internal_data_dir: Optional[Path] = None,
    analytics_db_path: Optional[Path] = None,
)
```

**Path defaults:**
- `data_dir` → `root_dir / data / eu_raw`
- `analytics_db_path` → `root_dir / data / workforceguard_analytics.duckdb`
- `internal_data_dir` → `root_dir / data / internal`
- `analytics_dir` → `root_dir / analytics`
- `seed_dir` → `analytics_dir / seeds`
- `governance_events_path` → `root_dir / data / governance_events.json`

**In-memory registries loaded on init:**
- `self.metric_registry` — from `seeds/reference/ref_metric_registry.csv`, keyed by `metric_id`
- `self.data_sources` — from `seeds/reference/ref_data_sources.csv`, keyed by `source_id`
- `self.governance_actions` — from `seeds/governance/ref_governance_actions.csv`, keyed by `action_code`, with `requires_reason` parsed to bool
- `self.governance_events` — from `governance_events_path`, max 50 events, newest first

### Database Connection Strategy

The repository uses two connection modes, selected on each query:

| Mode        | Trigger                                       | Behaviour                                              |
| ----------- | --------------------------------------------- | ------------------------------------------------------ |
| **Modeled** | DuckDB file exists with all 4 required tables | Opens `workforceguard_analytics.duckdb` read-only      |
| **Raw**     | DuckDB file missing or tables absent          | Opens `:memory:`, creates Parquet views over `eu_raw/` |

**Required tables for modeled mode:** `dim_geography`, `dim_sector`, `fct_labour_market_region_sector`, `mart_workforce_command_center`

**Raw fallback views created on memory connection:**
- `raw_job_vacancy_rate` → `job_vacancy_rate.parquet`
- `raw_unemployment_rate` → `unemployment_rate.parquet`
- `raw_employment_rate` → `employment_rate.parquet`
- `raw_gender_pay_gap_sector` → `gender_pay_gap_sector.parquet`
- `raw_labour_market_flows` → `labour_market_flows.parquet` (with optional empty-schema fallback)
- `raw_labour_market_slack` → `labour_market_slack.parquet` (with optional empty-schema fallback)

---

## 22. PUBLIC METHODS — ANALYTICSREPOSITORY

### `resolve_filters(country, geography, sector, period)` → `(FilterState, Dict)`

Validates and resolves all four filter parameters against available data. Returns a `FilterState` dataclass and an `options` dict.

**FilterState fields:**
```python
@dataclass
class FilterState:
    country: str
    geography: str
    geography_label: str
    sector: str
    sector_label: str
    period: str
```

**Filter resolution rules:**
- If `country` not in available options → reset to `"ALL"`
- If `geography` not in filtered geography options → reset to `"EU27_AVG"` (or first non-EU27 option for a selected country)
- If geography is not `EU27_AVG` → `country` is inferred from first two chars of geography ID
- If `sector` not in available options → reset to `"ALL"`
- If `period` not in available periods → reset to `"latest"`

**Returns options dict containing:**
- `country_options` — list of `{id, label}`
- `geography_options` — list of `{id, label, country_code}`
- `sector_options` — list of `{id, label}`
- `period_options` — list of `{id, label}`
- `supported_grains` — dict of grain availability (country: true, NUTS2: blocked, sector: true)

---

### `build_overview(country, geography, sector, period, benchmark_geography, benchmark_sector)` → `Dict`

The primary API method. Assembles the complete overview payload by calling all internal builders in order.

**Build sequence:**
1. `resolve_filters()` — validate and resolve filter state
2. `_build_metric()` × 4 — observed metrics (vacancy_rate, unemployment_rate, employment_rate, gender_pay_gap)
3. `_build_comparative_intelligence()` — benchmark comparisons across 5 types
4. `_build_semantic_metrics()` — 4 modeled scores (hiring_pressure_index, etc.)
5. `_build_charts()` — unemployment trend, employment trend, vacancy by sector, pay gap by sector
6. `_build_intelligence()` — headline, summary, tone, recommendations, suggested questions
7. `_build_internal_data_status()` — Phase 3 internal data availability and trust state
8. `_build_company_benchmark()` — internal vs market comparison (gated by trust level)
9. `_build_pay_transparency_simulation()` — Phase 4 pay-transparency review (gated by mart availability)

**Overview response shape:**

```json
{
  "generated_at": "ISO8601",
  "filters": {
    "applied": {country, geography, geography_label, sector, sector_label, period},
    "options": {country_options, geography_options, sector_options, period_options, supported_grains},
    "notes": ["..."]
  },
  "metrics": [
    {
      "id": "vacancy_rate",
      "title": "Average job vacancy rate",
      "value": 2.4,
      "unit": "%",
      "period": "2024-Q2",
      "source_id": "eurostat_jvs",
      "human_review_required": false,
      "provenance": {...},
      "coverage": {...},
      "tone": "watch|good|neutral",
      "desired_direction": "down"
    }
  ],
  "comparisons": {
    "eu": {...}, "peer": {...}, "prior_period": {...}, "market": {...}, "sector": {...}
  },
  "semantic_metrics": [
    {
      "id": "hiring_pressure_index",
      "value": 72,
      "provenance": {...},
      "coverage": {...},
      "tone": "watch"
    }
  ],
  "charts": {
    "unemployment_trend": {"series": [...]},
    "employment_trend": {"series": [...]},
    "vacancy_by_sector": {"series": [...]},
    "pay_gap_by_sector": {"series": [...]}
  },
  "intelligence": {
    "headline": "...",
    "summary": "...",
    "tone": "watch|good|neutral",
    "recommendations": [...],
    "suggested_questions": [...]
  },
  "internal_data": {available, snapshot_date, sources, worker_category_count, note},
  "company_benchmark": {available, worker_category, evidence_basis, note},
  "pay_transparency": {available, summary, categories, note},
  "governance": {available_actions, event_contract, recent_events}
}
```

---

### `answer_question(question, country, geography, sector, period, ...)` → `Dict`

Analyst console question handler. Builds the full overview first, then applies keyword-matching to route the question to the most appropriate templated response.

**Question routing categories:**
- Comparison questions ("compared to", "benchmark", "eu average", "peer") → comparative intelligence response
- Change/trend questions ("what changed", "trend", "worse", "why") → prior-period delta response
- Vacancy / hiring questions → vacancy rate + hiring pressure response
- Pay gap / equity questions → gender pay gap + equity risk response
- Employment / resilience questions → employment rate + labour resilience response
- Internal / company questions ("our company", "internal", "my workforce") → company benchmark or trust-gate message
- Pay transparency questions ("pay transparency", "directive", "category", "review") → Phase 4 simulation response
- Default → general market summary

**Response shape:**

```json
{
  "question": "...",
  "category": "comparison|trend|vacancy|equity|...",
  "confidence": "high|medium|low",
  "answer": "...",
  "evidence": [{"label": "...", "value": "..."}],
  "provenance": [...],
  "follow_ups": [...],
  "benchmark_context": {...},
  "limitations": [...],
  "evidence_basis": "external|company_aware",
  "coverage": {status, summary, applicable_metric_count, total_metric_count}
}
```

**Key design rule:** The LLM is not involved. All responses are deterministic SQL + template composition. This is a compliance product — every answer must be reproducible and auditable.

---

### `build_evidence_pack(country, geography, sector, period, ...)` → `Dict`

Builds an exportable evidence pack by calling `build_overview` and assembling the compliance-oriented subset.

**Evidence pack shape:**

```json
{
  "generated_at": "ISO8601",
  "filters": {country, geography, geography_label, sector, sector_label, period},
  "summary": {
    "headline": "...",
    "summary": "..."
  },
  "metrics": [...],
  "comparisons": {...},
  "semantic_metrics": [...],
  "internal_data": {...},
  "company_benchmark": {...},
  "pay_transparency": {...},
  "recommendations": [...],
  "governance": {...}
}
```

**Current limitation:** No hash signing, no PDF rendering. Version 1.0 target requires ed25519-signed JSON + WeasyPrint PDF regenerable byte-identically from the same warehouse vintage.

---

### `record_governance_event(payload: Dict)` → `Dict`

Records a governance action to the in-memory list and persists to `governance_events.json`.

**Validation:**
- `action_code` must match a row in `self.governance_actions`
- If `action.requires_reason == True` and `reason` is empty → raises `ValueError`

**Event ID:** Sequential `evt_{n:04d}` (based on current list length at insert time — not globally unique across process restarts)

**Persistence:** JSON write to `governance_events_path`. Events capped at 50. Newer events at index 0.

---

### `build_governance_payload()` → `Dict`

Returns the current governance state:

```json
{
  "available_actions": [
    {"action_code": "approved", "action_name": "Approved", "requires_reason": false},
    ...
  ],
  "event_contract": {
    "required_fields": ["action_code", "target_type", "target_id"],
    "optional_fields": ["reason", "context"]
  },
  "recent_events": [...(last 10)]
}
```

---

## 23. INTERNAL BUILDER METHODS (service.py)

### `_build_internal_data_status()` → `Dict`

Checks whether Phase 3 internal data is available. Returns one of three states:

| State                   | Trigger                                          | `available` |
| ----------------------- | ------------------------------------------------ | ----------- |
| DB not ready            | `_modeled_database_ready()` returns False        | False       |
| Required tables missing | Internal mart tables not found in DuckDB         | False       |
| Available               | All required tables present and payroll > 0 rows | True        |

**Required internal tables check:** `stg_internal__payroll_snapshot`, `stg_internal__job_architecture`, `fct_internal_pay_snapshot`, `dim_worker_category`, `mart_internal_market_pay_benchmark`

**Returns when available:**
```json
{
  "available": true,
  "snapshot_date": "2026-03-31",
  "sources": [
    {"source_id": "internal_payroll_snapshot", "record_count": 6, "trusted_for_company_claims": true},
    ...
  ],
  "worker_category_count": 3,
  "country_count": 1,
  "benchmark_row_count": 3,
  "supported_scope": "country",
  "note": null
}
```

---

### `_build_company_benchmark(filters, observed_metrics, internal_data)` → `Dict`

Builds the company-aware benchmark section. Gated by `internal_data["available"]`.

**Returns `available: False` with a reason note if:**
- Internal data is not available
- No benchmark rows for the selected geography
- Worker category dimension is empty
- Not all `trusted_for_company_claims` sources are present

**When available, returns:**
```json
{
  "available": true,
  "worker_category": {
    "id": "...", "label": "...", "headcount": 120,
    "female_count": 58, "male_count": 62,
    "internal_gender_pay_gap": 8.2
  },
  "market_benchmark": {
    "market_gender_pay_gap": 13.1, "market_sector": "B-S", "market_period": "2022"
  },
  "gap_to_market": -4.9,
  "evidence_basis": "modeled_internal",
  "note": null
}
```

---

### `_build_pay_transparency_simulation(filters, internal_data)` → `Dict`

Builds the Phase 4 pay-transparency simulation section. Reads from `mart_pay_transparency_category_review` when the mart is available.

**Returns `available: False` with a note if:**
- Internal data is not available
- `mart_pay_transparency_category_review` table is not in DuckDB

**When available, returns:**
```json
{
  "available": true,
  "summary": {
    "total_category_count": 3,
    "unresolved_review_item_count": 1,
    "observed_gap_count": 1,
    "justified_difference_count": 1
  },
  "categories": [
    {
      "pay_transparency_review_id": "...",
      "worker_category_id": "...", "worker_category_label": "...",
      "headcount": 45, "female_count": 22, "male_count": 23,
      "internal_gender_pay_gap": 12.4,
      "market_gender_pay_gap": 13.1, "gap_to_market": -0.7,
      "review_state": "unresolved_review_item",
      "review_priority": "high",
      "human_review_required": true,
      "formula_version": "pay-transparency-review-v1",
      "observed_gap_threshold_pct": 5.0,
      "unresolved_review_threshold_pct": 10.0,
      "market_delta_threshold_pct": 2.0
    }
  ],
  "note": null
}
```

---

### `_build_comparative_intelligence(filters, observed_metrics, benchmark_geography, benchmark_sector)` → `Dict`

Builds five benchmark comparisons. Each benchmark type computes deltas against the selected geography's observed metrics.

**Five benchmark types:**

| benchmark_id   | Label               | benchmark_status |
| -------------- | ------------------- | ---------------- |
| `eu`           | EU27 proxy average  | proxy            |
| `peer`         | Peer-country basket | proxy            |
| `prior_period` | Prior period        | official         |
| `market`       | Selected market     | official         |
| `sector`       | Selected sector     | official         |

**Each comparison entry shape:**
```json
{
  "benchmark_id": "eu",
  "label": "EU27 proxy average",
  "benchmark_status": "proxy",
  "coverage_status": "full|partial|unavailable",
  "coverage_note": "...",
  "applicable_metric_count": 4,
  "total_metric_count": 4,
  "metrics": [
    {
      "id": "vacancy_rate",
      "current_value": 2.4,
      "benchmark_value": 2.9,
      "delta": -0.5,
      "delta_label": "-0.5 pts",
      "tone": "good|watch|neutral",
      "period": "2024-Q2"
    }
  ]
}
```

**Coverage states:**
- `full` — all 4 observed metrics available for the benchmark
- `partial` — 1–3 metrics available
- `unavailable` — 0 metrics available

---

### `_build_intelligence(filters, observed_metrics, semantic_metrics, charts, comparisons)` → `Dict`

Generates the headline, summary text, tone, recommendations, and suggested questions for the current filter state.

**Tone derivation:** `watch` if any signal is in a concerning direction; `good` if all signals are positive; `neutral` otherwise.

**Recommendation generation:** Checks threshold breaches per metric and appends prioritised recommendations. Priority: `high` / `medium` / `low`.

**Suggested questions:** Returns 8 canonical follow-up questions from `SUGGESTED_QUESTIONS` constant plus any context-specific questions derived from the active filter state.

---

### `_build_metric(metric_id, filters)` → `Optional[Dict]`

Builds a single observed metric for the current filter state. Returns `None` if no data available.

**Observed metric IDs:** `vacancy_rate`, `unemployment_rate`, `employment_rate`, `gender_pay_gap`

**AGGREGATE_SECTORS** — sectors excluded from sector-level metric queries (aggregate codes like `"A-S"`, `"B-E"`, `"B-S"` etc.):
```python
AGGREGATE_SECTORS = {"A-S", "B-E", "B-F", "B-N", "B-S", "B-S_X_O", "G-I", "G-N", "M_N", "O-Q", "O-S", "R_S"}
```

**Metric shape returned:**
```json
{
  "id": "vacancy_rate",
  "title": "Average job vacancy rate",
  "value": 2.4,
  "unit": "%",
  "period": "2024-Q2",
  "source_id": "eurostat_jvs",
  "formula_version": "observed-v1",
  "human_review_required": false,
  "desired_direction": "down",
  "definition": "...",
  "provenance": {
    "source_id": "eurostat_jvs",
    "source_name": "Eurostat Job Vacancy Statistics",
    "formula_version": "observed-v1",
    "human_review_required": false
  },
  "coverage": {status, summary},
  "tone": "watch"
}
```

---

### `_build_semantic_metrics(observed_metrics, filters)` → `List[Dict]`

Queries `mart_semantic_metrics` from DuckDB for the current (geo_id, sector_id) pair. Returns the four modeled scores enriched with provenance and tone.

**Semantic metric shape:**
```json
{
  "id": "hiring_pressure_index",
  "value": 72,
  "primary_source_id": "eurostat_jvs",
  "implementation_status": "proxy_live",
  "evidence_summary": "Vacancy 2.4%, unemployment 6.1%, slack 9.2%",
  "provenance": {...},
  "coverage": {...},
  "tone": "watch"
}
```

---

### `_build_charts(filters)` → `Dict`

Builds four chart data series for the current filter state.

| Chart key            | Content                            | X-axis   | Y-axis      |
| -------------------- | ---------------------------------- | -------- | ----------- |
| `unemployment_trend` | Unemployment rate over all periods | `period` | `value (%)` |
| `employment_trend`   | Employment rate over all periods   | `period` | `value (%)` |
| `vacancy_by_sector`  | Latest vacancy rate per sector     | `sector` | `value (%)` |
| `pay_gap_by_sector`  | Latest gender pay gap per sector   | `sector` | `value (%)` |

Each series is a list of `{period: "...", value: n}` or `{sector: "...", value: n}` dicts, sorted chronologically or by value descending.

---

## 24. HELPER FUNCTIONS (module-level)

| Function                                    | Purpose                                                          |
| ------------------------------------------- | ---------------------------------------------------------------- |
| `clamp_score(value: float) → int`           | Clamp to [0, 100], round to nearest int                          |
| `parse_bool(value: Any) → bool`             | Parse "1", "true", "yes" → True                                  |
| `escape_path(path: Path) → str`             | Resolve and escape single quotes for DuckDB string literal       |
| `period_sort_key(period_code: str) → tuple` | Parse `YYYY-QN` or `YYYY` → `(year, quarter)` tuple for ordering |
| `format_signed_delta(delta, unit) → str`    | Format `+2.3 pts` / `-1.1 pts` / `"Unavailable"`                 |

---

## 25. OBSERVED METRIC CONFIG (module-level)

```python
OBSERVED_METRIC_CONFIG = {
    "vacancy_rate":       {signal_name, title, unit, source_id, formula_version, default_sector, desired_direction, definition, human_review_required},
    "unemployment_rate":  {..., desired_direction: "down", human_review_required: False},
    "employment_rate":    {..., desired_direction: "up",   human_review_required: False},
    "gender_pay_gap":     {..., desired_direction: "down", human_review_required: True},
}
```

`gender_pay_gap` is the only observed metric with `human_review_required: True`.

**COMPARISON_BENCHMARKS** defines the 5 benchmark types and their `benchmark_status` (proxy vs official).

**SUGGESTED_QUESTIONS** — 8 canonical analyst follow-up questions surfaced in the dashboard console:
```
"How does this market compare to the EU benchmark?"
"Which peer countries look most similar?"
"What changed versus the prior period?"
"Which signal is worsening fastest?"
"Compared to what?"
"Why did this change?"
"How confident is this benchmark?"
"What limits this comparison?"
```

---

## 26. TEST SUITE (test_service.py)

**Location:** `dashboard/backend/tests/test_service.py`
**Lines:** 722
**Framework:** `unittest.TestCase`, real `AnalyticsRepository` instance

**Class:** `AnalyticsRepositoryTests`

**Key test patterns:**
- `setUpClass` creates one `AnalyticsRepository(ROOT_DIR)` — requires `workforceguard_analytics.duckdb` to exist
- `_copy_analytics_db(temp_dir)` — copies the DuckDB for isolated write tests
- `_write_internal_manifest(temp_dir, trusted)` — creates a fake `internal_meta/manifest.json` for trust-gate tests

**Key test areas covered:**
- Filter resolution (valid country, invalid country fallback, EU27_AVG default)
- Overview build (structure validation, notes, filter echo)
- Metric building (vacancy, unemployment, employment, pay gap)
- Semantic metrics (four scores present, values in [0, 100])
- Chart building (series present, sorted)
- Analyst console (question routing, confidence levels, evidence returned)
- Evidence pack (shape matches subset of overview)
- Governance event recording (valid action, action with reason required, unknown action raises ValueError)
- Internal data status (no DB → available: False; with DB → available based on table presence)
- Pay transparency simulation (mart present → available: True; categories classified correctly)

**Known test gap:** No tests for the Phase 4 pay-transparency simulation with edge cases (all justified, all unresolved, empty mart).

---

## 27. STARTUP AND CONFIGURATION

### Backend Startup

```bash
cd dashboard/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python main.py
```

### Environment Variables

| Variable              | Default       | Purpose               |
| --------------------- | ------------- | --------------------- |
| `WORKFORCEGUARD_HOST` | `"127.0.0.1"` | Bind host for uvicorn |
| `WORKFORCEGUARD_PORT` | `"8001"`      | Bind port for uvicorn |

### Data Path Dependencies

The repository expects the following relative to `root_dir` (two levels above `dashboard/backend/`):

| Path                                                    | Required     | Purpose                                     |
| ------------------------------------------------------- | ------------ | ------------------------------------------- |
| `data/workforceguard_analytics.duckdb`                  | Preferred    | Modeled DuckDB warehouse                    |
| `data/eu_raw/*.parquet`                                 | Fallback     | Raw Parquet files (used when DuckDB absent) |
| `data/internal/*.parquet`                               | Phase 3      | Internal company data                       |
| `data/reference/*.parquet`                              | Phase 3+     | ESCO reference data                         |
| `data/governance_events.json`                           | Auto-created | Governance event store                      |
| `analytics/seeds/reference/ref_metric_registry.csv`     | Required     | Metric definitions                          |
| `analytics/seeds/reference/ref_data_sources.csv`        | Required     | Source catalogue                            |
| `analytics/seeds/governance/ref_governance_actions.csv` | Required     | Governance action definitions               |

---

*Continued in Part 4: Frontend Application, Data Assets, Operations, Security, and Gap Summary*


# WorkforceGuard AI — Master Reference Document
## Part 4 of 4: Frontend Application, Data Assets, Operations, Security & Gap Summary

---

## 28. FRONTEND APPLICATION OVERVIEW

**Location:** `dashboard/frontend/`
**Framework:** React 19, Vite 7
**Language:** JavaScript (JSX) — TypeScript migration is a v1.0 GA requirement
**State management:** `useState` + `startTransition` only — no global store
**Data fetching:** `axios` (no base URL interceptor, no request ID propagation)
**Charts:** Recharts 3
**Icons:** Lucide React
**Styling:** Tailwind CSS 4 + custom CSS classes in `App.css` and `index.css`
**Port (dev):** `http://localhost:5173` (Vite default)

### Project Structure

```
dashboard/frontend/
├── src/
│   ├── App.jsx                     # Shell (12 lines — renders <Overview />)
│   ├── App.css                     # Dashboard shell, halo decorators, tonal classes
│   ├── index.css                   # Base resets, dark background, font
│   ├── main.jsx                    # React DOM mount
│   └── components/
│       └── Overview.jsx            # Entire product UI (2,187 lines)
├── package.json                    # Dependencies
├── vite.config.js                  # Proxy + manual chunk splitting
├── index.html
├── tailwind.config.js
└── postcss.config.js
```

### Frontend Dependencies

| Package              | Version | Purpose                      |
| -------------------- | ------- | ---------------------------- |
| react                | 19.2.0  | UI framework                 |
| react-dom            | 19.2.0  | DOM renderer                 |
| axios                | 1.13.5  | HTTP client                  |
| recharts             | 3.7.0   | Chart components             |
| lucide-react         | 0.574.0 | Icon library                 |
| clsx                 | 2.1.1   | Conditional className helper |
| tailwind-merge       | 3.4.1   | Tailwind class deduplication |
| vite                 | 7.3.1   | Build tool                   |
| @vitejs/plugin-react | 5.1.1   | Vite React plugin            |
| tailwindcss          | 4.1.18  | Utility CSS                  |

### Vite Configuration

- **Dev proxy:** `/api/*` and `/health` proxied to `http://127.0.0.1:8001` (override via `VITE_API_PROXY_TARGET`)
- **Manual chunks:** `charts` (recharts), `icons` (lucide-react), `network` (axios)
- **API base:** `import.meta.env.VITE_API_BASE_URL ?? '/api'`

---

## 29. APP.JSX

12 lines. Renders a single `<div className="app-shell">` containing `<Overview />`. No routing. No providers. No state.

```jsx
import Overview from './components/Overview'
import './App.css'

function App() {
  return (
    <div className="app-shell">
      <Overview />
    </div>
  )
}
```

**Critical gap:** No router. The entire product is one page. The v1.0 target is a four-page SPA: Overview, Compare, Evidence, Governance.

---

## 30. OVERVIEW.JSX — COMPONENT MAP

**Location:** `dashboard/frontend/src/components/Overview.jsx`
**Lines:** 2,187 (single file — entire product UI)
**Mixed class + function components:** one `class PanelErrorBoundary extends Component`, all others are function components.

### Module-Level Helpers (lines 67–332)

| Function                                                   | Purpose                                                                                                |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `buildQueryParams(filters)`                                | Builds `{country, geography, sector, period, benchmark_geography, benchmark_sector}` from filter state |
| `formatMetricValue(value, unit)`                           | Formats a metric value as `"2.4%"` or `"—"`                                                            |
| `formatDelta(delta, unit)`                                 | Formats a comparison delta as `"+0.3 pts"`                                                             |
| `formatTooltipValue(value, unit)`                          | Recharts tooltip formatter                                                                             |
| `formatComparisonValue(value, unit)`                       | Comparison section value formatter                                                                     |
| `formatSignedDifference(delta, unit)`                      | Signed `+/-` delta                                                                                     |
| `toneFromConfidence(confidence)`                           | `"high"` → `"good"`, `"low"` → `"watch"`, etc.                                                         |
| `toneFromBenchmarkStatus(status)`                          | `"proxy"` → `"neutral"`, `"official"` → `"good"`                                                       |
| `toneFromCoverageStatus(status)`                           | `"full"` → `"good"`, `"partial"` → `"neutral"`, `"unavailable"` → `"watch"`                            |
| `toneFromEvidenceBasis(basis)`                             | `"company_aware"` → `"good"`, `"external"` → `"neutral"`                                               |
| `buildActiveBenchmarkQuestion(overview)`                   | Derives the active benchmark question for the analyst console                                          |
| `normalizeBenchmarkBasis(benchmarkMeta, overview)`         | Resolves benchmark context from the overview payload                                                   |
| `buildInitialAnalystLimitations(overview, benchmarkBasis)` | Builds initial limitation bullets for the console                                                      |
| `buildConsoleFollowUps(overview)`                          | Returns 8 suggested follow-up questions                                                                |

### Primitive Components

| Component                                                  | Purpose                                                                  |
| ---------------------------------------------------------- | ------------------------------------------------------------------------ |
| `ToneChip({ tone, children })`                             | Coloured status chip — `good` (green), `neutral` (grey), `watch` (amber) |
| `ProvenanceBadge({ provenance, compact })`                 | Source attribution badge with formula version                            |
| `ChartTooltip({ active, payload, label, unit, labelKey })` | Shared Recharts tooltip                                                  |
| `ChartEmptyState({ message })`                             | Empty chart placeholder                                                  |
| `ChartFrame({ children })`                                 | `ResponsiveContainer` wrapper                                            |
| `SelectField({ label, value, options, onChange })`         | Styled `<select>` field                                                  |
| `ScopeBadge({ label, value })`                             | Two-part label + value pill                                              |
| `PanelErrorBoundary` (class)                               | Error boundary with `"Something went wrong in this panel"` fallback      |

### Feature Sections

| Component                                                                                 | Lines     | Description                                                                                |
| ----------------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------ |
| `BriefingBoard({ overview })`                                                             | 454–538   | Top briefing strip — headline, tone, key signals, notes, coverage warnings                 |
| `MetricCard({ metric, onOpenEvidence })`                                                  | 539–575   | Observed metric tile — value, unit, period, tone chip, provenance badge, evidence trigger  |
| `SemanticMetricCard({ metric, onOpenEvidence })`                                          | 576–601   | Modeled metric tile (hiring pressure, resilience, equity risk, transition readiness)       |
| `InlineNotice({ notice, onDismiss })`                                                     | 602–619   | Dismissible inline notice banner                                                           |
| `FilterBar({ filters, options, comparisonTargets, onFilterChange, onExport, exporting })` | 624–716   | Country / geography / sector / period dropdowns + benchmark selectors + export button      |
| `IntelligenceSection({ intelligence, semanticMetrics, onOpenEvidence })`                  | 717–837   | Four semantic metric cards + AI overview recommendations + trend charts                    |
| `ComparisonMetricCard({ metric, benchmarkId, onOpenEvidence })`                           | 838–903   | Single metric delta tile for comparative intelligence section                              |
| `ComparisonSection({ comparisons, filters, comparisonTargets, onOpenEvidence, ... })`     | 904–1083  | Full five-benchmark comparative table — EU, peer, prior period, market, sector             |
| `CompanyBenchmarkSection({ internalData, companyBenchmark })`                             | 1084–1190 | Phase 3 internal vs market section — trust gate, worker category summary, gap display      |
| `ComplianceSimulationSection({ payTransparency, onOpenEvidence })`                        | 1211–1323 | Phase 4 pay-transparency review table — categories, states, priorities, governance buttons |
| `EvidenceDrawer({ ... })`                                                                 | 1324–1416 | Slide-in evidence panel — metric provenance, sources, formula version, governance actions  |
| `AnalystConsole({ filters, initialResponse })`                                            | 1417–1607 | Q&A console — sends questions to `/api/ask`, renders confidence, evidence, follow-ups      |

### Data Hook

| Hook                | Lines     | Description                                                                                                                  |
| ------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `useOverviewData()` | 1608–1805 | Core data hook — `axios.get('/api/overview')`, manages filters state, exports state, analyst response, evidence drawer state |

**`useOverviewData()` returns:**
```javascript
{
  overview,              // The full overview response object
  loading, error,        // Fetch state
  filters,               // Current {country, geography, sector, period, benchmark_geography, benchmark_sector}
  options,               // Filter options from overview.filters.options
  comparisonTargets,     // Benchmark selector options
  activeEvidence,        // Currently open evidence drawer payload
  handleFilterChange,    // (key, value) → update filter, re-fetch
  handleOpenEvidence,    // (metric) → open evidence drawer
  handleCloseEvidence,   // () → close evidence drawer
  handleExport,          // () → fetch /api/evidence-pack and download
  exporting              // boolean — export in progress
}
```

### Root Component

| Component    | Lines     | Description                                                                                               |
| ------------ | --------- | --------------------------------------------------------------------------------------------------------- |
| `Overview()` | 1806–2187 | Root component. Uses `useOverviewData()`. Renders loading spinner, error state, or full dashboard layout. |

**Dashboard layout (when loaded):**
1. `FilterBar` — top filter controls
2. `BriefingBoard` — headline + key signals + notes
3. Observed metric cards (4 × `MetricCard`)
4. `IntelligenceSection` — semantic metrics + trend charts + recommendations
5. `ComparisonSection` — five benchmarks (conditionally shown)
6. `CompanyBenchmarkSection` — Phase 3 internal data (shown when `overview.internal_data.available`)
7. `ComplianceSimulationSection` — Phase 4 pay-transparency (shown when `overview.pay_transparency.available`)
8. `EvidenceDrawer` — slide-in overlay (conditionally rendered)
9. `AnalystConsole` — Q&A input + response panel

---

## 31. CSS DESIGN SYSTEM

**Files:** `App.css`, `index.css`
**Approach:** Custom CSS classes (BEM-like naming) + Tailwind utility classes

### Colour Palette (CSS vars in App.css)

| Token              | Value               | Used For             |
| ------------------ | ------------------- | -------------------- |
| `--surface`        | `#0f172a`           | Dashboard background |
| `--surface-2`      | `#1e293b`           | Card backgrounds     |
| `--surface-3`      | `#334155`           | Elevated surfaces    |
| `--text-primary`   | `#f1f5f9`           | Main text            |
| `--text-secondary` | `#94a3b8`           | Muted text, labels   |
| `--tone-good`      | `#34d399` (emerald) | Positive signal tone |
| `--tone-watch`     | `#fbbf24` (amber)   | Warning tone         |
| `--tone-neutral`   | `#94a3b8` (slate)   | Neutral tone         |

### Halo Decorators (App.css)

```css
.dashboard__halo--one {
  /* Top-right: teal radial gradient blur */
  background: radial-gradient(circle, rgba(127,244,234,0.26), rgba(127,244,234,0));
}
.dashboard__halo--two {
  /* Bottom-left: periwinkle radial gradient blur */
  background: radial-gradient(circle, rgba(141,177,255,0.24), rgba(141,177,255,0));
}
```

### Tone Classes

| Class                 | Colour  | Used On                          |
| --------------------- | ------- | -------------------------------- |
| `.tone-chip--good`    | emerald | `ToneChip` with `tone="good"`    |
| `.tone-chip--watch`   | amber   | `ToneChip` with `tone="watch"`   |
| `.tone-chip--neutral` | slate   | `ToneChip` with `tone="neutral"` |

### Priority Badge Classes

| Class                     | Colour |
| ------------------------- | ------ |
| `.priority-badge--high`   | Red    |
| `.priority-badge--medium` | Amber  |
| `.priority-badge--low`    | Slate  |

### Governance Button Classes

| Class                          | Purpose         |
| ------------------------------ | --------------- |
| `.governance-button--approve`  | Approve action  |
| `.governance-button--override` | Override action |
| `.governance-button--reverse`  | Reverse action  |

### Review State Labels (in JavaScript, not CSS)

```javascript
const REVIEW_STATE_LABELS = {
  observed_gap:           'Observed gap',
  justified_difference:   'Monitored difference',
  unresolved_review_item: 'Unresolved review item',
}
```

### Formatters

- `Intl.NumberFormat('en-US', { maximumFractionDigits: 1 })` — used for metric values
- `Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' })` — governance event timestamps

**Known issue:** `'en-US'` locale used for an EU product. The v1.0 target is to default to user locale and pin to `'de-DE'` in evidence packs (EU compliance filing expectation).

---

## 32. FRONTEND STARTUP

```bash
# From repo root
cd dashboard/frontend
npm install
npm run dev        # Development server on :5173

npm run build      # Production build to dist/
npm run preview    # Preview production build
npm run lint       # ESLint
```

**Environment variables (`.env` or `.env.local`):**

| Variable                | Default                   | Purpose                                  |
| ----------------------- | ------------------------- | ---------------------------------------- |
| `VITE_API_BASE_URL`     | `'/api'`                  | Backend base path (used in Overview.jsx) |
| `VITE_API_PROXY_TARGET` | `'http://127.0.0.1:8001'` | Vite dev proxy target                    |

---

## 33. DATA ASSETS

### `data/eu_raw/` — Eurostat Raw Parquet

16 Parquet files, one per configured dataset. Each file follows the Eurostat JSON-stat column schema (dim codes + values).

| File                                      | Approx rows | Primary grain                 |
| ----------------------------------------- | ----------- | ----------------------------- |
| `employment_rate.parquet`                 | ~10,000     | country × year                |
| `unemployment_rate.parquet`               | ~10,000     | country × year                |
| `job_vacancy_rate.parquet`                | ~30,000     | country × sector × quarter    |
| `gender_pay_gap_sector.parquet`           | ~15,000     | country × sector × year       |
| `labour_market_flows.parquet`             | ~20,000     | country × flow type × quarter |
| `labour_market_slack.parquet`             | ~25,000     | country × status × quarter    |
| `at_risk_of_poverty_or_exclusion.parquet` | ~5,000      | country × year                |
| `median_equivalised_income.parquet`       | ~5,000      | country × year                |
| `gini_coefficient.parquet`                | ~5,000      | country × year                |
| `housing_overburden_*.parquet` (3 files)  | ~5,000 each | country × year                |
| `gdp_per_capita.parquet`                  | ~5,000      | country × year                |
| `commuting_time.parquet`                  | ~3,000      | country × year                |
| `long_term_unemployment.parquet`          | ~5,000      | country × year                |
| `gender_pay_gap_age.parquet`              | ~8,000      | country × age group × year    |

**Manifest:** `data/eu_meta/manifest.json` — pull timestamp, datasets pulled, success/failure per dataset.

### `data/reference/` — ESCO Reference Parquet

| File                                      | Content                                                             |
| ----------------------------------------- | ------------------------------------------------------------------- |
| `esco_occupations.parquet`                | ESCO v1.2.1 occupation hierarchy                                    |
| `esco_skills.parquet`                     | ESCO skills with `digital_skill_indicator`, `green_skill_indicator` |
| `esco_occupation_skill_relations.parquet` | Many-to-many occupation → skill mappings                            |
| `esco_nace_crosswalk.parquet`             | ESCO URI → NACE Rev.2 code bridge                                   |
| `esco_api_manifest.json`                  | ESCO pull timestamp and version                                     |
| `manifest.json`                           | General reference layer manifest                                    |

### `data/internal/` — Internal Company Parquet (Sample)

| File                               | Current rows  | Schema                                                                                                                                    |
| ---------------------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `payroll_snapshot.parquet`         | 6 sample rows | employee_id, job_code, country_code, worker_category_id, gender, base_pay_amount, pay_currency, snapshot_date, employment_status, version |
| `job_architecture.parquet`         | 4 sample rows | job_code, job_title, worker_category_id, job_family, job_level, nace_code, esco_uri                                                       |
| `hris_workforce_snapshot.parquet`  | 6 sample rows | employee_id, country_code, worker_category_id, gender, employment_type, hire_date, termination_date, snapshot_date, employment_status     |
| `ats_requisition_snapshot.parquet` | 3 sample rows | requisition_id, job_code, country_code, worker_category_id, open_date, snapshot_date                                                      |
| `learning_skill_snapshot.parquet`  | 8 sample rows | employee_id, skill_uri, proficiency_level, snapshot_date                                                                                  |

**Note:** All internal data is sample / synthetic. Phase 3 trust gate (`trusted_for_company_claims: true`) must be confirmed in the manifest before company-specific claims render.

### `data/workforceguard_analytics.duckdb`

The compiled DuckDB warehouse. Built by `dbt run` against the raw Parquet files.

**Size:** ~9.7 MB (source: technical assessment)
**Tables (when fully built):** 31 models from the dbt project, plus 3 seed tables

### `data/governance_events.json`

Flat JSON array of governance events. Max 50 entries. Written by `AnalyticsRepository.record_governance_event()`.

```json
[
  {
    "event_id": "evt_0001",
    "action_code": "approved",
    "action_name": "Approved",
    "target_type": "pay_transparency_review",
    "target_id": "FR::tech_senior::2026-03-31",
    "reason": null,
    "context": {},
    "created_at": "2026-05-07T10:30:00+00:00"
  }
]
```

---

## 34. GIT BRANCH HISTORY

**Repository branches:**

| Branch                               | Status                         | Notes                                        |
| ------------------------------------ | ------------------------------ | -------------------------------------------- |
| `main`                               | Active, up to date with origin | Current production HEAD after Phase 4 merge  |
| `codex-phase-4-compliance-simulator` | Merged to main 2026-05-07      | Pay-transparency simulator — 574 lines added |
| `main-initial-backup`                | Archive                        | Pre-development snapshot                     |

**Commit history (newest first):**

| Commit    | Message                                       |
| --------- | --------------------------------------------- |
| `6e27af4` | Start Phase 4 pay transparency simulator      |
| `d918e65` | Add portfolio analytics projects              |
| `b3f792d` | Add dashboard frontend application            |
| `22d51c0` | Add dashboard backend service                 |
| `d2654fb` | Add generated workforce data assets           |
| `bca07e1` | Add workforce data preparation pipelines      |
| `34205c4` | Add analytics models and source configuration |
| `7a148a4` | Document product roadmap and architecture     |
| `0a6f8e5` | Initialize repository structure               |

---

## 35. SECURITY POSTURE

**Current state (pre-GA):**

| Area                  | Current                   | Required before first paying customer                                                          |
| --------------------- | ------------------------- | ---------------------------------------------------------------------------------------------- |
| Authentication        | None                      | OIDC via customer IdP (Azure AD / Okta)                                                        |
| Authorization         | None                      | Single `analyst` role; evidence-pack export and governance writes gated                        |
| CORS                  | `allow_origins=["*"]`     | Env-driven allowlist                                                                           |
| Transport             | HTTP                      | TLS terminated at a reverse proxy (Caddy / nginx), HSTS                                        |
| Secrets               | None in use               | `.env` + secret manager when LLM keys land                                                     |
| GDPR — data residency | Developer laptop          | EU-region hosted VM (Hetzner / OVH / Scaleway / AWS eu-central-1)                              |
| GDPR — DPA            | None                      | DPA template prepared and signed at contract                                                   |
| GDPR — DSR support    | None                      | Documented procedure to export / delete a single customer's dataset                            |
| Backups               | None                      | Nightly DuckDB snapshot + governance log to S3-compatible EU bucket, 30-day retention          |
| Logging               | `print` / uvicorn default | Structured JSON logs, 30-day retention, no PII in logs                                         |
| Monitoring            | None                      | Healthcheck pings + uptime monitor + dbt freshness alert                                       |
| CI/CD                 | Tests run locally         | GitHub Actions: lint, dbt build + test, backend pytest, frontend build + axe, dependency audit |
| Dependency hygiene    | Minimal requirements.txt  | Pin all versions; run `pip-audit` and `npm audit` in CI                                        |

---

## 36. OPERATIONS — STARTUP

### Full Stack Startup

**1. Build the analytics warehouse:**
```bash
cd analytics
dbt seed
dbt run
dbt test
```

**2. Start the backend:**
```bash
cd dashboard/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python main.py
# Listening on http://127.0.0.1:8001
```

**3. Start the frontend:**
```bash
cd dashboard/frontend
npm install
npm run dev
# Listening on http://localhost:5173
```

**4. Rebuild ingestion (when refreshing Eurostat data):**
```bash
python scripts/pull_eu_data.py
python scripts/pull_esco_api_data.py
cd analytics && dbt build
```

### Health Checks

```bash
curl http://127.0.0.1:8001/health
# → {"status": "ok", "service": "WorkforceGuard Analytics API", "generated_at": "..."}

curl "http://127.0.0.1:8001/api/overview?geography=EU27_AVG&sector=ALL&period=latest"
# → Full overview JSON
```

---

## 37. COMPLETE FILE SUMMARY

| Component          | Language    | Key Files                                                  | Lines (approx) |
| ------------------ | ----------- | ---------------------------------------------------------- | -------------- |
| Ingestion scripts  | Python      | `pull_eu_data.py`, `pull_esco_api_data.py`, `prepare_*.py` | ~1,200         |
| dbt project config | YAML        | `dbt_project.yml`, `profiles.yml`, `eu_sources.yaml`       | ~120           |
| dbt macros         | SQL (Jinja) | 4 macro files                                              | ~40            |
| dbt staging models | SQL         | 11 files (6 Eurostat + 5 internal)                         | ~300           |
| dbt mart models    | SQL         | 15 files (5 core + 7 internal + 3 reference)               | ~800           |
| dbt seed CSVs      | CSV         | 3 files                                                    | ~30 rows       |
| FastAPI app        | Python      | `main.py`                                                  | 184            |
| Service layer      | Python      | `service.py`                                               | 4,458          |
| Backend tests      | Python      | `test_service.py`                                          | 722            |
| React app shell    | JSX         | `App.jsx`                                                  | 12             |
| React UI           | JSX         | `Overview.jsx`                                             | 2,187          |
| CSS design system  | CSS         | `App.css`, `index.css`                                     | ~400           |
| Documentation      | Markdown    | `docs/` (14 files)                                         | ~4,000         |

---

## 38. DOCUMENTATION INDEX

All documentation lives in `docs/`. Key files:

| File                                         | Purpose                                              |
| -------------------------------------------- | ---------------------------------------------------- |
| `solution-architecture.md`                   | Plain-English product architecture and data strategy |
| `prd-roadmap.md`                             | Phase-by-phase product roadmap index                 |
| `prd-phase-1-foundation.md`                  | Phase 1 PRD (complete)                               |
| `prd-phase-2-comparative-intelligence.md`    | Phase 2 PRD (complete)                               |
| `prd-phase-3-company-decision-support.md`    | Phase 3 PRD (first slice implemented)                |
| `prd-phase-4-compliance-governance-suite.md` | Phase 4 PRD (started)                                |
| `prd-phase-5-ai-copilot-workflows.md`        | Phase 5 PRD (complete)                               |
| `01-technical-design.md`                     | v1.0 engineering contract — 6-week build plan        |
| `02-launch-readiness.md`                     | v1.0 go/no-go decisions and launch scope             |
| `03-architecture-overview.md`                | Component-level architecture for new engineers       |
| `04-product-brief.md`                        | Stakeholder-facing product brief                     |
| `technical-assessment.md`                    | Pre-GA production-readiness review with gap analysis |
| `WORKFORCEGUARD_MASTER_REFERENCE_PART1.md`   | This document series — Part 1                        |
| `WORKFORCEGUARD_MASTER_REFERENCE_PART2.md`   | This document series — Part 2                        |
| `WORKFORCEGUARD_MASTER_REFERENCE_PART3.md`   | This document series — Part 3                        |
| `WORKFORCEGUARD_MASTER_REFERENCE_PART4.md`   | This document series — Part 4                        |

---

## 39. KNOWN ISSUES AND TECHNICAL DEBT

| Issue                                      | Severity | Detail                                                                                                                                                                     |
| ------------------------------------------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `service.py` is a 4,458-line monolith      | Critical | All repository I/O, metric computation, comparison logic, narrative generation, evidence packaging, and governance in one module. Single biggest velocity risk for Phase 4 |
| `Overview.jsx` is 2,187 lines              | High     | No router, no design system, no state management boundary, no UI tests. Mixed class and function components                                                                |
| No data provenance on staging models       | High     | Cannot trace a dashboard number back to a Eurostat dataset code and pull timestamp                                                                                         |
| No authentication or authorization         | High     | `allow_origins=["*"]`, no OIDC, no role-based access — production blocker                                                                                                  |
| No CI/CD pipeline                          | High     | Tests run locally only; no GitHub Actions                                                                                                                                  |
| No backup or restore strategy              | High     | No DuckDB snapshots, no restore drill                                                                                                                                      |
| Governance event store is a JSON file      | Medium   | 50-event hard cap, no hash chain, not tamper-evident. v1.0 target is SQLite with hash-chained append-only schema                                                           |
| Evidence pack has no hash signing          | Medium   | No ed25519 signature, no PDF rendering. Current output is raw JSON                                                                                                         |
| No AI layer                                | Medium   | Analyst responses are 100% templated string composition over SQL. Correct for a compliance product, but must be named honestly                                             |
| `Intl.NumberFormat('en-US')` in EU product | Medium   | Number formatting should default to user locale or `'de-DE'` for compliance evidence packs                                                                                 |
| Internal data is 6 sample rows             | Medium   | Phase 3 company-aware features are gated; real customer data required for full activation                                                                                  |
| No freshness signals                       | Medium   | No `/api/freshness` endpoint; no UI indicator showing when Eurostat data was last pulled                                                                                   |
| `axios` unconfigured                       | Low      | No base URL interceptor, no error normaliser, no request ID propagation                                                                                                    |
| NUTS 2 geography blocked                   | Low      | Active marts expose country-level only; NUTS 2 expansion requires wider signal coverage                                                                                    |
| `event_id` is not globally unique          | Low      | `evt_{n:04d}` resets on process restart; replace with UUID for audit-grade event IDs                                                                                       |

---

## 40. DEVELOPMENT RULES AND HARD CONSTRAINTS

### Data and Analytics Layer
- dbt staging models must not join across sources — one Parquet per staging model
- Mart primary keys must follow the `::` concatenation pattern (`geo_id::sector_id::metric_id`)
- All new mart primary keys must carry `unique` and `not_null` dbt tests
- The metric registry CSV is the single source of truth for approved metric formulas — no formula logic in the API
- Governance thresholds belong in mart SQL (not in `service.py` constants) — the mart output is the evidence record

### Backend
- `AnalyticsRepository` must remain the only class that touches DuckDB or file system I/O
- Public methods in `AnalyticsRepository` must not raise exceptions — they return structured `Dict` responses; the `guarded()` wrapper in `main.py` handles HTTP error mapping
- Never hardcode `governance_events.json` path in tests — use `AnalyticsRepository(root_dir, governance_events_path=...)` override
- Governance action validation (`requires_reason`) must match the seed CSV — not hardcoded
- Internal data gating: company-specific claims must not render unless `internal_data["available"] == True`

### Frontend
- `API_BASE` must use `import.meta.env.VITE_API_BASE_URL ?? '/api'` — never hardcode a port
- All metric rendering must go through `formatMetricValue()` — never inline `toFixed()` on raw values
- `ToneChip` must be the only mechanism for tone display — never inline colour classes
- Governance button clicks must POST to `/api/governance-events` before updating local state — never optimistic update on governance actions

### Git
- Commit format: imperative mood, sentence case — e.g. `"Add Phase 4 pay transparency mart"`
- Feature branches merge to `main` via fast-forward when possible
- Never commit `data/internal/*.parquet` or `data/workforceguard_analytics.duckdb` — both are gitignored
- Never commit `.env` or any file containing `VITE_API_PROXY_TARGET` pointing to a non-localhost address

---

*End of WorkforceGuard AI Master Reference Document (4 parts)*

*Generated: 2026-05-07*
*Based on: complete codebase analysis — analytics dbt project (31 models), FastAPI backend (4,458 lines), React frontend (2,187 lines), ingestion scripts, documentation, and data assets*
*Branch state: `main` (includes Phase 4 pay-transparency simulator merge)*


# WorkforceGuard AI — Master Reference Index

This document series is the complete technical reference for the WorkforceGuard AI platform.
It covers every file, every component, every API endpoint, and every data model in the repository.

---

## Document Map

| Part                                                 | Title                                                     | Key Sections                                                                                                     |
| ---------------------------------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| [Part 1](./WORKFORCEGUARD_MASTER_REFERENCE_PART1.md) | Business Overview, Architecture & Data Strategy           | Product capabilities, system topology, data sources, metric registry, governance design, roadmap, known blockers |
| [Part 2](./WORKFORCEGUARD_MASTER_REFERENCE_PART2.md) | Analytics Layer — dbt Project, Staging, Marts, Macros     | ~31 dbt models (run `dbt ls` on deploy), macros, staging schemas, mart schemas, seed CSVs, ingestion scripts     |
| [Part 3](./WORKFORCEGUARD_MASTER_REFERENCE_PART3.md) | Backend API — FastAPI Service, Repository, Endpoints      | All 9 API endpoints, AnalyticsRepository methods, response contracts, test suite                                 |
| [Part 4](./WORKFORCEGUARD_MASTER_REFERENCE_PART4.md) | Frontend, Data Assets, Operations, Security & Gap Summary | Overview.jsx component map, CSS design system, data files, git history, security posture, startup, known issues  |

---

## Quick Reference

### Ports
- Backend: `http://127.0.0.1:8001`
- Frontend (dev): `http://localhost:5173`

### API Endpoints
- `GET /api/overview` — full command-centre payload
- `POST /api/ask` — analyst console question
- `GET /api/evidence-pack` — exportable compliance pack
- `POST /api/governance-events` — record governance action
- `GET /api/governance-events` — list recent events

### Key Files
- `dashboard/backend/service.py` — `AnalyticsRepository` (4,458 lines, all business logic)
- `dashboard/frontend/src/components/Overview.jsx` — entire product UI (2,187 lines)
- `analytics/models/marts/core/mart_semantic_metrics.sql` — four approved business metrics
- `analytics/models/marts/internal/mart_pay_transparency_category_review.sql` — Phase 4 compliance simulation
- `analytics/seeds/reference/ref_metric_registry.csv` — canonical metric definitions
- `configs/eu_sources.yaml` — 16 Eurostat dataset registry

### Phase Status
- Phase 1 (EU market intelligence): Complete
- Phase 2 (Comparative benchmarking): Complete
- Phase 3 (Company-aware decision support): First slice implemented
- Phase 4 (Compliance and governance suite): Started — pay-transparency simulation live
- Phase 5 (AI copilot and workflow automation): Complete

*Generated: 2026-05-07*
