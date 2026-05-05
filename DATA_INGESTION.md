# EU-Wide Real Data Ingestion (Eurostat)

This pipeline pulls **official EU-wide data** from the Eurostat Statistics API (JSON-stat). It is **free, programmatic, and real** (aggregated) data.

## What It Pulls
Defined in `configs/eu_sources.yaml`:
- Job vacancy rate (jvs_q_nace2)
- Unemployment rate (une_rt_a)
- Long-term unemployment (une_ltu_a)
- Employment rate (lfsi_emp_a)
- Labour market flows (lfsi_long_q)
- Labour market slack (lfsi_sla_q)
- Gender pay gap (earn_gr_gpgr2, earn_gr_gpgr2ag)
- At risk of poverty or social exclusion (ilc_peps01n)
- Median equivalised net income (ilc_di03)
- Gini coefficient (ilc_di12)
- Housing cost overburden (TESSI162/164/166)
- GDP per capita (nama_10_pc)
- Commuting time (lfso_19plwk28)

## Outputs
- `data/eu_raw/<dataset>.parquet` (tidy, long-format)
- `data/eu_meta/<dataset>.json` (dataset metadata: label, updated, dimensions)

## Run
```bash
pip install -r requirements-data.txt
python3 scripts/pull_eu_data.py
```

## Run A Subset
```bash
python3 scripts/pull_eu_data.py --datasets labour_market_flows labour_market_slack
```

## Dry Run (first dataset only)
```bash
python3 scripts/pull_eu_data.py --dry-run
```

## Notes
- This is **real aggregated EU data**, not synthetic.
- `configs/eu_sources.yaml` controls time range, geo list, and filters.
- If a filter does not exist in a dataset, it is skipped automatically.
- If you want EU-wide NUTS2, set `settings.geo.level: "nuts2"` and provide NUTS2 codes.
- Each run writes `data/eu_meta/manifest.json` so you can see which datasets succeeded or failed.

## ESCO Reference Preparation

The ESCO download experience is not a stable machine-oriented API, so WorkforceGuard
prepares official reference files after download instead of scraping the website.

1. Download the official ESCO CSV files and the official ESCO-NACE crosswalk.
2. Place them in `data/reference_raw/`.
3. Run:

```bash
python3 scripts/prepare_reference_data.py
```

This creates analytics-ready reference assets in `data/reference/`:
- `esco_occupations.parquet`
- `esco_skills.parquet`
- `esco_occupation_skill_relations.parquet`
- `esco_nace_crosswalk.parquet`

It also writes `data/reference/manifest.json` with record counts and missing inputs.
