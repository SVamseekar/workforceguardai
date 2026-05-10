# WorkforceGuard AI — Master Reference Document
## Part 1 of 4: Business Overview, Architecture & Data Strategy

---

## 1. BUSINESS OVERVIEW

### What is WorkforceGuard AI?

WorkforceGuard AI is a European workforce intelligence and compliance platform for HR, strategy, and compensation teams. It helps employers understand labour-market conditions across Europe, benchmark their internal workforce against public data, and prepare for regulatory obligations — in particular the EU Pay Transparency Directive (2023/970), which requires employers with 100+ workers to publish pay gaps by worker category and justify any unadjusted gap above 5%.

The product runs as a single-tenant deployment (one instance per customer) against a DuckDB file on a local or EU-hosted VM. There is no multi-tenancy in the current build.

### Primary Users

| Role | Primary Use |
|------|-------------|
| HR Directors | Labour-market intelligence, workforce strategy |
| People Analytics teams | Comparative benchmarking, metric evidence |
| Compensation and Benefits teams | Pay-gap analysis, pay-transparency simulation |
| Workforce Planning teams | Regional comparisons, transition readiness |
| Compliance / Legal teams | Evidence packs, governance audit trail |
| Works council / employee representatives | Review of pay-transparency findings |

### Product Capabilities by Phase

| Phase | Capability | Status |
|-------|-----------|--------|
| Phase 1 | EU market intelligence — Eurostat-backed labour metrics, evidence packs | Complete |
| Phase 2 | Comparative intelligence — EU, peer-country, sector, prior-period benchmarks | Complete |
| Phase 3 | Company-aware decision support — internal pay and workforce benchmarking | Implemented (first slice) |
| Phase 4 | Compliance and governance suite — pay-transparency simulation, governance console | Started |
| Phase 5 | AI copilot and workflow automation | Complete |

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
                     │  staging → marts (28 models)          │
                     └──────────────────┬───────────────────┘
                                        │ read-only
                                        ▼
                     ┌──────────────────────────────────────┐
                     │  FastAPI (dashboard/backend/)         │
                     │  main.py  +  service.py              │
                     │  AnalyticsRepository (4,458 lines)   │
                     │  9 HTTP endpoints                     │
                     │  governance events (JSON file)        │
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

| Layer | Technology |
|-------|-----------|
| Ingestion | Python 3.12, pandas, pyarrow, requests, pyyaml |
| Warehouse | DuckDB (single file, read-only access from API) |
| Transformation | dbt (28 models — staging views, mart tables) |
| API | FastAPI + uvicorn, Python 3.12 |
| Frontend | React 19, Vite 7, Recharts 3, Axios, Lucide React, Tailwind |
| Data format | Parquet (eu_raw, internal, reference) |
| Governance store | JSON file (governance_events.json, max 50 events) |

### Runtime Ports

| Service | Default | Override |
|---------|---------|---------|
| FastAPI backend | `http://127.0.0.1:8001` | `WORKFORCEGUARD_HOST`, `WORKFORCEGUARD_PORT` |
| React frontend (dev) | `http://localhost:5173` | Vite default |
| Vite proxy to API | `/api/*` → `http://127.0.0.1:8001` | `vite.config.js` |

---

## 3. DATA STRATEGY

### 3.1 External European Data Layer

All EU data is public, official, and free. The ingestion pipeline (`scripts/pull_eu_data.py`) pulls from the Eurostat JSON-stat API and writes versioned Parquet files to `data/eu_raw/`.

**16 configured datasets (`configs/eu_sources.yaml`):**

