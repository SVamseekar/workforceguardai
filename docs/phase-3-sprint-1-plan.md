# Phase 3 Sprint 1 Plan

This plan defines the first intentional implementation slice for Phase 3.

It is designed to fit the current WorkforceGuard shape:
- `analytics/` remains the source of truth for modeled semantics
- `dashboard/backend/` stays the curated API layer
- `dashboard/frontend/` stays a thin product surface over evidence-backed payloads

## Sprint goal

Prove one end-to-end company-aware workflow without widening scope too early.

At the end of Sprint 1, WorkforceGuard should be able to:
- ingest one internal company data path from local files
- map internal roles into stable worker categories
- compare one internal pay view against external market signals
- show whether a conclusion is based on `external`, `internal`, or `blended` evidence

## Chosen slice

Use:
- payroll snapshot CSV
- job architecture CSV

Do not include yet:
- ATS
- HRIS mobility history
- LMS / skills systems
- compliance simulator workflows

This keeps the first slice narrow while still satisfying the core Phase 3 direction.

## Why this slice first

- It gives a real company-aware use case instead of another market-only enhancement.
- It is smaller than a full HRIS plus ATS connector program.
- It creates the foundation for later worker-category and pay-transparency work.
- It avoids overstating intelligence before internal data contracts are stable.

## Sprint deliverables

- internal data contract for payroll snapshot and job architecture inputs
- one repeatable local ingestion script for those inputs
- one worker-category model
- one blended mart for internal-vs-market pay benchmarking
- additive API payload fields for evidence basis
- one frontend panel or card showing internal-vs-market comparison
- analyst-response support for one company-aware question path
- tests that block company-specific claims when internal data is absent

## Proposed input contract

### Payroll snapshot CSV

Recommended file:
- `data/internal_raw/payroll_snapshot.csv`

Recommended minimum columns:
- `employee_id`
- `job_code`
- `job_title`
- `country_code`
- `worker_category_id`
- `gender`
- `base_pay_amount`
- `pay_currency`
- `snapshot_date`
- `employment_status`

### Job architecture CSV

Recommended file:
- `data/internal_raw/job_architecture.csv`

Recommended minimum columns:
- `job_code`
- `job_family`
- `job_level`
- `worker_category_id`
- `worker_category_label`
- `esco_uri`
- `nace_code`

## Exact repo touchpoints

### New config and raw-data conventions

Add:
- `configs/internal_sources.yaml`
- `data/internal_raw/.gitkeep`
- `data/internal_meta/.gitkeep`

### New ingestion script

Add:
- `scripts/prepare_internal_company_data.py`

Responsibilities:
- validate required columns
- normalize currencies and dates only as needed for the first slice
- write canonical parquet outputs into a stable internal-data folder
- produce a lightweight manifest in `data/internal_meta/`

### Analytics layer

Add directories:
- `analytics/models/staging/internal/`
- `analytics/models/marts/internal/`

Add models:
- `analytics/models/staging/internal/stg_internal__payroll_snapshot.sql`
- `analytics/models/staging/internal/stg_internal__job_architecture.sql`
- `analytics/models/marts/internal/dim_worker_category.sql`
- `analytics/models/marts/internal/fct_internal_pay_snapshot.sql`
- `analytics/models/marts/internal/mart_internal_market_pay_benchmark.sql`
- `analytics/models/marts/internal/_internal_models.yml`

Likely seed update:
- `analytics/seeds/reference/ref_data_sources.csv`

Purpose:
- keep internal and external domains separate
- model worker-category semantics explicitly
- publish one blended benchmark mart instead of pushing logic into the backend

### Backend API

Extend:
- `dashboard/backend/service.py`
- `dashboard/backend/tests/test_service.py`

Recommended additive behaviors:
- overview payload exposes an internal-vs-market benchmark block when internal data is present
- analyst responses can answer one company-aware benchmark question
- evidence bundles include `evidence_basis` with values:
  - `external`
  - `internal`
  - `blended`
- no company-specific answer is returned when the internal path is missing

### Frontend

Extend:
- `dashboard/frontend/src/components/Overview.jsx`

Recommended Sprint 1 UI additions:
- one internal-vs-market comparison card or panel
- one visible evidence-basis chip for internal, external, or blended
- one empty state that clearly says the company connector is not yet loaded

Do not redesign the whole app in this sprint.

## Backend contract for Sprint 1

Additive overview shape:

- `internal_data`
  - `available`
  - `snapshot_date`
  - `sources`
- `company_benchmark`
  - `available`
  - `worker_category`
  - `internal_value`
  - `market_value`
  - `delta`
  - `coverage_status`
  - `evidence_basis`

Additive analyst-answer shape:

- `evidence_basis`
- `internal_data_available`

## Example Sprint 1 questions the product should answer

- "How does our software engineering pay compare with the external market?"
- "Which worker category deserves closer pay review?"
- "Is this answer based on internal data, market data, or both?"

## Guardrails

- No company-specific claim without the internal data path loaded
- No company-specific claim from local sample rows; real employer exports must be explicitly trusted in the manifest
- No automated recommendation that looks like an HR decision
- No ATS or skills expansion in Sprint 1
- No compliance simulator logic in Sprint 1
- No UI-only benchmark math; keep it in modeled or backend-curated logic

## Acceptance criteria

- a payroll snapshot can be ingested end to end from local files, while sample rows remain blocked from company claims
- worker categories are modeled independently from raw titles alone
- one internal-vs-market pay comparison is visible in the app
- the evidence basis is explicitly labeled
- analyst answers do not pretend internal knowledge when the internal files are absent
- regression tests cover both presence and absence of internal data

## Suggested implementation order

1. Create the internal file contract and ingestion script.
2. Add staging models for payroll snapshot and job architecture.
3. Build `dim_worker_category` and `fct_internal_pay_snapshot`.
4. Build one blended market-benchmark mart.
5. Extend backend overview and ask responses additively.
6. Add one frontend panel plus evidence-basis labeling.
7. Add tests for loaded and unloaded internal-data states.

## Definition of done for Sprint 1

Sprint 1 is done when we can demonstrate one truthful company-aware workflow in the current dashboard without breaking the Phase 2 market-only behavior.
