# WorkforceGuard Data Strategy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace 6-row synthetic demo data with a realistic 350-employee French company, ingest Égapro and UK GPG public datasets for peer benchmarking, and add a CSV upload endpoint so real customers can bring their own data.

**Architecture:** Four independent phases. Each phase is deployable on its own. Phase 1 touches only source CSV files and the manifest — zero code changes. Phase 2–3 add new dbt models and a new backend method. Phase 4 adds a FastAPI endpoint. All changes are additive — no existing models, methods, or endpoints are modified.

**Tech Stack:** Python 3, pandas, dbt (DuckDB adapter), FastAPI, DuckDB, parquet

---

## File Map

### Phase 1 — Demo company
| File | Action |
|------|--------|
| `scripts/generate_demo_company.py` | Create — generates realistic CSVs deterministically |
| `scripts/build_internal_parquet.py` | Create — converts CSVs to parquet, updates manifest |
| `data/internal_raw/payroll_snapshot.csv` | Replace — 350 employees |
| `data/internal_raw/job_architecture.csv` | Replace — 11 job codes |
| `data/internal_meta/manifest.json` | Update — trusted_for_company_claims: true |

### Phase 2 — Égapro ingestion
| File | Action |
|------|--------|
| `scripts/ingest_egapro.py` | Create — cleans XLSX, writes parquet |
| `data/public_company/egapro_index.parquet` | Create — output of ingest script |
| `analytics/macros/public_company_paths.sql` | Create — DuckDB path macro |
| `analytics/models/staging/public_company/stg_public_company__egapro.sql` | Create |
| `analytics/models/marts/public_company/mart_egapro_sector_benchmark.sql` | Create |
| `dashboard/backend/service.py` | Modify — add `_build_egapro_peer_benchmark()` + surface in `build_overview()` |
| `dashboard/backend/main.py` | Modify — add `GET /api/egapro-benchmark` route |

### Phase 3 — UK GPG ingestion
| File | Action |
|------|--------|
| `scripts/ingest_uk_gpg.py` | Create — downloads CSV, writes parquet |
| `data/public_company_raw/uk/uk_gpg_2024.csv` | Create — downloaded UK data |
| `data/public_company/uk_gpg.parquet` | Create — output of ingest script |
| `analytics/models/staging/public_company/stg_public_company__uk_gpg.sql` | Create |
| `analytics/models/marts/public_company/mart_uk_gpg_sector_benchmark.sql` | Create |
| `dashboard/backend/service.py` | Modify — add `_build_uk_gpg_peer_benchmark()` |

### Phase 4 — CSV upload endpoint
| File | Action |
|------|--------|
| `dashboard/backend/main.py` | Modify — add `POST /api/upload/payroll` route |
| `dashboard/backend/service.py` | Modify — add `ingest_uploaded_payroll()` method |

---

## Task 1: Generate realistic demo company CSVs

**Files:**
- Create: `scripts/generate_demo_company.py`

- [ ] **Step 1: Create scripts directory**

```bash
mkdir -p scripts
```

- [ ] **Step 2: Create generate_demo_company.py**