| Dataset Name | Eurostat Code | Primary Signal |
|-------------|--------------|---------------|
| `job_vacancy_rate` | `jvs_q_nace2` | Quarterly vacancy rate by NACE sector |
| `unemployment_rate` | `une_rt_a` | Annual unemployment rate |
| `long_term_unemployment` | `une_ltu_a` | Long-term unemployment share |
| `employment_rate` | `lfsi_emp_a` | Employment rate, age 20–64 |
| `labour_market_flows` | `lfsi_long_q` | Employment/unemployment/inactivity transitions |
| `labour_market_slack` | `lfsi_sla_q` | Labour market slack and underemployment |
| `gender_pay_gap_sector` | `earn_gr_gpgr2` | Gender pay gap by NACE sector |
| `gender_pay_gap_age` | `earn_gr_gpgr2ag` | Gender pay gap by age group |
| `at_risk_of_poverty_or_exclusion` | `ilc_peps01n` | Poverty and social exclusion rate |
| `median_equivalised_income` | `ilc_di03` | Median household income |
| `gini_coefficient` | `ilc_di12` | Income inequality (Gini) |
| `housing_overburden_total` | `TESSI162` | Housing cost overburden |
| `housing_overburden_by_tenure` | `TESSI164` | Housing burden by tenure type |
| `housing_overburden_by_income` | `TESSI166` | Housing burden by income quintile |
| `gdp_per_capita` | `nama_10_pc` | GDP per capita |
| `commuting_time` | `lfso_19plwk28` | Average commuting time |

**Geographic coverage:** All 27 EU member states (AT, BE, BG, HR, CY, CZ, DK, EE, FI, FR, DE, EL, HU, IE, IT, LV, LT, LU, MT, NL, PL, PT, RO, SK, SI, ES, SE) plus EU27 aggregate proxies.

**Time range configured:** 2019–2025 (annual and quarterly depending on dataset).

### 3.2 Reference Data Layer

ESCO (European Skills, Competences, Qualifications and Occupations taxonomy) provides the occupational and skills backbone.

**Files in `data/reference/`:**

| File | Content |
|------|---------|
| `esco_occupations.parquet` | ESCO occupation hierarchy v1.2.1 |
| `esco_skills.parquet` | ESCO skills with `digital_skill_indicator`, `green_skill_indicator` |
| `esco_occupation_skill_relations.parquet` | Occupation → skill mappings |
| `esco_nace_crosswalk.parquet` | ESCO URI → NACE Rev.2 code bridge |
| `manifest.json` | ESCO pull manifest (version, pulled_at) |

Script: `scripts/pull_esco_api_data.py` — pulls from the ESCO REST API.

### 3.3 Internal Company Data Layer

Internal data lives in `data/internal/`. It is never pushed to external systems. Company-specific claims in the API are disabled unless the internal data manifest marks the payroll and job-architecture assets as `trusted_for_company_claims: true`.

**Five internal data schemas:**

| File | Content | Required Fields |
|------|---------|----------------|
| `payroll_snapshot.parquet` | Employee pay facts | `employee_id`, `job_code`, `country_code`, `worker_category_id`, `gender`, `base_pay_amount`, `snapshot_date` |
| `job_architecture.parquet` | Role-to-category mapping | `job_code`, `job_title`, `worker_category_id`, `job_family`, `job_level`, `nace_code`, `esco_uri` |
| `hris_workforce_snapshot.parquet` | Workforce headcount and composition | `employee_id`, `country_code`, `worker_category_id`, `gender`, `employment_type`, `hire_date`, `snapshot_date` |
| `ats_requisition_snapshot.parquet` | Open hiring demand | `requisition_id`, `job_code`, `country_code`, `worker_category_id`, `open_date`, `snapshot_date` |
| `learning_skill_snapshot.parquet` | Employee skills coverage | `employee_id`, `skill_uri`, `proficiency_level`, `snapshot_date` |

**Trust gate:** `data/internal_meta/manifest.json` — must have `trusted_for_company_claims: true` for payroll and job-architecture assets before company-specific claims are activated.

### 3.4 Data Sources Registry (Seed)

`analytics/seeds/reference/ref_data_sources.csv` — the canonical source catalogue loaded into `dim_data_sources` mart:

| source_id | source_family | Version |
|-----------|--------------|---------|
| eurostat_lfs | eurostat | 2026-Q1 |
| eurostat_jvs | eurostat | 2026-Q1 |
| esco_taxonomy | esco | 1.2.1 |
| esco_nace_crosswalk | esco | 2026-rev2.1 |
| cedefop_skills | cedefop | 2026 |
| eurofound_conditions | eurofound | 2026 |
| internal_payroll_snapshot | internal | local |
| internal_job_architecture | internal | local |
| internal_hris_workforce_snapshot | internal | local |
| internal_ats_requisition_snapshot | internal | local |
| internal_learning_skill_snapshot | internal | local |

