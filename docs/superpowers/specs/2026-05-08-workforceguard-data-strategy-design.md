# WorkforceGuard Data Strategy — Design Spec
**Date:** 2026-05-08  
**Status:** Approved for implementation planning  
**Scope:** Data pipeline, backend service, and CSV upload endpoint — zero frontend routing changes (frontend plan handles UI)

---

## 1. Problem Statement

The company-mirror half of WorkforceGuard is hollow. The internal data that feeds Pay Analysis and the compliance simulation consists of 6 synthetic employees with round-number salaries. This makes every demo unconvincing — an HR director sees numbers that are obviously not real.

There are three distinct problems to solve in sequence:

1. **The demo company is not credible** — 6 rows, round numbers, no realistic distribution
2. **The benchmarking has no real peer context** — the Égapro dataset (212,991 French company records, 2018–2025) sits unused in `data/public_company_raw/france/`
3. **There is no path for a real customer to bring their own data** — no upload endpoint, no ingestion pipeline

---

## 2. What Already Exists (Do Not Break)

| Component | Status |
|-----------|--------|
| Eurostat raw parquet files in `data/eu_raw/` | Real, working, untouched |
| dbt staging models for Eurostat | Working |
| dbt internal staging models (`stg_internal__payroll_snapshot`, `stg_internal__job_architecture`) | Working — read from `data/internal/*.parquet` |
| `mart_internal_market_pay_benchmark` | Working — joins internal pay gap to Eurostat market benchmark |
| `mart_pay_transparency_category_review` | Working — derives compliance review state per worker category |
| `_build_company_benchmark()` in `service.py` | Working — queries `mart_internal_market_pay_benchmark` |
| `_build_pay_transparency_simulation()` in `service.py` | Working — queries `mart_pay_transparency_category_review` |
| `_build_internal_data_status()` in `service.py` | Working — reads `data/internal_meta/manifest.json` |
| `data/internal_meta/manifest.json` | Working — marks data as trusted/untrusted |

The entire internal data pipeline already works correctly. The only problem is the data feeding it is a 6-row toy. The fix is replacing the source data, not the pipeline.

---

## 3. Sequence of Work

### Phase 1: Realistic Demo Company
Replace 6-row synthetic data with a properly calibrated 350-employee French software company. All existing pipeline runs unchanged — only the source CSVs change.

### Phase 2: Égapro Ingestion
Load the full Égapro dataset into DuckDB. Expose a new API endpoint for peer benchmarking — "how does this company's index score compare to others in the same sector and size band?" Surface this in the backend overview response.

### Phase 3: UK Gender Pay Gap Ingestion
Same pattern as Égapro. Load the UK GPG dataset. Adds a second country with named real companies.

### Phase 4: CSV Upload Endpoint
Add a FastAPI endpoint that accepts a payroll CSV upload, validates it, converts it to parquet, writes it to `data/internal/`, updates `data/internal_meta/manifest.json`, and triggers a dbt run. The existing pipeline then produces updated Pay Analysis output automatically.

---

## 4. Phase 1: Realistic Demo Company

### What to build

Replace `data/internal_raw/payroll_snapshot.csv` and `data/internal_raw/job_architecture.csv` with realistic data for a fictional French software company: **AeroTech Europe SAS**.

### AeroTech Europe SAS profile

| Attribute | Value |
|-----------|-------|
| Name | AeroTech Europe SAS |
| Country | France (FR) |
| Sector | Software & IT (NACE J62) |
| Headcount | 350 employees |
| Snapshot date | 2025-12-31 |
| Currency | EUR |

### Worker categories and headcount

| Worker category | Category ID | Headcount | Female % | Male % |
|----------------|-------------|-----------|----------|--------|
| Engineering IC | eng_ic | 180 | 28% (50) | 72% (130) |
| Senior Engineer | eng_senior | 65 | 24% (16) | 76% (49) |
| Product & Design | product_design | 40 | 55% (22) | 45% (18) |
| HR & People | hr_generalist | 25 | 80% (20) | 20% (5) |
| Finance & Legal | finance_legal | 20 | 60% (12) | 40% (8) |
| Sales & GTM | sales_gtm | 20 | 45% (9) | 55% (11) |