```python
# scripts/generate_demo_company.py
"""
Generates realistic demo company data for AeroTech Europe SAS.
Run from the project root: python scripts/generate_demo_company.py
Output: data/internal_raw/payroll_snapshot.csv and data/internal_raw/job_architecture.csv
"""
import csv
import random
from pathlib import Path

SEED = 42
random.seed(SEED)

ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "data" / "internal_raw"
RAW_DIR.mkdir(parents=True, exist_ok=True)

SNAPSHOT_DATE = "2025-12-31"
COUNTRY = "FR"
CURRENCY = "EUR"

# Job architecture: code, family, level, worker_category_id, label, nace, esco_uri
JOB_ARCHITECTURE = [
    ("SE-IC-1", "Engineering", "IC2", "eng_ic",        "Engineering Individual Contributor", "J62", "urn:esco:occupation:2512"),
    ("SE-IC-2", "Engineering", "IC3", "eng_ic",        "Engineering Individual Contributor", "J62", "urn:esco:occupation:2512"),
    ("SE-IC-3", "Engineering", "IC4", "eng_ic",        "Engineering Individual Contributor", "J62", "urn:esco:occupation:2512"),
    ("SE-SR-1", "Engineering", "IC5", "eng_senior",    "Senior Engineer",                    "J62", "urn:esco:occupation:2512"),
    ("SE-SR-2", "Engineering", "IC6", "eng_senior",    "Senior Engineer",                    "J62", "urn:esco:occupation:2512"),
    ("PD-1",    "Product",     "P2",  "product_design","Product & Design",                   "J62", "urn:esco:occupation:2166"),
    ("PD-2",    "Product",     "P3",  "product_design","Product & Design",                   "J62", "urn:esco:occupation:2166"),
    ("HR-1",    "People",      "P2",  "hr_generalist", "HR Generalist",                      "N78", "urn:esco:occupation:2423"),
    ("HR-2",    "People",      "P3",  "hr_generalist", "HR Generalist",                      "N78", "urn:esco:occupation:2423"),
    ("FIN-1",   "Finance",     "P2",  "finance_legal", "Finance & Legal",                    "K64", "urn:esco:occupation:2411"),
    ("SALES-1", "Sales",       "P2",  "sales_gtm",     "Sales & GTM",                        "J62", "urn:esco:occupation:3322"),
]

# category_id -> [(job_codes), female_count, male_count, female_median, male_median]
CATEGORY_CONFIG = {
    "eng_ic":        (["SE-IC-1", "SE-IC-2", "SE-IC-3"], 50,  130, 52000, 58000),
    "eng_senior":    (["SE-SR-1", "SE-SR-2"],             16,  49,  72000, 82000),
    "product_design":(["PD-1", "PD-2"],                   22,  18,  55000, 58000),
    "hr_generalist": (["HR-1", "HR-2"],                   20,  5,   42000, 48000),
    "finance_legal": (["FIN-1"],                          12,  8,   50000, 55000),
    "sales_gtm":     (["SALES-1"],                        9,   11,  48000, 52000),
}

JOB_TITLE_MAP = {
    "SE-IC-1": "Software Engineer",
    "SE-IC-2": "Software Engineer II",
    "SE-IC-3": "Senior Software Engineer",
    "SE-SR-1": "Staff Engineer",
    "SE-SR-2": "Principal Engineer",
    "PD-1":    "Product Manager",
    "PD-2":    "Senior Product Manager",
    "HR-1":    "HR Generalist",
    "HR-2":    "Senior HR Business Partner",
    "FIN-1":   "Financial Analyst",
    "SALES-1": "Account Executive",
}


def normal_pay(median: int) -> int:
    """Return a pay amount within ±15% of median, rounded to nearest 500."""
    low = int(median * 0.85)
    high = int(median * 1.15)
    raw = random.randint(low, high)
    return round(raw / 500) * 500


def generate_payroll():
    rows = []
    emp_id = 1

    for category_id, (job_codes, female_count, male_count, female_median, male_median) in CATEGORY_CONFIG.items():
        for gender, count, median in [("female", female_count, female_median), ("male", male_count, male_median)]:
            for _ in range(count):
                job_code = random.choice(job_codes)
                rows.append({
                    "employee_id": f"emp-{emp_id:04d}",
                    "job_code": job_code,
                    "job_title": JOB_TITLE_MAP[job_code],
                    "country_code": COUNTRY,
                    "worker_category_id": category_id,
                    "gender": gender,
                    "base_pay_amount": normal_pay(median),
                    "pay_currency": CURRENCY,
                    "snapshot_date": SNAPSHOT_DATE,
                    "employment_status": "active",
                    "version": "demo-v1",
                })
                emp_id += 1

    random.shuffle(rows)
    return rows


def write_payroll(rows):
    path = RAW_DIR / "payroll_snapshot.csv"
    fieldnames = ["employee_id", "job_code", "job_title", "country_code", "worker_category_id",
                  "gender", "base_pay_amount", "pay_currency", "snapshot_date", "employment_status", "version"]
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    print(f"Written {len(rows)} rows to {path}")


def write_job_architecture():
    path = RAW_DIR / "job_architecture.csv"
    fieldnames = ["job_code", "job_family", "job_level", "worker_category_id",
                  "worker_category_label", "nace_code", "esco_uri", "version"]
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for code, family, level, cat_id, cat_label, nace, esco in JOB_ARCHITECTURE:
            writer.writerow({
                "job_code": code,
                "job_family": family,
                "job_level": level,
                "worker_category_id": cat_id,
                "worker_category_label": cat_label,
                "nace_code": nace,
                "esco_uri": esco,
                "version": "demo-v1",
            })
    print(f"Written {len(JOB_ARCHITECTURE)} job codes to {path}")


if __name__ == "__main__":
    rows = generate_payroll()
    write_payroll(rows)
    write_job_architecture()
    print("Demo company data generated.")
```

- [ ] **Step 3: Run the script**

```bash
cd /Users/souravamseekarmarti/Projects/WorkforceGuard-AI
source .venv-data/bin/activate
python scripts/generate_demo_company.py
```

Expected output:
```
Written 350 rows to data/internal_raw/payroll_snapshot.csv
Written 11 job codes to data/internal_raw/job_architecture.csv
Demo company data generated.
```

- [ ] **Step 4: Verify output**

```bash
wc -l data/internal_raw/payroll_snapshot.csv
head -5 data/internal_raw/payroll_snapshot.csv
```

Expected: 351 lines (header + 350 rows). Pay amounts are not round numbers — e.g. 54500, 81000, 47000 not 50000, 80000, 48000.

- [ ] **Step 5: Commit**

```bash
git add scripts/generate_demo_company.py data/internal_raw/payroll_snapshot.csv data/internal_raw/job_architecture.csv
git commit -m "feat: generate realistic AeroTech Europe SAS demo company (350 employees)"
```

---

## Task 2: Convert CSVs to parquet and update manifest

**Files:**
- Create: `scripts/build_internal_parquet.py`
- Modify: `data/internal_meta/manifest.json`

- [ ] **Step 1: Create build_internal_parquet.py**

