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

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/` | Root health + filter options + available governance actions |
| GET | `/health` | Service health check |
| GET | `/api/overview` | Full command-centre overview payload |
| POST | `/api/ask` | Analyst console question answering |
| GET | `/api/evidence-pack` | Exportable evidence pack for compliance review |
| POST | `/api/governance-events` | Record a governance action (approve / override / reverse / export) |
| GET | `/api/governance-events` | List recent governance events and available actions |
| GET | `/api/unemployment` | Convenience: unemployment trend series for charts |
| GET | `/api/employment` | Convenience: employment trend series for charts |
| GET | `/api/vacancies` | Convenience: vacancy by sector series for charts |
| GET | `/api/gender_pay_gap` | Convenience: pay gap by sector series for charts |

**Note:** The four convenience endpoints (`/api/unemployment`, `/api/employment`, `/api/vacancies`, `/api/gender_pay_gap`) delegate to `build_overview` and extract the relevant chart series. They are thin wrappers kept for frontend compatibility.

### Query Parameters (overview, evidence-pack, convenience endpoints)

| Parameter | Default | Notes |
|-----------|---------|-------|
| `country` | `"ALL"` | ISO 3166-1 alpha-2 or `"ALL"` |
| `geography` | `"EU27_AVG"` | Geo ID from `dim_geography` or `"EU27_AVG"` |
| `sector` | `"ALL"` | NACE sector ID or `"ALL"` |
| `period` | `"latest"` | Year string or `"latest"` |
| `benchmark_geography` | `None` | Optional comparison geo |
| `benchmark_sector` | `None` | Optional comparison sector |

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

| Mode | Trigger | Behaviour |
|------|---------|-----------|
| **Modeled** | DuckDB file exists with all 4 required tables | Opens `workforceguard_analytics.duckdb` read-only |
| **Raw** | DuckDB file missing or tables absent | Opens `:memory:`, creates Parquet views over `eu_raw/` |

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

| State | Trigger | `available` |
|-------|---------|------------|
| DB not ready | `_modeled_database_ready()` returns False | False |
| Required tables missing | Internal mart tables not found in DuckDB | False |
| Available | All required tables present and payroll > 0 rows | True |

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

| benchmark_id | Label | benchmark_status |
|-------------|-------|-----------------|
| `eu` | EU27 proxy average | proxy |
| `peer` | Peer-country basket | proxy |
| `prior_period` | Prior period | official |
| `market` | Selected market | official |
| `sector` | Selected sector | official |

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

| Chart key | Content | X-axis | Y-axis |
|-----------|---------|--------|--------|
| `unemployment_trend` | Unemployment rate over all periods | `period` | `value (%)` |
| `employment_trend` | Employment rate over all periods | `period` | `value (%)` |
| `vacancy_by_sector` | Latest vacancy rate per sector | `sector` | `value (%)` |
| `pay_gap_by_sector` | Latest gender pay gap per sector | `sector` | `value (%)` |

Each series is a list of `{period: "...", value: n}` or `{sector: "...", value: n}` dicts, sorted chronologically or by value descending.

---

## 24. HELPER FUNCTIONS (module-level)

| Function | Purpose |
|----------|---------|
| `clamp_score(value: float) → int` | Clamp to [0, 100], round to nearest int |
| `parse_bool(value: Any) → bool` | Parse "1", "true", "yes" → True |
| `escape_path(path: Path) → str` | Resolve and escape single quotes for DuckDB string literal |
| `period_sort_key(period_code: str) → tuple` | Parse `YYYY-QN` or `YYYY` → `(year, quarter)` tuple for ordering |
| `format_signed_delta(delta, unit) → str` | Format `+2.3 pts` / `-1.1 pts` / `"Unavailable"` |

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

| Variable | Default | Purpose |
|----------|---------|---------|
| `WORKFORCEGUARD_HOST` | `"127.0.0.1"` | Bind host for uvicorn |
| `WORKFORCEGUARD_PORT` | `"8001"` | Bind port for uvicorn |

### Data Path Dependencies

The repository expects the following relative to `root_dir` (two levels above `dashboard/backend/`):

| Path | Required | Purpose |
|------|----------|---------|
| `data/workforceguard_analytics.duckdb` | Preferred | Modeled DuckDB warehouse |
| `data/eu_raw/*.parquet` | Fallback | Raw Parquet files (used when DuckDB absent) |
| `data/internal/*.parquet` | Phase 3 | Internal company data |
| `data/reference/*.parquet` | Phase 3+ | ESCO reference data |
| `data/governance_events.json` | Auto-created | Governance event store |
| `analytics/seeds/reference/ref_metric_registry.csv` | Required | Metric definitions |
| `analytics/seeds/reference/ref_data_sources.csv` | Required | Source catalogue |
| `analytics/seeds/governance/ref_governance_actions.csv` | Required | Governance action definitions |

---

*Continued in Part 4: Frontend Application, Data Assets, Operations, Security, and Gap Summary*
