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

| CTE | Purpose |
|-----|---------|
| `latest_signal_periods` | Max period per signal — ensures latest-only semantics |
| `country_signals` | Pivots country-level signals (employment, unemployment, slack, flows) |
| `sector_pairs` | Builds all (geo, sector) combinations including ALL |
| `sector_signals` | Pivots sector-level signals (vacancy, gender pay gap) |
| `skill_flags` | Per-occupation digital/green skill flags from ESCO + skill relations |
| `sector_skill_context` | Aggregates digital/green coverage % per NACE sector |
| `raw_scores` | Applies formula weights to raw signals |
| `clamped_scores` | `LEAST(100, GREATEST(0, ROUND(raw)))` on all four metrics |
| `final_scores` | Computes transition_readiness from the other three |
| `unioned` | UNION ALL of four metric rows per (geo, sector) pair |

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

| Script | Purpose |
|--------|---------|
| `pull_eu_data.py` | Pulls 16 Eurostat datasets via JSON-stat API, writes Parquet to `data/eu_raw/` |
| `pull_esco_api_data.py` | Pulls ESCO occupation hierarchy and skills, writes to `data/reference/` |
| `prepare_reference_data.py` | Prepares ESCO-NACE crosswalk for the reference layer |
| `prepare_internal_company_data.py` | Generates sample internal data (payroll, HRIS, ATS, job arch, learning) |
| `prepare_france_public_company_data.py` | Prepares France public-company reference data |
| `generate_eu_calibrated_data.py` | Generates calibrated EU-context sample data |
| `build_phase1_workspace.py` | Orchestrates full clean rebuild (pull → prep → dbt build) |

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