---

## 4. CANONICAL BUSINESS ENTITIES

These are the core concepts modeled across the semantic and mart layers.

| Entity | Definition |
|--------|-----------|
| `region` | Europe, country, NUTS 2 as default (NUTS 3 when supported) |
| `sector` | NACE-based economic activity code |
| `occupation` | ESCO occupation URI |
| `skill` | ESCO skill or knowledge concept URI |
| `worker_category` | Employer-defined category of workers / work of equal value |
| `time_period` | Year (`YYYY`) or quarter (`YYYY-QN`) depending on source |
| `metric_definition` | Versioned, approved business formula for a signal |
| `recommendation_event` | A generated recommendation and its evidence bundle |
| `governance_event` | Review, override, approval, reversal, or export action |

---

## 5. METRIC REGISTRY

The metric registry (`analytics/seeds/reference/ref_metric_registry.csv`) is the single source of truth for all approved business metrics. The LLM / analyst layer must not invent formulas.

**Four registered metrics (all implemented in `mart_semantic_metrics`):**

| metric_id | Group | Formula Version | Human Review | Status |
|-----------|-------|----------------|--------------|--------|
| `hiring_pressure_index` | market_intelligence | 1.2 | Yes | proxy_live |
| `labour_resilience` | market_intelligence | 1.1 | No | live |
| `equity_risk_score` | compliance | 1.0 | Yes | proxy_live |
| `transition_readiness` | skills_intelligence | 0.2 | Yes | proxy_live |

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

| action_code | action_name | requires_reason |
|-------------|-------------|----------------|
| `review_required` | Human review required | No |
| `approved` | Approved | No |
| `overridden` | Overridden | **Yes** |
| `reversed` | Reversed | **Yes** |
| `exported` | Evidence pack exported | No |

### 6.2 Governance Event Storage

Events are persisted to `data/governance_events.json`. Current implementation:
- Append to front, newest first
- Hard cap at 50 events (older events discarded)
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

| review_state | Trigger | Priority |
|-------------|---------|---------|
| `justified_difference` | `abs(internal_gap) < 5%` | low |
| `observed_gap` | `5% ≤ abs(internal_gap) < 10%` | medium |
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

| Gap | Severity | Detail |
|----|---------|--------|
| No data provenance columns on staging models | High | Cannot trace a dashboard number back to a Eurostat dataset code and pull timestamp |
| `service.py` is a 4,458-line monolith | High | All repository I/O, metric composition, narrative generation, evidence packaging, and governance in one module |
| No AI layer | Medium | Analyst responses are templated string composition over SQL — acceptable for compliance but must be explicitly named |
| `Overview.jsx` is 2,187 lines, single component | High | No router, no design system, no state management boundary, no UI tests |
| No authentication | High | CORS wildcard (`allow_origins=["*"]`), no OIDC, no role-based access |
| No CI/CD | Medium | Tests run locally; no GitHub Actions pipeline |
| No backup strategy | Medium | No scheduled DuckDB snapshots, no restore drill |
| GDPR residency | High | No documented EU-region deployment or DPA template |
| Internal data is 6 sample payroll rows | Medium | Phase 3 trust gate limits company-specific claims until real data connected |

**Six-week remediation plan** (from `docs/01-technical-design.md`):
1. **Week 1** — Data integrity: provenance columns on all staging models, reconciliation tests
2. **Week 2** — Backend split: `api/`, `domain/`, `repository/`, `policy/`; SQLite governance; structured logging
3. **Week 3** — Evidence packs: hash-signed JSON + PDF rendering (WeasyPrint)
4. **Week 4** — Frontend part 1: TypeScript, component split, TanStack Query, axe CI
5. **Week 5** — Frontend part 2: EURES + EIGE ingestion, four-page structure
6. **Week 6** — Production posture: TLS, OIDC, EU-region deploy, backups, runbooks

---

*Continued in Part 2: Analytics Layer — dbt Models, Staging, Marts, Macros*