Total: 350 employees, 129 female (37%), 221 male (63%)

### Pay distributions (calibrated to Égapro 2025 France / sector J averages)

These are calibrated so the resulting gender pay gap sits close to the French software sector average of ~12%, making the demo benchmark comparison meaningful.

| Category | Female median (EUR) | Male median (EUR) | Resulting gap |
|----------|--------------------|--------------------|---------------|
| Engineering IC | 52,000 | 58,000 | ~10% |
| Senior Engineer | 72,000 | 82,000 | ~12% |
| Product & Design | 55,000 | 58,000 | ~5% |
| HR & People | 42,000 | 48,000 | ~13% |
| Finance & Legal | 50,000 | 55,000 | ~9% |
| Sales & GTM | 48,000 | 52,000 | ~8% |

Pay amounts use a realistic normal distribution within ±15% of the median per category, not round numbers.

### Job architecture

| Job code | Job family | Level | Category ID | NACE | ESCO URI |
|----------|-----------|-------|-------------|------|----------|
| SE-IC-1 | Engineering | IC2 | eng_ic | J62 | urn:esco:occupation:2512 |
| SE-IC-2 | Engineering | IC3 | eng_ic | J62 | urn:esco:occupation:2512 |
| SE-IC-3 | Engineering | IC4 | eng_ic | J62 | urn:esco:occupation:2512 |
| SE-SR-1 | Engineering | IC5 | eng_senior | J62 | urn:esco:occupation:2512 |
| SE-SR-2 | Engineering | IC6 | eng_senior | J62 | urn:esco:occupation:2512 |
| PD-1 | Product | P2 | product_design | J62 | urn:esco:occupation:2166 |
| PD-2 | Product | P3 | product_design | J62 | urn:esco:occupation:2166 |
| HR-1 | People | P2 | hr_generalist | N78 | urn:esco:occupation:2423 |
| HR-2 | People | P3 | hr_generalist | N78 | urn:esco:occupation:2423 |
| FIN-1 | Finance | P2 | finance_legal | K64 | urn:esco:occupation:2411 |
| SALES-1 | Sales | P2 | sales_gtm | J62 | urn:esco:occupation:3322 |

### Manifest update

After regenerating parquet files, `data/internal_meta/manifest.json` must be updated:
- `trusted_for_company_claims: true` for both assets
- `record_count` updated to reflect real counts
- `version: "demo-v1"`

### Implementation

A Python script `scripts/generate_demo_company.py` generates the CSV files deterministically (fixed random seed) and writes them to `data/internal_raw/`. A second script `scripts/build_internal_parquet.py` converts the CSVs to parquet and updates the manifest. These scripts are run once to set up the demo state.

---

## 5. Phase 2: Égapro Ingestion

### What the dataset contains

- **Source:** `data/public_company_raw/france/france_index_raw.xlsx`
- **Rows:** 212,991 records (2018–2025)
- **Unique companies:** 41,054 (by SIREN)
- **2025 data:** 29,571 companies
- **Fields used:**

| Égapro column | Our name | Notes |
|--------------|----------|-------|
| Année | year | Integer 2018–2025 |
| SIREN | siren | Company identifier |
| Raison Sociale | company_name | Legal company name |
| Tranche d'effectifs | size_band | "50 à 250", "251 à 999", "1000 et plus" |
| Code NAF | naf_code | Includes description — extract code prefix only |
| Note Index | index_score | 0–100, some rows are "NC" (not calculable) — exclude |
| Note Ecart rémunération | score_pay_gap | Component: pay gap indicator score |
| Note Hautes rémunérations | score_top_earners | Component: % women in top earners |
| Note Retour congé maternité | score_maternity | Component: return from maternity leave |
| Région | region | French region name |

### What to build

