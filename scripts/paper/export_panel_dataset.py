#!/usr/bin/env python3
"""Export the Eurostat panel dataset used by the WorkforceGuard AI paper.

Reads the same warehouse (data/workforceguard_analytics.duckdb) the dashboard
backend queries, in read-only mode, and writes three replication CSVs to
data/paper_exports/.

Two structural quirks of fct_labour_market_region_sector this script has to
account for:

1. job_vacancy_rate and gender_pay_gap are only recorded at sector grain,
   never at the country-wide 'ALL' grain. mart_semantic_metrics.sql resolves
   this by falling back to a default sector per signal (A-S for vacancy,
   B-S for pay gap) when building country-level composite scores; the
   country-year panel export mirrors that same convention.
2. job_vacancy_rate, labour_market_slack_rate, labour_flow_to_employment,
   and labour_flow_to_inactivity are recorded quarterly (period_code like
   '2024-Q1'), while employment_rate, unemployment_rate, and gender_pay_gap
   are recorded annually (period_code like '2024'). The country-year panel
   averages the quarterly signals within each calendar year so every column
   lines up on the same year index.
"""
from __future__ import annotations

from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parents[2]
DB_PATH = ROOT / "data" / "workforceguard_analytics.duckdb"
EXPORT_DIR = ROOT / "data" / "paper_exports"

DEFAULT_VACANCY_SECTOR = "A-S"
DEFAULT_PAY_GAP_SECTOR = "B-S"

EXCLUDED_GEO_IDS = ("EU27_MEAN", "EU27_AVG", "EA19", "EA20")

COUNTRY_YEAR_SQL = f"""
with annual_country_signals as (
    select
        f.geo_id,
        f.period_code as year,
        max(case when f.signal_name = 'employment_rate' then f.signal_value end) as employment_rate,
        max(case when f.signal_name = 'unemployment_rate' then f.signal_value end) as unemployment_rate
    from fct_labour_market_region_sector f
    where f.period_type = 'year'
      and f.sector_id is null
      and f.geo_id not in {EXCLUDED_GEO_IDS}
    group by 1, 2
),
quarterly_country_signals as (
    select
        f.geo_id,
        split_part(f.period_code, '-Q', 1) as year,
        avg(case when f.signal_name = 'labour_market_slack_rate' then f.signal_value end) as labour_slack_rate,
        avg(case when f.signal_name = 'labour_flow_to_employment' then f.signal_value end) as flow_to_employment,
        avg(case when f.signal_name = 'labour_flow_to_inactivity' then f.signal_value end) as flow_to_inactivity
    from fct_labour_market_region_sector f
    where f.period_type = 'quarter'
      and f.sector_id is null
      and f.geo_id not in {EXCLUDED_GEO_IDS}
    group by 1, 2
),
default_sector_signals as (
    select
        f.geo_id,
        case
            when f.period_type = 'quarter' then split_part(f.period_code, '-Q', 1)
            else f.period_code
        end as year,
        avg(case when f.sector_id = '{DEFAULT_VACANCY_SECTOR}' and f.signal_name = 'job_vacancy_rate' then f.signal_value end) as job_vacancy_rate,
        avg(case when f.sector_id = '{DEFAULT_PAY_GAP_SECTOR}' and f.signal_name = 'gender_pay_gap' then f.signal_value end) as gender_pay_gap
    from fct_labour_market_region_sector f
    where f.sector_id is not null
      and f.geo_id not in {EXCLUDED_GEO_IDS}
    group by 1, 2
)
select
    a.geo_id as country_code,
    g.region_name as country_name,
    a.year,
    a.employment_rate,
    a.unemployment_rate,
    d.job_vacancy_rate,
    q.labour_slack_rate,
    q.flow_to_employment,
    q.flow_to_inactivity,
    d.gender_pay_gap
from annual_country_signals a
left join quarterly_country_signals q
    on a.geo_id = q.geo_id
   and a.year = q.year
left join default_sector_signals d
    on a.geo_id = d.geo_id
   and a.year = d.year
join dim_geography g
    on a.geo_id = g.geo_id
order by a.geo_id, a.year
"""

COUNTRY_SECTOR_YEAR_SQL = f"""
select
    f.geo_id as country_code,
    g.region_name as country_name,
    s.sector_name,
    case
        when f.period_type = 'quarter' then split_part(f.period_code, '-Q', 1)
        else f.period_code
    end as year,
    max(case when f.signal_name = 'gender_pay_gap' then f.signal_value end) as gender_pay_gap,
    avg(case when f.signal_name = 'job_vacancy_rate' then f.signal_value end) as vacancy_rate
from fct_labour_market_region_sector f
join dim_geography g
    on f.geo_id = g.geo_id
join dim_sector s
    on f.sector_id = s.sector_id
where f.sector_id is not null
  and f.geo_id not in {EXCLUDED_GEO_IDS}
group by 1, 2, 3, 4
order by f.geo_id, s.sector_name, year
"""

COMPOSITE_INDICES_SQL = f"""
select
    geo_id,
    sector_id,
    metric_id,
    metric_value,
    implementation_status,
    evidence_summary
from mart_semantic_metrics
where sector_id = 'ALL'
  and geo_id not in {EXCLUDED_GEO_IDS}
order by geo_id, metric_id
"""


def export_csv(con: duckdb.DuckDBPyConnection, sql: str, out_path: Path) -> "duckdb.DuckDBPyRelation":
    result = con.sql(sql)
    df = result.df()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(out_path, index=False)
    return df


def print_missingness(df, label: str, value_columns: list[str]) -> None:
    n_obs = len(df)
    print(f"\n{label}: n_obs={n_obs}")
    if "country_code" in df.columns:
        print(f"  n_countries={df['country_code'].nunique()}")
    if "year" in df.columns:
        print(f"  n_years={df['year'].nunique()}")
    for col in value_columns:
        if col not in df.columns:
            continue
        missing_pct = df[col].isna().mean() * 100
        print(f"  {col}: {missing_pct:.1f}% missing")


def main() -> None:
    if not DB_PATH.exists():
        raise SystemExit(f"Analytics warehouse not found at {DB_PATH}. Run dbt run first.")

    con = duckdb.connect(str(DB_PATH), read_only=True)

    panel_country_year = export_csv(
        con, COUNTRY_YEAR_SQL, EXPORT_DIR / "panel_country_year.csv"
    )
    panel_country_sector_year = export_csv(
        con, COUNTRY_SECTOR_YEAR_SQL, EXPORT_DIR / "panel_country_sector_year.csv"
    )
    composite_indices = export_csv(
        con, COMPOSITE_INDICES_SQL, EXPORT_DIR / "composite_indices.csv"
    )

    print("WorkforceGuard AI paper panel export")
    print_missingness(
        panel_country_year,
        "panel_country_year.csv",
        [
            "employment_rate",
            "unemployment_rate",
            "job_vacancy_rate",
            "labour_slack_rate",
            "flow_to_employment",
            "flow_to_inactivity",
            "gender_pay_gap",
        ],
    )
    print_missingness(
        panel_country_sector_year,
        "panel_country_sector_year.csv",
        ["gender_pay_gap", "vacancy_rate"],
    )
    print(f"\ncomposite_indices.csv: n_rows={len(composite_indices)}")
    print(f"  n_countries={composite_indices['geo_id'].nunique()}")
    print(f"  metrics={sorted(composite_indices['metric_id'].unique().tolist())}")


if __name__ == "__main__":
    main()