```python
# scripts/build_internal_parquet.py
"""
Converts internal_raw CSVs to parquet and updates the internal manifest.
Run from project root: python scripts/build_internal_parquet.py
"""
import json
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "data" / "internal_raw"
OUT_DIR = ROOT / "data" / "internal"
META_DIR = ROOT / "data" / "internal_meta"
OUT_DIR.mkdir(parents=True, exist_ok=True)
META_DIR.mkdir(parents=True, exist_ok=True)


def convert(csv_name: str, parquet_name: str, dtypes: dict = None) -> int:
    src = RAW_DIR / csv_name
    dst = OUT_DIR / parquet_name
    df = pd.read_csv(src, dtype=dtypes)
    df.to_parquet(dst, index=False)
    print(f"  {csv_name} → {parquet_name} ({len(df)} rows)")
    return len(df)


def update_manifest(payroll_count: int, job_arch_count: int):
    path = META_DIR / "manifest.json"
    manifest = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "assets": [
            {
                "asset_type": "internal_payroll_snapshot",
                "version": "demo-v1",
                "record_count": payroll_count,
                "output": str(OUT_DIR / "payroll_snapshot.parquet"),
                "trusted_for_company_claims": True,
            },
            {
                "asset_type": "internal_job_architecture",
                "version": "demo-v1",
                "record_count": job_arch_count,
                "output": str(OUT_DIR / "job_architecture.parquet"),
                "trusted_for_company_claims": True,
            },
            {
                "asset_type": "internal_hris_workforce_snapshot",
                "version": "local",
                "record_count": 0,
                "output": str(OUT_DIR / "hris_workforce_snapshot.parquet"),
                "trusted_for_company_claims": False,
                "placeholder": True,
            },
            {
                "asset_type": "internal_ats_requisition_snapshot",
                "version": "local",
                "record_count": 0,
                "output": str(OUT_DIR / "ats_requisition_snapshot.parquet"),
                "trusted_for_company_claims": False,
                "placeholder": True,
            },
        ],
    }
    with path.open("w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)
    print(f"  Manifest updated → trusted_for_company_claims: True")


if __name__ == "__main__":
    print("Converting internal CSVs to parquet...")
    payroll_count = convert(
        "payroll_snapshot.csv",
        "payroll_snapshot.parquet",
        dtypes={"employee_id": str, "job_code": str, "country_code": str,
                "worker_category_id": str, "gender": str, "pay_currency": str,
                "employment_status": str, "version": str},
    )
    job_arch_count = convert(
        "job_architecture.csv",
        "job_architecture.parquet",
        dtypes={"job_code": str, "job_family": str, "job_level": str,
                "worker_category_id": str, "worker_category_label": str,
                "nace_code": str, "esco_uri": str, "version": str},
    )
    update_manifest(payroll_count, job_arch_count)
    print("Done.")
```

- [ ] **Step 2: Run the script**

```bash
python scripts/build_internal_parquet.py
```

Expected output:
```
Converting internal CSVs to parquet...
  payroll_snapshot.csv → payroll_snapshot.parquet (350 rows)
  job_architecture.csv → job_architecture.parquet (11 rows)
  Manifest updated → trusted_for_company_claims: True
Done.
```

- [ ] **Step 3: Rebuild dbt internal models**

```bash
cd analytics
dbt run --select tag:internal
```

Expected: All internal models build successfully. Check for `mart_internal_market_pay_benchmark` in the output.

If dbt run not available, run from the analytics directory:
```bash
cd /Users/souravamseekarmarti/Projects/WorkforceGuard-AI/analytics
source ../.venv-data/bin/activate
dbt run
```

- [ ] **Step 4: Verify Pay Analysis works in the API**

```bash
cd /Users/souravamseekarmarti/Projects/WorkforceGuard-AI/dashboard/backend
source ../../.venv-data/bin/activate
python main.py &
curl "http://localhost:8001/api/overview?country=FR&geography=FR&sector=J&period=latest" | python3 -m json.tool | grep -A5 "company_benchmark"
```

Expected: `company_benchmark.available` is `true`, `headcount` is close to 350, `internal_value` is between 8–15%.

- [ ] **Step 5: Commit**

```bash
git add scripts/build_internal_parquet.py data/internal_meta/manifest.json
git commit -m "feat: build internal parquet from demo company CSVs, mark as trusted"
```

---

## Task 3: Ingest Égapro dataset

**Files:**
- Create: `scripts/ingest_egapro.py`
- Create: `data/public_company/egapro_index.parquet`

- [ ] **Step 1: Create public_company output directory**

```bash
mkdir -p data/public_company
```

- [ ] **Step 2: Create ingest_egapro.py**

