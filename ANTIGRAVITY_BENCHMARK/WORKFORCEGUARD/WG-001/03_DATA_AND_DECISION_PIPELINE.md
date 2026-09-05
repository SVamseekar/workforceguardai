# 03. Data and Decision Pipeline: WorkforceGuard AI

> **Benchmark Track:** WG-001
> **Status:** COMPLETE
> **Evidence Standard:** PROVEN / EMPIRICALLY VERIFIED
> **Target System:** [WorkforceGuard-AI](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI)

---

## 1. Public Data Ingestion: Eurostat REST API

The public ingestion engine is defined in [`scripts/pull_eu_data.py`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/scripts/pull_eu_data.py) and configured via [`configs/eu_sources.yaml`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/configs/eu_sources.yaml).

### Ingested Data Assets
1. `jvs_q_nace2` — Job vacancy rate (quarterly, percentage, by NACE Rev. 2).
2. `une_rt_a` — Unemployment rate (annual).
3. `une_ltu_a` — Long-term unemployment rate.
4. `lfsi_emp_a` — Employment rate (annual, age 20–64, total population).
5. `lfsi_long_q` — Labour market flows (quarterly transitions).
6. `lfsi_sla_q` — Labour market slack (quarterly unmet employment demand).
7. `earn_gr_gpgr2` — Gender pay gap in unadjusted form by NACE Rev. 2 activity (annual).
8. `earn_gr_gpgr2ag` — Gender pay gap by age group.
9. `ilc_peps01n` — People at risk of poverty or social exclusion.
10. `ilc_di03` — Median equivalised net income.
11. `ilc_di12` — Gini coefficient of equivalised disposable income.
12. `nama_10_pc` — Real GDP per capita.