**1. Raw parquet conversion**

A script `scripts/ingest_egapro.py` that:
- Reads `france_index_raw.xlsx`
- Cleans NAF codes (extract first 5-char code from "62.02A - Description" format)
- Filters to rows where `Note Index` is a valid integer (excludes "NC")
- Writes to `data/public_company/egapro_index.parquet`

**2. New dbt staging model**

`analytics/models/staging/public_company/stg_public_company__egapro.sql`

Reads from `data/public_company/egapro_index.parquet`, standardises columns, maps NAF codes to NACE sector letters.

**3. New dbt mart model**

`analytics/models/marts/public_company/mart_egapro_sector_benchmark.sql`

Aggregates per year + NAF code + size band:
- `p25_score`, `p50_score`, `p75_score` of `index_score`
- `company_count` (for data suppression — only publish if ≥ 5 companies)
- `p50_pay_gap_score`, `p50_top_earners_score`

This is the peer benchmarking mart. It answers: "For French software companies with 250–999 employees in 2025, what is the median Égapro index score?"

**4. New backend method**

`_build_egapro_peer_benchmark(filters)` in `service.py`:
- Only activates when `filters.country == "FR"`
- Queries `mart_egapro_sector_benchmark` for matching NAF + size band + latest year
- Returns p25/p50/p75 scores + company count
- Suppresses output if company count < 5

**5. Surface in overview response**

Add `egapro_peer_benchmark` key to the overview payload returned by `build_overview()`. Frontend reads this in `PayAnalysisSection` (handled in frontend plan cross-check below).

### New API endpoint

`GET /api/egapro-benchmark?country=FR&naf_code=J62&size_band=251-999&year=2025`

Returns the peer benchmark distribution for a given NAF code, size band, and year. Used by the frontend to show "AeroTech scores X vs sector median of Y".

---

## 6. Phase 3: UK Gender Pay Gap Ingestion

### What to build

Download the UK GPG CSV from `https://gender-pay-gap.service.gov.uk/viewing/download-data/2024` and save to `data/public_company_raw/uk/uk_gpg_2024.csv`.

**Fields used:**

| UK GPG column | Our name |
|--------------|----------|
| EmployerName | company_name |
| EmployerId | employer_id |
| SicCodes | sic_codes |
| DiffMeanHourlyPercent | mean_pay_gap |
| DiffMedianHourlyPercent | median_pay_gap |
| MaleLowerQuartile / FemaleLowerQuartile | quartile splits |
| EmployerSize | size_band |

**Pipeline:** Same pattern as Égapro — ingest script → staging model → mart that aggregates to sector + size band percentiles. New method `_build_uk_gpg_peer_benchmark()` in service.py. Activates when `filters.country == "GB"`.

---

## 7. Phase 4: CSV Upload Endpoint

### What to build

A FastAPI endpoint that accepts a payroll CSV from a user, validates it, converts to parquet, replaces the demo data, and triggers a dbt run.

### Endpoint

`POST /api/upload/payroll`

- Accepts `multipart/form-data` with a `file` field (CSV)
- Validates required columns are present
- Validates data types and non-null constraints
- Converts to parquet
- Writes to `data/internal/payroll_snapshot.parquet`
- Updates `data/internal_meta/manifest.json` with `trusted_for_company_claims: true`
- Runs `dbt run --select tag:internal` to rebuild internal marts
- Returns upload summary (record count, column validation result, any warnings)

### Required CSV columns

```
employee_id        — string, unique, non-null
job_code           — string, non-null (must match job_architecture)
country_code       — ISO 2-letter, non-null
worker_category_id — string, non-null
gender             — "female" | "male" | "non_binary", non-null
base_salary        — numeric > 0, non-null
currency           — ISO currency code, non-null
employment_type    — "full_time" | "part_time", default "full_time"
snapshot_date      — date YYYY-MM-DD, non-null
version            — string, optional, defaults to "uploaded-v1"
```

### Validation rules

