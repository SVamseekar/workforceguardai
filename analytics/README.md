# WorkforceGuard Analytics Foundation

This folder is the beginning of the production-grade data layer for WorkforceGuard.

It is designed to support:
- trusted European labour-market metrics
- versioned business definitions
- explainable AI outputs
- compliance and governance features

## What is here

- `dbt_project.yml`
  The dbt project configuration
- `models/`
  Staging and mart models for the current Eurostat data
- `seeds/`
  Versioned reference data and metric registry files
- `macros/`
  Small helper macros for path and period handling
- `profiles.yml.example`
  Example local dbt profile for DuckDB
- `profiles.yml`
  Project-local DuckDB profile used for repo-scoped dbt commands

## Recommended local setup

```bash
python3 -m venv .venv-data
source .venv-data/bin/activate
pip install -r requirements-data.txt
```

## dbt profile

This repo ships with `analytics/profiles.yml`, so you can run dbt inside the workspace
without touching `~/.dbt`.

## Example commands

From the repo root:

```bash
./.venv-data/bin/dbt --project-dir analytics --profiles-dir analytics seed
./.venv-data/bin/dbt --project-dir analytics --profiles-dir analytics run
./.venv-data/bin/dbt --project-dir analytics --profiles-dir analytics test
```

## Current scope

This first iteration models the data already in `data/eu_raw` and creates:
- shared geography and sector dimensions
- a normalized labour-market fact table
- a metric registry that defines the first approved WorkforceGuard metrics
- live flow and slack inputs for stronger market-pressure reasoning
- internal staging and mart scaffolds for the first Phase 3 company-aware slice

## What comes next

Next production steps after this scaffold:
- run the internal data preparation flow for payroll snapshot and job architecture inputs
- build the internal dbt models into the DuckDB project
- move backend company-aware benchmarking to the modeled internal marts

## Reference data workflow

Reference assets are prepared in two steps:

1. Download the official ESCO files into `data/reference_raw/`
2. Run:

```bash
python3 scripts/prepare_reference_data.py
```

This produces canonical Parquet files and a manifest in `data/reference/` so later dbt
models can consume stable reference assets instead of brittle raw downloads.

## Internal company data workflow

Phase 3 begins with locally prepared internal data assets:

1. Place:
   - `data/internal_raw/payroll_snapshot.csv`
   - `data/internal_raw/job_architecture.csv`
   - optionally, `data/internal_raw/hris_workforce_snapshot.csv`
   - optionally, `data/internal_raw/ats_requisition_snapshot.csv`
   - optionally, `data/internal_raw/learning_skill_snapshot.csv`
2. Run:

```bash
python3 scripts/prepare_internal_company_data.py
```

This produces canonical Parquet files in `data/internal/` and a manifest in
`data/internal_meta/` so the internal staging and mart models can consume a stable local contract.
Optional HRIS, ATS, and learning/skills files stay empty until real employer exports are supplied.
The dashboard will not make company-specific claims from local sample rows. When the files are real
employer exports and approved for company-specific use, run:

```bash
python3 scripts/prepare_internal_company_data.py --trust-company-data
```

If you want dbt to build before real company CSVs are available, run:

```bash
python3 scripts/prepare_internal_company_data.py --write-empty-placeholders
```

That creates zero-row placeholder Parquet files so the internal models compile and run cleanly
without pretending company coverage exists.