### Ingestion Logic: Dimension Discovery & Unravelling
Eurostat serves data formatted as JSON-stat v1.0. Because the payload contains flat values mapped across an n-dimensional Cartesian coordinate system, [`scripts/pull_eu_data.py:L87-L131`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/scripts/pull_eu_data.py#L87-L131) unrolls the matrix using NumPy:

```python
def jsonstat_to_frame(js: dict) -> pd.DataFrame:
    dims = js.get("id", [])
    sizes = js.get("size", [])
    # ... category index maps constructed ...
    values = js.get("value", {})
    if isinstance(values, dict):
        indices = np.array(list(map(int, values.keys())), dtype=int)
        val = np.array(list(values.values()))
    else:
        val_arr = np.array(values)
        mask = ~pd.isna(val_arr)
        indices = np.arange(len(val_arr))[mask]
        val = val_arr[mask]

    multi_idx = np.array(np.unravel_index(indices, sizes)).T

    data = {}
    for i, dim in enumerate(dims):
        codes = [code_by_index[dim][idx] for idx in multi_idx[:, i]]
        data[dim] = codes
        labels = label_maps.get(dim, {})
        if labels:
            data[f"{dim}_label"] = [labels.get(code, "") for code in codes]

    df = pd.DataFrame(data)
    df["value"] = val
    return df
```

### Persistence and Manifest
- **Storage Target**: Snappy-compressed Parquet files in `data/eu_raw/{name}.parquet`.
- **Metadata**: JSON manifests recorded in `data/eu_meta/{name}.json` and a global registry in `data/eu_meta/manifest.json` capturing row counts, timestamps, query URLs, and dimension categorizations.

---

## 2. Reference & Public Company Data Pipelines

### ESCO v1.2 Reference Data Ingestion
[`scripts/prepare_reference_data.py`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/scripts/prepare_reference_data.py) converts downloaded official European Commission taxonomy assets into analytics Parquet files:
1. `esco_occupations.parquet`: Standardized ISCO-08 occupational hierarchy.
2. `esco_skills.parquet`: 13,000+ skills tagged with digital skill and green skill flags.
3. `esco_occupation_skill_relations.parquet`: Graph relations linking occupations to essential vs. optional skills.
4. `esco_nace_crosswalk.parquet`: Crosswalk matrix mapping ESCO occupations to NACE Rev. 2 industry divisions.

### French Égapro Corporate Index
[`scripts/ingest_egapro.py`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/scripts/ingest_egapro.py) parses annual statutory submissions under France's *Index de l'égalité professionnelle*:
- Cleans corporate SIREN identifiers and company names.
- Maps 5-digit NAF codes (e.g. `62.02A`) to broad NACE Rev. 2 section letters (`A` through `S`).
- Standardizes company employee brackets into three mandatory bands: `50-250`, `251-999`, and `1000+`.
- Writes output to `data/public_company/egapro_index.parquet`.

---

## 3. Internal Employer Payroll Ingestion Pipeline

Internal employer data enters the system through two paths:
1. **Developer / CLI Seeding**: [`scripts/prepare_internal_company_data.py`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/scripts/prepare_internal_company_data.py) or [`scripts/seed_demo_tenant.py`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/scripts/seed_demo_tenant.py).
2. **Web Application Upload**: `POST /api/upload/payroll` handled by [`AnalyticsRepository.ingest_uploaded_payroll()`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/dashboard/backend/service.py#L4057).

### Mandatory Schema Contract
The upload validator strictly enforces the presence of 8 lowercase column headers:
```python
REQUIRED_COLUMNS = {
    "employee_id",
    "job_code",
    "country_code",
    "worker_category_id",
    "gender",
    "base_salary",
    "currency",
    "snapshot_date",
}
```

### Data Validation & Cleaning Invariants
- **Volume**: Must contain at least 10 employee rows (`len(df) >= 10`).
- **Gender Categorization**: Permitted values are `female`, `male`, and `non_binary`.
- **Compensation**: `base_salary` must be numeric and strictly positive (`> 0`).
- **Date Horizon**: `snapshot_date` must parse as an ISO date and cannot be in the future.
- **Geography**: `country_code` must be an exact 2-letter ISO country string.
- **Column Normalization**: Renames `base_salary -> base_pay_amount`, adds defaults `employment_status = 'active'`, `version = 'uploaded-v1'`.
- **Job Architecture Consistency Check**: If `data/tenants/{tenant_id}/internal/job_architecture.parquet` exists, identifies unmapped `job_code` values and appends non-blocking warnings to the upload response.
- **Persistence**: Writes `data/tenants/{tenant_id}/internal/payroll_snapshot.parquet` and updates `internal_meta/manifest.json` setting `trusted_for_company_claims = true`.

---

## 4. The dbt Transformation Graph

```
[Parquet Files on Disk]
       │
       ▼
[Staging Layer (Views)]
  ├── stg_eurostat__*
  ├── stg_internal__payroll_snapshot
  ├── stg_internal__job_architecture
  └── stg_public_company__*
       │
       ├──────────────────────────────────────────────┐
       ▼                                              ▼
[Core Layer (Shared Tables)]               [Internal Layer (Tenant Tables)]
  ├── dim_geography                          ├── dim_worker_category
  ├── dim_sector                             ├── fct_internal_pay_snapshot
  ├── fct_labour_market_region_sector        └── mart_internal_market_pay_benchmark
  ├── mart_workforce_command_center
  └── mart_semantic_metrics
```

### Macro Infrastructure
1. [`analytics/macros/tenant_schema.sql`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/analytics/macros/tenant_schema.sql):
   Overrides dbt's default `generate_schema_name` macro. If a model has tag `internal` and variable `tenant_schema` is supplied, it redirects the table destination to that exact schema:
   ```jinja
   {% macro generate_schema_name(custom_schema_name, node) -%}
       {%- if node.tags is defined and 'internal' in node.tags and var('tenant_schema', none) is not none -%}
           {{ var('tenant_schema') }}
       {%- else -%}
           {{ target.schema }}
       {%- endif -%}
   {%- endmacro %}
   ```
2. [`analytics/macros/provenance.sql`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/analytics/macros/provenance.sql):
   Injects the official extraction timestamp from `data/eu_meta/manifest.json` into modeled rows:
   ```jinja
   {% macro get_pull_timestamp(dataset_name) -%}
   (
       select datasets."{{ dataset_name }}".pulled_at
       from read_json_auto('{{ var("eu_meta_path") }}/manifest.json')
   )
   {%- endmacro %}
   ```

### Materialization Graph & Invariants
- In [`analytics/dbt_project.yml:L34-L46`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/analytics/dbt_project.yml#L34-L46):
  ```yaml
  models:
    workforceguard_analytics:
      staging:
        +materialized: view
        internal:
          +tags: ["internal"]
          +enabled: "{{ var('tenant_schema', none) is not none }}"
      marts:
        +materialized: table
        internal:
          +tags: ["internal"]
          +enabled: "{{ var('tenant_schema', none) is not none }}"
  ```
  Internal models are explicitly disabled unless `tenant_schema` is supplied, preventing internal tables from ever building into the shared `main` schema during standard dbt invocations.

---

## 5. DuckDB Engine & Concurrency Model

### Storage Architecture
- A single on-disk file: `data/workforceguard_analytics.duckdb`.
- Contains:
  - `main` schema: Shared Eurostat facts, dimensions, public company benchmarks, semantic scores.
  - `tenant_<uuid>` schemas: Isolated tenant payroll snapshots and company-to-market pay gap marts.

### Concurrency & Write Lock Contention
DuckDB operates as an embedded single-writer database:
1. **The Lock Contention Window**: When an admin uploads payroll or job architecture data, `main.py` fires an asynchronous dbt run via `subprocess.Popen`.
2. **Exclusive Writer Lock**: While dbt compiles and writes to `workforceguard_analytics.duckdb`, it holds an exclusive OS file lock.
3. **Backend Retry Strategy** ([`service.py:L520-L536`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/dashboard/backend/service.py#L520-L536)):
   ```python
   def _connect_with_lock_retry(self) -> duckdb.DuckDBPyConnection:
       attempts = 10
       delay_seconds = 0.3
       for attempt in range(attempts):
           try:
               return duckdb.connect(database=str(self.analytics_db_path), read_only=True)
           except duckdb.IOException as error:
               if "Could not set lock on file" not in str(error) or attempt == attempts - 1:
                   raise
               time.sleep(delay_seconds)
   ```
   The backend retries read connections 10 times across 3.0 seconds. If the dbt run exceeds 3.0 seconds, concurrent API readers encounter an uncaught `duckdb.IOException` and fail with HTTP 500.

---

## 6. Metric Calculations & Mathematical Formulations

### 1. Unadjusted Gender Pay Gap (GPG)
Defined in [`analytics/models/marts/internal/fct_internal_pay_snapshot.sql:L66-L70`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/analytics/models/marts/internal/fct_internal_pay_snapshot.sql#L66-L70):
$$\text{GPG} = \frac{\bar{w}_{\text{male}} - \bar{w}_{\text{female}}}{\bar{w}_{\text{male}}} \times 100$$
Where $\bar{w}$ represents the arithmetic mean of `base_pay_amount` for active, full-time equivalent employees within a worker category.
*Note: In `fct_internal_pay_snapshot.sql:L5`, the filter `gender in ('female', 'male')` excludes `non_binary` records from the arithmetic mean.*

### 2. Gap to Market
Defined in [`analytics/models/marts/internal/mart_internal_market_pay_benchmark.sql:L71`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/analytics/models/marts/internal/mart_internal_market_pay_benchmark.sql#L71):
$$\Delta_{\text{market}} = \text{GPG}_{\text{internal}} - \text{GPG}_{\text{market}}$$
Where $\text{GPG}_{\text{market}}$ is the latest Eurostat unadjusted GPG for the corresponding country and NACE sector (prioritizing broad aggregate sector `B-S` over `A-S`).

### 3. Composite Semantic Metrics
Defined in [`analytics/models/marts/core/mart_semantic_metrics.sql:L157-L220`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/analytics/models/marts/core/mart_semantic_metrics.sql#L157-L220):

1. **Hiring Pressure Index** ($[0, 100]$):
   $$\text{HP}_{\text{raw}} = 11 \cdot V + 4 \cdot \max(0, 9 - U) + 2.8 \cdot \max(0, 12 - S) + 0.9 \cdot F_E + 0.6 \cdot F_I$$
   $$\text{Hiring Pressure} = \min(100, \max(0, \text{round}(\text{HP}_{\text{raw}})))$$
   *(Variables: Vacancy Rate $V$, Unemployment Rate $U$, Slack Rate $S$, Flow to Employment $F_E$, Flow to Inactivity $F_I$)*

2. **Labour Resilience** ($[0, 100]$):
   $$\text{LR}_{\text{raw}} = 0.95 \cdot E - 3.8 \cdot U + 0.3 \cdot C$$
   $$\text{Labour Resilience} = \min(100, \max(0, \text{round}(\text{LR}_{\text{raw}})))$$
   *(Variables: Employment Rate $E$, Unemployment Rate $U$, Employment Continuity $C$)*

3. **Equity Risk Score** ($[0, 100]$):
   $$\text{Equity Risk} = \min(100, \max(0, \text{round}(5.5 \cdot \text{GPG})))$$

4. **Transition Readiness** ($[0, 100]$):
   $$\text{TR}_{\text{raw}} = 0.45 \cdot \text{LR} + 0.25 \cdot \max(0, 100 - \text{HP}) + 0.30 \cdot \min(100, 4 \cdot (D + G))$$
   $$\text{Transition Readiness} = \min(100, \max(0, \text{round}(\text{TR}_{\text{raw}})))$$
   *(Variables: Labour Resilience $\text{LR}$, Hiring Pressure $\text{HP}$, ESCO Digital Skill Coverage $D$, ESCO Green Skill Coverage $G$)*

### 4. EU Pay Transparency Directive Article 9 Threshold Logic
Implemented in [`service.py:L1441-L1473`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/dashboard/backend/service.py#L1441-L1473):
For each worker category:
```python
if abs(internal_gap) >= 10.0 or abs(market_delta) >= 2.0:
    review_state = "unresolved_review_item"
    priority = "high" if abs(internal_gap) >= 10.0 else "medium"
elif abs(internal_gap) >= 5.0:
    review_state = "observed_gap"
    priority = "medium"
else:
    review_state = "justified_difference"
    priority = "low"
```
Under Article 9 of Directive 2023/970, an unadjusted gender pay gap exceeding 5% in any category of workers that cannot be justified by objective, gender-neutral criteria mandates a joint pay assessment with worker representatives.

---

## 7. Benchmark Selection & Nearest-Neighbor Engine

WorkforceGuard implements five comparative benchmarks ([`service.py:L87-L108`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/dashboard/backend/service.py#L87-L108)):
1. `eu` — EU27 population-weighted proxy average.
2. `prior_period` — Same country/sector in the previous statistical period.
3. `market` — Direct country-to-country comparison for the identical sector and period.
4. `sector` — Direct sector-to-sector comparison within the identical country and period.
5. `peer` — Algorithmic nearest-neighbor country basket.

### The Peer Basket Nearest-Neighbor Algorithm
Defined in [`service.py:L1882-L1965`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/dashboard/backend/service.py#L1882-L1965):
1. **Scope Check**: Target geography must be a specific 2-letter country code (not `EU27_AVG`).
2. **Standardization**: For each comparable macroeconomic signal $m$ across all EU27 countries in the latest period, computes the sample mean $\mu_m$ and standard deviation $\sigma_m$:
   $$Z_{c, m} = \frac{x_{c, m} - \mu_m}{\sigma_m}$$
3. **Distance Formulation**: For every candidate peer country $c \neq \text{target}$, computes the mean absolute Z-score deviation across all mutually available metrics $M$:
   $$\text{Distance}(c) = \frac{1}{|M|} \sum_{m \in M} |Z_{\text{target}, m} - Z_{c, m}|$$
4. **Candidate Pruning & Ranking**:
   - Requires at least 2 common metrics (`len(contributions) >= 2`).
   - Sorts candidates by:
     1. `-common_metric_count` (higher overlap preferred)
     2. `distance` (ascending, smaller distance preferred)
     3. `country_label` (alphabetical tiebreaker)
5. **Basket Selection**: Selects the **top 3 nearest countries**.
6. **Confidence Classification**: If all 3 members share full feature overlap, assigns `confidence = "high"`; otherwise drops to `"medium"` or `"low"`.