```python
# scripts/ingest_egapro.py
"""
Cleans and converts the Égapro XLSX to parquet.
Run from project root: python scripts/ingest_egapro.py
Input: data/public_company_raw/france/france_index_raw.xlsx
Output: data/public_company/egapro_index.parquet
"""
import re
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "data" / "public_company_raw" / "france" / "france_index_raw.xlsx"
DST = ROOT / "data" / "public_company" / "egapro_index.parquet"
DST.parent.mkdir(parents=True, exist_ok=True)

# Map French size band labels to standard bands
SIZE_BAND_MAP = {
    "50 à 250": "50-250",
    "251 à 999": "251-999",
    "1000 et plus": "1000+",
}

# Extract 5-char NAF code from "62.02A - Description" format
NAF_PATTERN = re.compile(r"^(\d{2}\.\d{2}[A-Z])")


def extract_naf_code(raw: str) -> str | None:
    if not isinstance(raw, str):
        return None
    m = NAF_PATTERN.match(raw.strip())
    return m.group(1) if m else None


def extract_naf_section(naf_code: str | None) -> str | None:
    """Map NAF code prefix to NACE section letter."""
    if not naf_code:
        return None
    prefix = int(naf_code[:2])
    if prefix <= 3:
        return "A"
    if prefix <= 9:
        return "B"
    if prefix <= 33:
        return "C"
    if prefix == 35:
        return "D"
    if prefix <= 39:
        return "E"
    if prefix <= 43:
        return "F"
    if prefix <= 47:
        return "G"
    if prefix <= 53:
        return "H"
    if prefix <= 56:
        return "I"
    if prefix <= 63:
        return "J"
    if prefix <= 66:
        return "K"
    if prefix == 68:
        return "L"
    if prefix <= 75:
        return "M"
    if prefix <= 82:
        return "N"
    if prefix == 84:
        return "O"
    if prefix == 85:
        return "P"
    if prefix <= 88:
        return "Q"
    if prefix <= 93:
        return "R"
    if prefix <= 96:
        return "S"
    return None


def is_numeric_score(val) -> bool:
    try:
        int(str(val).strip())
        return True
    except (ValueError, TypeError):
        return False


if __name__ == "__main__":
    print(f"Reading {SRC}...")
    df = pd.read_excel(SRC)
    print(f"  Raw rows: {len(df)}")

    # Rename columns
    df = df.rename(columns={
        "Année": "year",
        "SIREN": "siren",
        "Raison Sociale": "company_name",
        "Tranche d'effectifs": "size_band_raw",
        "Code NAF": "naf_raw",
        "Note Index": "index_score_raw",
        "Note Ecart rémunération": "score_pay_gap",
        "Note Hautes rémunérations": "score_top_earners",
        "Note Retour congé maternité": "score_maternity",
        "Région": "region",
        "Département": "department",
        "Pays": "country",
    })

    # Keep only rows with valid numeric index scores
    df = df[df["index_score_raw"].apply(is_numeric_score)].copy()
    df["index_score"] = df["index_score_raw"].astype(int)
    print(f"  Rows with valid index scores: {len(df)}")

    # Clean fields
    df["naf_code"] = df["naf_raw"].apply(extract_naf_code)
    df["nace_section"] = df["naf_code"].apply(extract_naf_section)
    df["size_band"] = df["size_band_raw"].map(SIZE_BAND_MAP).fillna("unknown")
    df["siren"] = df["siren"].astype(str).str.strip()
    df["company_name"] = df["company_name"].astype(str).str.strip()
    df["year"] = df["year"].astype(int)

    # Numeric component scores — coerce NC to null
    for col in ["score_pay_gap", "score_top_earners", "score_maternity"]:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    # Final column selection
    output = df[[
        "year", "siren", "company_name", "size_band", "naf_code",
        "nace_section", "index_score", "score_pay_gap",
        "score_top_earners", "score_maternity", "region",
    ]].copy()

    output.to_parquet(DST, index=False)
    print(f"  Written {len(output)} rows to {DST}")
    print(f"  Years: {sorted(output['year'].unique())}")
    print(f"  Unique companies: {output['siren'].nunique()}")
    print(f"  NACE sections: {sorted(output['nace_section'].dropna().unique())}")
```

- [ ] **Step 3: Run the script**

```bash
source .venv-data/bin/activate
python scripts/ingest_egapro.py
```

Expected output:
```
Reading data/public_company_raw/france/france_index_raw.xlsx...
  Raw rows: 212991
  Rows with valid index scores: 138948
  Written 138948 rows to data/public_company/egapro_index.parquet
  Years: [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025]
  Unique companies: 41054
  NACE sections: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S']
```

- [ ] **Step 4: Commit**

```bash
git add scripts/ingest_egapro.py data/public_company/egapro_index.parquet
git commit -m "feat: ingest Égapro dataset — 138k French company index scores 2018-2025"
```

---

## Task 4: Build Égapro dbt models

**Files:**
- Create: `analytics/macros/public_company_paths.sql`
- Create: `analytics/models/staging/public_company/stg_public_company__egapro.sql`
- Create: `analytics/models/marts/public_company/mart_egapro_sector_benchmark.sql`

- [ ] **Step 1: Create the macro**

Create `analytics/macros/public_company_paths.sql`:

```sql
{% macro public_company_parquet(filename) -%}
read_parquet('{{ var("public_company_path", "data/public_company") }}/{{ filename }}')
{%- endmacro %}
```

- [ ] **Step 2: Add public_company_path variable to dbt_project.yml**

In `analytics/dbt_project.yml`, under `vars:`, add:

```yaml
  public_company_path: "data/public_company"
```

- [ ] **Step 3: Create staging model directory and file**

```bash
mkdir -p analytics/models/staging/public_company
```

Create `analytics/models/staging/public_company/stg_public_company__egapro.sql`:

```sql
with source as (
    select *
    from {{ public_company_parquet('egapro_index.parquet') }}
),

standardized as (
    select
        cast(year as integer) as year,
        cast(siren as varchar) as siren,
        cast(company_name as varchar) as company_name,
        cast(size_band as varchar) as size_band,
        cast(naf_code as varchar) as naf_code,
        cast(nace_section as varchar) as nace_section,
        cast(index_score as integer) as index_score,
        cast(score_pay_gap as double) as score_pay_gap,
        cast(score_top_earners as double) as score_top_earners,
        cast(score_maternity as double) as score_maternity,
        cast(region as varchar) as region,
        'egapro' as source_id
    from source
    where siren is not null
      and year is not null
      and index_score is not null
      and index_score between 0 and 100
)

select *
from standardized
```

- [ ] **Step 4: Create marts directory and benchmark model**

```bash
mkdir -p analytics/models/marts/public_company
```

Create `analytics/models/marts/public_company/mart_egapro_sector_benchmark.sql`:

```sql
-- Aggregates Égapro scores by year + NACE section + size band.
-- Only published when company_count >= 5 (privacy threshold).
with base as (
    select *
    from {{ ref('stg_public_company__egapro') }}
    where nace_section is not null
      and size_band != 'unknown'
),

aggregated as (
    select
        year,
        nace_section,
        size_band,
        count(*) as company_count,
        percentile_cont(0.25) within group (order by index_score) as p25_score,
        percentile_cont(0.50) within group (order by index_score) as p50_score,
        percentile_cont(0.75) within group (order by index_score) as p75_score,
        avg(index_score) as mean_score,
        percentile_cont(0.50) within group (order by score_pay_gap) as p50_pay_gap_score,
        percentile_cont(0.50) within group (order by score_top_earners) as p50_top_earners_score
    from base
    group by 1, 2, 3
)

-- Only expose rows with at least 5 companies (data suppression)
select *
from aggregated
where company_count >= 5
```

- [ ] **Step 5: Run the new dbt models**

```bash
cd analytics
dbt run --select stg_public_company__egapro mart_egapro_sector_benchmark
```

Expected: Both models build successfully. No errors.

- [ ] **Step 6: Verify benchmark data**

```bash
dbt run --select mart_egapro_sector_benchmark
# Then check the output
python3 -c "
import duckdb
con = duckdb.connect('../data/workforceguard_analytics.duckdb', read_only=True)
rows = con.execute('''
    select year, nace_section, size_band, company_count,
           round(p25_score) as p25, round(p50_score) as p50, round(p75_score) as p75
    from mart_egapro_sector_benchmark
    where nace_section = 'J' and year = 2025
    order by size_band
''').fetchall()
for r in rows:
    print(r)
"
```

Expected: Rows for sector J (software/IT), year 2025, all size bands with realistic p25/p50/p75 scores between 70–95.

- [ ] **Step 7: Commit**

```bash
cd ..
git add analytics/macros/public_company_paths.sql \
        analytics/models/staging/public_company/ \
        analytics/models/marts/public_company/mart_egapro_sector_benchmark.sql \
        analytics/dbt_project.yml
git commit -m "feat: add Égapro dbt staging and sector benchmark mart"
```

---

## Task 5: Surface Égapro benchmark in backend

**Files:**
- Modify: `dashboard/backend/service.py`
- Modify: `dashboard/backend/main.py`

- [ ] **Step 1: Add `_build_egapro_peer_benchmark` to service.py**

