# EU-Calibrated Dataset Generation

This repo generates EU-calibrated training datasets that preserve the original schemas of the four learning projects. EU reports are used as priors to shape distributions (see `RESEARCH_LOG.md` and `VARIABLES_MATRIX.md`).

## What This Produces
- EU-calibrated Parquet files for each dataset, per year (2019–2025)
- Link tables connecting each row to `year`, `nuts2`, and `company_id`
- Priors tables used to validate distributions

## Outputs
- `data/eu_calibrated/<dataset>/<year>.parquet`
- `data/links/<dataset>/<year>.parquet`
- `data/priors/nuts2_catalog.parquet`
- `data/priors/company_registry.parquet`
- `data/priors/region_year_priors.parquet`

## Run
```bash
python3 scripts/generate_eu_calibrated_data.py
```

## Dry Run (small sample)
```bash
python3 scripts/generate_eu_calibrated_data.py --dry-run
```

## Config
Update EU prior ranges in `configs/eu_priors.yaml` using values from EU reports.

## Notes
- Schemas are preserved (no new columns in the core datasets).
- Time series and geography are provided through link tables.
- Parquet requires `pyarrow`.