- Minimum 10 rows required (refuse uploads smaller than this)
- `gender` must be one of: female, male, non_binary (case-insensitive)
- `base_salary` must be > 0
- `country_code` must be a valid ISO 2-letter code
- `snapshot_date` must be a valid date, not in the future
- If `job_code` values are not in the job architecture file, warn but do not reject

### Response shape

```json
{
  "status": "accepted",
  "record_count": 347,
  "validation": {
    "passed": true,
    "warnings": ["14 job_codes not found in job architecture — these rows will have no NACE/ESCO mapping"]
  },
  "snapshot_date": "2025-12-31",
  "dbt_run": "triggered"
}
```

### Security

- File size limit: 10MB
- Accepted MIME types: `text/csv`, `application/csv`
- No file storage beyond the immediate conversion — CSV is deleted after parquet is written
- No authentication at this stage (local deployment only — authentication is Phase 6 scope)

---

## 8. Data Directory Structure (After All Phases)

```
data/
├── eu_raw/                    — Eurostat parquet (unchanged)
├── eu_meta/                   — Eurostat metadata (unchanged)
├── internal_raw/
│   ├── payroll_snapshot.csv   — AeroTech demo company (350 employees)
│   └── job_architecture.csv   — AeroTech job codes
├── internal/
│   ├── payroll_snapshot.parquet
│   ├── job_architecture.parquet
│   └── hris_workforce_snapshot.parquet (placeholder, unchanged)
├── internal_meta/
│   └── manifest.json          — trusted_for_company_claims: true
├── public_company_raw/
│   ├── france/
│   │   └── france_index_raw.xlsx  — Égapro (already exists)
│   └── uk/
│       └── uk_gpg_2024.csv    — UK GPG (new download)
├── public_company/
│   ├── egapro_index.parquet   — Cleaned Égapro (new)
│   └── uk_gpg.parquet         — Cleaned UK GPG (new)
└── public_company_meta/
    └── manifest.json          — provenance for public company data (new)
```

---

## 9. dbt Model Structure (After All Phases)

```
analytics/models/
├── staging/
│   ├── eurostat/              — unchanged
│   ├── internal/              — unchanged
│   └── public_company/        — NEW
│       ├── stg_public_company__egapro.sql
│       └── stg_public_company__uk_gpg.sql
└── marts/
    ├── core/                  — unchanged
    ├── internal/              — unchanged
    └── public_company/        — NEW
        ├── mart_egapro_sector_benchmark.sql
        └── mart_uk_gpg_sector_benchmark.sql
```

---

## 10. Backend API Changes (service.py)

| Change | Type |
|--------|------|
| `_build_egapro_peer_benchmark(filters)` | New private method |
| `_build_uk_gpg_peer_benchmark(filters)` | New private method |
| `build_overview()` — add `egapro_peer_benchmark` key | Additive change |
| New `GET /api/egapro-benchmark` route in `main.py` | New endpoint |
| New `POST /api/upload/payroll` route in `main.py` | New endpoint |

No existing methods are modified. All changes are additive.

---

## 11. What Does Not Change

- All existing Eurostat data and pipeline — zero changes
- `_build_company_benchmark()` — zero changes (reads same mart)
- `_build_pay_transparency_simulation()` — zero changes (reads same mart)
- `_build_internal_data_status()` — zero changes (reads same manifest)
- All existing API endpoints — zero changes
- The dbt internal mart models — zero changes (same SQL, richer source data)
- The frontend routing plan — additive only (see cross-check section)

---

## 12. Success Criteria

- Pay Analysis shows AeroTech Europe SAS with 350 employees and a realistic gender pay gap (~11–13%)
- The compliance table shows 3–4 worker categories with mix of "Needs review" and "Documented difference"
- When `country=FR` is selected, the Égapro peer benchmark shows sector median with company count
- A valid CSV upload replaces demo data and triggers a dbt rebuild without restarting the server
- An invalid CSV (missing columns, bad types) returns a clear validation error, not a 500
- No existing test breaks