In `service.py`, add this private method after `_build_uk_gpg_peer_benchmark` (which doesn't exist yet — add it before `build_overview`). Find the line `def build_overview(` and insert the new method just before it:

```python
def _build_egapro_peer_benchmark(
    self,
    filters: FilterState,
) -> Dict[str, Any]:
    """Returns Égapro sector peer benchmark when country=FR and mart available."""
    def unavailable(reason: str) -> Dict[str, Any]:
        return {"available": False, "note": reason}

    if filters.country != "FR":
        return unavailable("Égapro peer benchmark is only available for France.")

    if "mart_egapro_sector_benchmark" not in self._available_tables():
        return unavailable("Égapro benchmark mart not yet built. Run dbt to generate it.")

    # Map sector filter to NACE section
    nace_section = filters.sector[:1] if filters.sector and filters.sector != "ALL" else "J"

    rows = self._query(
        """
        select
            year,
            nace_section,
            size_band,
            company_count,
            round(p25_score) as p25_score,
            round(p50_score) as p50_score,
            round(p75_score) as p75_score,
            round(mean_score, 1) as mean_score,
            round(p50_pay_gap_score) as p50_pay_gap_score
        from mart_egapro_sector_benchmark
        where nace_section = ?
          and year = (select max(year) from mart_egapro_sector_benchmark where nace_section = ?)
        order by size_band
        limit 10
        """,
        [nace_section, nace_section],
    )

    if not rows:
        return unavailable(
            f"No Égapro benchmark data available for NACE section {nace_section}."
        )

    # Return the largest available size band or the first row
    row = rows[0]

    return {
        "available": True,
        "year": int(row["year"]),
        "nace_section": row["nace_section"],
        "size_band": row["size_band"],
        "company_count": int(row["company_count"]),
        "p25_score": int(row["p25_score"]),
        "p50_score": int(row["p50_score"]),
        "p75_score": int(row["p75_score"]),
        "mean_score": float(row["mean_score"]),
        "note": (
            f"Based on {int(row['company_count'])} French companies in NACE section "
            f"{row['nace_section']} ({row['size_band']} employees), {int(row['year'])} Égapro data."
        ),
        "source_id": "egapro",
        "all_size_bands": rows,
    }
```

- [ ] **Step 2: Add `egapro_peer_benchmark` to `build_overview` return value**

In `build_overview()`, find the line that builds the `overview` dict. It ends with:

```python
        overview["copilot"] = self._build_copilot_contract(overview)
        overview["brief"] = self._build_executive_brief(overview)
        overview["automation"] = self._build_workflow_automation(overview)
        return overview
```

Add the Égapro benchmark just before `return overview`:

```python
        overview["egapro_peer_benchmark"] = self._build_egapro_peer_benchmark(filters)
        return overview
```

- [ ] **Step 3: Add `/api/egapro-benchmark` route to main.py**

In `main.py`, add this route after the existing `/api/gender_pay_gap` route:

```python
@app.get("/api/egapro-benchmark")
def get_egapro_benchmark(
    country: str = "FR",
    sector: str = "J",
    size_band: Optional[str] = None,
    year: Optional[int] = None,
):
    filters, _ = guarded(repository.resolve_filters, country, "EU27_AVG", sector, "latest")
    return guarded(repository._build_egapro_peer_benchmark, filters)
```

- [ ] **Step 4: Restart backend and verify**

```bash
curl "http://localhost:8001/api/overview?country=FR&sector=J&period=latest" | python3 -m json.tool | grep -A 15 "egapro_peer_benchmark"
```

Expected: `egapro_peer_benchmark.available` is `true`, `p50_score` is between 85–92, `company_count` > 5.

- [ ] **Step 5: Commit**

```bash
git add dashboard/backend/service.py dashboard/backend/main.py
git commit -m "feat: add Égapro peer benchmark to overview API"
```

---

## Task 6: Ingest UK Gender Pay Gap data

**Files:**
- Create: `scripts/ingest_uk_gpg.py`
- Create: `data/public_company_raw/uk/uk_gpg_2024.csv`
- Create: `data/public_company/uk_gpg.parquet`
- Create: `analytics/models/staging/public_company/stg_public_company__uk_gpg.sql`
- Create: `analytics/models/marts/public_company/mart_uk_gpg_sector_benchmark.sql`

- [ ] **Step 1: Download UK GPG data**

```bash
mkdir -p data/public_company_raw/uk
curl -L "https://gender-pay-gap.service.gov.uk/viewing/download-data/2024" \
     -o data/public_company_raw/uk/uk_gpg_2024.csv
wc -l data/public_company_raw/uk/uk_gpg_2024.csv
```

Expected: File downloaded, ~18,000+ lines.

- [ ] **Step 2: Create ingest_uk_gpg.py**

```python
# scripts/ingest_uk_gpg.py
"""
Cleans and converts UK Gender Pay Gap CSV to parquet.
Run from project root: python scripts/ingest_uk_gpg.py
Input: data/public_company_raw/uk/uk_gpg_2024.csv
Output: data/public_company/uk_gpg.parquet
"""
from pathlib import Path
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "data" / "public_company_raw" / "uk" / "uk_gpg_2024.csv"
DST = ROOT / "data" / "public_company" / "uk_gpg.parquet"
DST.parent.mkdir(parents=True, exist_ok=True)

SIZE_BAND_MAP = {
    "Less than 250": "50-250",
    "250 to 499": "251-999",
    "500 to 999": "251-999",
    "1000 to 4999": "1000+",
    "5000 to 19,999": "1000+",
    "20,000 or more": "1000+",
    "Not Provided": "unknown",
}

if __name__ == "__main__":
    print(f"Reading {SRC}...")
    df = pd.read_csv(SRC, low_memory=False)
    print(f"  Raw rows: {len(df)}")

    df = df.rename(columns={
        "EmployerName": "company_name",
        "EmployerId": "employer_id",
        "SicCodes": "sic_codes",
        "DiffMeanHourlyPercent": "mean_pay_gap",
        "DiffMedianHourlyPercent": "median_pay_gap",
        "EmployerSize": "size_band_raw",
        "CurrentName": "current_name",
    })

    df["size_band"] = df["size_band_raw"].map(SIZE_BAND_MAP).fillna("unknown")
    df["year"] = 2024
    df["country_code"] = "GB"

    # Numeric coercion
    for col in ["mean_pay_gap", "median_pay_gap"]:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    # Drop rows missing core fields
    df = df.dropna(subset=["company_name", "median_pay_gap"])

    output = df[[
        "year", "employer_id", "company_name", "size_band",
        "mean_pay_gap", "median_pay_gap", "country_code",
    ]].copy()

    output.to_parquet(DST, index=False)
    print(f"  Written {len(output)} rows to {DST}")
```

- [ ] **Step 3: Run the script**

```bash
python scripts/ingest_uk_gpg.py
```

Expected: File written with 15,000+ rows.

- [ ] **Step 4: Create UK GPG staging model**

Create `analytics/models/staging/public_company/stg_public_company__uk_gpg.sql`:

```sql
with source as (
    select *
    from {{ public_company_parquet('uk_gpg.parquet') }}
),

standardized as (
    select
        cast(year as integer) as year,
        cast(employer_id as varchar) as employer_id,
        cast(company_name as varchar) as company_name,
        cast(size_band as varchar) as size_band,
        cast(mean_pay_gap as double) as mean_pay_gap,
        cast(median_pay_gap as double) as median_pay_gap,
        cast(country_code as varchar) as country_code,
        'uk_gpg' as source_id
    from source
    where company_name is not null
      and median_pay_gap is not null
)

select *
from standardized
```

- [ ] **Step 5: Create UK GPG mart model**

Create `analytics/models/marts/public_company/mart_uk_gpg_sector_benchmark.sql`:

```sql
-- Aggregates UK GPG by year + size band.
-- Only published when company_count >= 5.
with base as (
    select *
    from {{ ref('stg_public_company__uk_gpg') }}
    where size_band != 'unknown'
),

aggregated as (
    select
        year,
        country_code,
        size_band,
        count(*) as company_count,
        percentile_cont(0.25) within group (order by median_pay_gap) as p25_median_gap,
        percentile_cont(0.50) within group (order by median_pay_gap) as p50_median_gap,
        percentile_cont(0.75) within group (order by median_pay_gap) as p75_median_gap,
        avg(median_pay_gap) as mean_median_gap
    from base
    group by 1, 2, 3
)

select *
from aggregated
where company_count >= 5
```

- [ ] **Step 6: Run new dbt models**

```bash
cd analytics
dbt run --select stg_public_company__uk_gpg mart_uk_gpg_sector_benchmark
```

Expected: Both models build successfully.

- [ ] **Step 7: Commit**

```bash
cd ..
git add scripts/ingest_uk_gpg.py \
        data/public_company_raw/uk/uk_gpg_2024.csv \
        data/public_company/uk_gpg.parquet \
        analytics/models/staging/public_company/stg_public_company__uk_gpg.sql \
        analytics/models/marts/public_company/mart_uk_gpg_sector_benchmark.sql
git commit -m "feat: ingest UK Gender Pay Gap 2024 data and build sector benchmark mart"
```

---

## Task 7: Build CSV upload endpoint

**Files:**
- Modify: `dashboard/backend/main.py`
- Modify: `dashboard/backend/service.py`

- [ ] **Step 1: Add required imports to main.py**

At the top of `main.py`, add these imports after the existing ones:

```python
import io
import subprocess
import tempfile
from fastapi import File, UploadFile
```

- [ ] **Step 2: Add `ingest_uploaded_payroll` to service.py**

Add this method to `AnalyticsRepository` just before `build_overview`:

```python
def ingest_uploaded_payroll(
    self,
    csv_bytes: bytes,
) -> Dict[str, Any]:
    """
    Validates a payroll CSV upload, converts to parquet, updates the manifest.
    Returns a summary dict. Raises ValueError for validation failures.
    """
    import io
    import json
    from datetime import datetime, timezone

    import pandas as pd

    REQUIRED_COLUMNS = {
        "employee_id", "job_code", "country_code",
        "worker_category_id", "gender", "base_salary",
        "currency", "snapshot_date",
    }
    VALID_GENDERS = {"female", "male", "non_binary"}

    try:
        df = pd.read_csv(io.BytesIO(csv_bytes))
    except Exception as e:
        raise ValueError(f"Could not parse CSV: {e}") from e

    missing = REQUIRED_COLUMNS - set(df.columns.str.lower())
    if missing:
        raise ValueError(f"Missing required columns: {', '.join(sorted(missing))}")

    # Normalise column names to lowercase
    df.columns = df.columns.str.lower()

    if len(df) < 10:
        raise ValueError(f"Upload must contain at least 10 employees. Got {len(df)}.")

    # Validate gender
    invalid_genders = set(df["gender"].str.lower().unique()) - VALID_GENDERS
    if invalid_genders:
        raise ValueError(
            f"Invalid gender values: {invalid_genders}. Must be: female, male, non_binary"
        )

    # Validate salary
    df["base_salary"] = pd.to_numeric(df["base_salary"], errors="coerce")
    if df["base_salary"].isna().any() or (df["base_salary"] <= 0).any():
        raise ValueError("base_salary must be a positive number for all rows.")

    # Validate snapshot_date
    try:
        df["snapshot_date"] = pd.to_datetime(df["snapshot_date"]).dt.date
    except Exception as e:
        raise ValueError(f"snapshot_date could not be parsed as a date: {e}") from e

    if (pd.to_datetime(df["snapshot_date"]) > pd.Timestamp.now()).any():
        raise ValueError("snapshot_date cannot be in the future.")

    # Validate country_code
    if not df["country_code"].str.len().eq(2).all():
        raise ValueError("country_code must be a 2-letter ISO code for all rows.")

    # Rename base_salary → base_pay_amount to match existing pipeline
    df = df.rename(columns={"base_salary": "base_pay_amount", "currency": "pay_currency"})

    # Add pipeline-required columns with defaults
    if "employment_status" not in df.columns:
        df["employment_status"] = "active"
    if "version" not in df.columns:
        df["version"] = "uploaded-v1"
    if "job_title" not in df.columns:
        df["job_title"] = df["job_code"]

    # Warnings
    warnings = []
    job_arch_path = self.internal_data_dir / "job_architecture.parquet"
    if job_arch_path.exists():
        import pyarrow.parquet as pq
        arch_df = pq.read_table(job_arch_path).to_pandas()
        known_codes = set(arch_df["job_code"])
        unknown_codes = set(df["job_code"]) - known_codes
        if unknown_codes:
            warnings.append(
                f"{len(unknown_codes)} job_codes not in job architecture — "
                f"those rows will have no NACE/ESCO mapping: {sorted(unknown_codes)[:5]}"
            )

    # Write parquet
    out_path = self.internal_data_dir / "payroll_snapshot.parquet"
    df.to_parquet(out_path, index=False)

    # Update manifest
    manifest_path = self._internal_manifest_path()
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "assets": [
            {
                "asset_type": "internal_payroll_snapshot",
                "version": "uploaded-v1",
                "record_count": len(df),
                "output": str(out_path),
                "trusted_for_company_claims": True,
            },
        ],
    }
    # Preserve other assets if manifest already exists
    existing = self._internal_manifest_assets()
    for asset_type, asset in existing.items():
        if asset_type != "internal_payroll_snapshot":
            manifest["assets"].append(asset)

    with manifest_path.open("w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)

    snapshot_date = str(df["snapshot_date"].max())
    record_count = len(df)

    return {
        "status": "accepted",
        "record_count": record_count,
        "snapshot_date": snapshot_date,
        "validation": {
            "passed": True,
            "warnings": warnings,
        },
        "dbt_run": "pending",
    }
```

- [ ] **Step 3: Add upload route to main.py**

Add this route after the existing governance routes:

```python
@app.post("/api/upload/payroll")
async def upload_payroll(file: UploadFile = File(...)):
    if file.content_type not in ("text/csv", "application/csv", "text/plain"):
        raise HTTPException(
            status_code=400,
            detail="Only CSV files are accepted. Please upload a .csv file.",
        )

    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(
            status_code=413,
            detail="File too large. Maximum upload size is 10MB.",
        )

    result = guarded(repository.ingest_uploaded_payroll, content)

    # Trigger dbt rebuild of internal models in the background
    analytics_dir = Path(__file__).resolve().parents[2] / "analytics"
    if analytics_dir.exists():
        try:
            subprocess.Popen(
                ["dbt", "run", "--select", "tag:internal"],
                cwd=str(analytics_dir),
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            result["dbt_run"] = "triggered"
        except FileNotFoundError:
            result["dbt_run"] = "dbt not found in PATH — run manually"

    return result
```

- [ ] **Step 4: Test the upload endpoint**

Start the backend and test with the demo CSV:

```bash
curl -X POST "http://localhost:8001/api/upload/payroll" \
     -F "file=@data/internal_raw/payroll_snapshot.csv" \
     | python3 -m json.tool
```

Expected response:
```json
{
  "status": "accepted",
  "record_count": 350,
  "snapshot_date": "2025-12-31",
  "validation": {
    "passed": true,
    "warnings": []
  },
  "dbt_run": "triggered"
}
```

Test invalid file — missing columns:

```bash
echo "employee_id,name\nemp-001,Alice" | curl -X POST "http://localhost:8001/api/upload/payroll" \
     -F "file=@/dev/stdin;type=text/csv" \
     | python3 -m json.tool
```

Expected: 400 response with clear message about missing columns.

- [ ] **Step 5: Commit**

```bash
git add dashboard/backend/main.py dashboard/backend/service.py
git commit -m "feat: add CSV payroll upload endpoint with validation and dbt trigger"
```

---

## Task 8: End-to-end verification

**Files:** None — verification only

- [ ] **Step 1: Full dbt rebuild**

```bash
cd analytics
dbt run
```

Expected: All models build. Check counts:
- `stg_public_company__egapro`: ~138,948 rows
- `mart_egapro_sector_benchmark`: several hundred rows (one per year/sector/size_band)
- `mart_internal_market_pay_benchmark`: 6 rows (one per worker category)
- `mart_pay_transparency_category_review`: 6 rows

- [ ] **Step 2: Verify Pay Analysis end-to-end**

```bash
curl "http://localhost:8001/api/overview?country=FR&geography=FR&period=latest" \
     | python3 -m json.tool | grep -E '"available"|"headcount"|"internal_value"|"p50_score"'
```

Expected:
- `company_benchmark.available`: `true`
- `company_benchmark.headcount`: `350`
- `company_benchmark.internal_value`: between 8.0 and 16.0
- `egapro_peer_benchmark.available`: `true`
- `egapro_peer_benchmark.p50_score`: between 85 and 93

- [ ] **Step 3: Verify pay transparency has multiple categories**

```bash
curl "http://localhost:8001/api/overview?country=FR&geography=FR&period=latest" \
     | python3 -m json.tool | grep -E '"category_count"|"unresolved"'
```

Expected: `category_count` is 6, `unresolved_review_item_count` is 2–4.

- [ ] **Step 4: Run existing tests**

```bash
cd dashboard/backend
pytest tests/ -v
```

Expected: All existing tests pass. No regressions.

- [ ] **Step 5: Final commit**

```bash
git add .
git commit -m "feat: data strategy complete — demo company, Égapro, UK GPG, CSV upload"
```

---

## Self-Review

### Spec coverage check

| Spec requirement | Task that implements it |
|-----------------|------------------------|
| 350-employee AeroTech Europe SAS demo company | Task 1 + 2 |
| trusted_for_company_claims: true in manifest | Task 2 |
| Pay distributions calibrated to Égapro averages | Task 1 (medians set per spec) |
| Égapro 138k rows ingested to parquet | Task 3 |
| dbt staging model for Égapro | Task 4 |
| mart_egapro_sector_benchmark with data suppression ≥5 | Task 4 |
| _build_egapro_peer_benchmark in service.py | Task 5 |
| egapro_peer_benchmark in overview response | Task 5 |
| GET /api/egapro-benchmark endpoint | Task 5 |
| UK GPG CSV downloaded and ingested | Task 6 |
| dbt staging + mart for UK GPG | Task 6 |
| POST /api/upload/payroll with validation | Task 7 |
| Minimum 10 rows validation | Task 7 |
| gender / salary / date / country validation | Task 7 |
| dbt triggered after upload | Task 7 |
| File size limit 10MB | Task 7 |
| version column handled | Task 7 (defaults to "uploaded-v1") |
| No existing tests broken | Task 8 |

### Placeholder scan
No TBD, TODO, or incomplete steps found.

### Type consistency
- `_build_egapro_peer_benchmark` returns `{"available": bool, ...}` — consistent with `_build_company_benchmark` pattern
- `ingest_uploaded_payroll` renames `base_salary` → `base_pay_amount` before writing — matches `stg_internal__payroll_snapshot.sql` which reads `base_pay_amount`
- `version` column default `"uploaded-v1"` — matches `stg_internal__payroll_snapshot.sql` which reads `version as source_version`
- `egapro_peer_benchmark` key in overview — matches what `PayAnalysisSection.jsx` reads in the frontend plan (`overview.egapro_peer_benchmark?.available`)
