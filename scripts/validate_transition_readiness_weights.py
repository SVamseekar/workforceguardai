#!/usr/bin/env python3
"""Offline PCA validation for the Transition Readiness formula's weights.

Not a pytest test -- a one-off research script. Run once; its output
(this docstring's sibling markdown report) is what ships. The chosen
weights get hand-transcribed into mart_semantic_metrics.sql, the same
"offline-fit, hardcoded-in-production" pattern every other composite
score's coefficients in this codebase already use.

Usage: python scripts/validate_transition_readiness_weights.py
"""
from __future__ import annotations

import sys
from pathlib import Path

import duckdb
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
DB_PATH = ROOT / "data" / "workforceguard_analytics.duckdb"
REPORT_PATH = (
    ROOT
    / "docs"
    / "superpowers"
    / "specs"
    / "2026-09-11-transition-readiness-validation-results.md"
)

EXPLAINED_VARIANCE_THRESHOLD = 0.50


def fetch_signal(conn: duckdb.DuckDBPyConnection, signal_name: str) -> dict[str, float]:
    """Latest value per country for one signal_name."""
    rows = conn.execute(
        """
        with latest as (
            select geo_id, max(period_code) as period_code
            from fct_labour_market_region_sector
            where signal_name = ? and sector_id is null
            group by 1
        )
        select f.geo_id, f.signal_value
        from fct_labour_market_region_sector f
        inner join latest l
            on f.geo_id = l.geo_id and f.period_code = l.period_code
        where f.signal_name = ? and f.sector_id is null
        """,
        [signal_name, signal_name],
    ).fetchall()
    return {geo_id: value for geo_id, value in rows if value is not None}


def fetch_vacancy_rate_country(conn: duckdb.DuckDBPyConnection) -> dict[str, float]:
    """Country-wide job_vacancy_rate, per geo_id.

    `job_vacancy_rate` is only ever ingested at NACE-sector granularity in
    `fct_labour_market_region_sector` (there is no `sector_id is null` row for
    this signal -- confirmed by direct query: 0 rows across all countries).
    `fetch_signal()`'s plain `sector_id is null` filter therefore always
    returns empty for this one signal, which would make `build_panel()`'s
    country intersection empty for every run, regardless of real coverage.
    This replicates the exact same real-data fallback that
    `mart_semantic_metrics.sql`'s `default_sector_signals` /
    `geo_sector_letter_signals` CTEs already use in production (issue
    #31/#79: prefer the 'A-S' or 'B-S' whole-economy NACE rollup; if a
    country reports neither, average across its own reported single-letter
    NACE sections). No fabricated values -- only real, already-ingested
    signal rows.
    """
    rows = conn.execute(
        """
        with latest as (
            select geo_id, max(period_code) as period_code
            from fct_labour_market_region_sector
            where signal_name = 'job_vacancy_rate'
            group by 1
        ),
        latest_vacancy as (
            select f.geo_id, f.sector_id, f.signal_value
            from fct_labour_market_region_sector f
            inner join latest l
                on f.geo_id = l.geo_id and f.period_code = l.period_code
            where f.signal_name = 'job_vacancy_rate' and f.signal_value is not null
        )
        select
            geo_id,
            coalesce(
                max(case when sector_id = 'A-S' then signal_value end),
                max(case when sector_id = 'B-S' then signal_value end),
                avg(case when regexp_matches(sector_id, '^[A-Z]$') then signal_value end)
            ) as vacancy_rate
        from latest_vacancy
        group by 1
        """
    ).fetchall()
    return {geo_id: value for geo_id, value in rows if value is not None}


def build_panel(conn: duckdb.DuckDBPyConnection) -> tuple[list[str], np.ndarray]:
    digital = fetch_signal(conn, "digital_employer_share")
    green_fte = fetch_signal(conn, "green_sector_fte")
    employed = fetch_signal(conn, "employed_persons_total")
    unemployment = fetch_signal(conn, "unemployment_rate")
    employment = fetch_signal(conn, "employment_rate")
    continuity = fetch_signal(conn, "employment_continuity")
    vacancy = fetch_vacancy_rate_country(conn)
    slack = fetch_signal(conn, "labour_market_slack_rate")
    flow_emp = fetch_signal(conn, "labour_flow_to_employment")
    flow_inact = fetch_signal(conn, "labour_flow_to_inactivity")

    countries = sorted(set(digital) & set(green_fte) & set(employed) & set(unemployment) & set(employment) & set(vacancy))
    if len(countries) < 5:
        raise SystemExit(
            f"Only {len(countries)} countries have complete data for all required signals "
            "-- too few for a meaningful PCA. Investigate signal coverage before proceeding "
            "(see the 'Data currency, verified' note in the spec for why coverage may be sparse)."
        )

    rows = []
    for geo in countries:
        green_share = (green_fte[geo] / employed[geo]) * 100
        hiring_pressure_raw = (
            vacancy[geo] * 11
            + max(0, 9 - unemployment[geo]) * 4
            + (max(0, 12 - slack[geo]) * 2.8 if geo in slack else 0)
            + flow_emp.get(geo, 0) * 0.9
            + flow_inact.get(geo, 0) * 0.6
        )
        labour_resilience_raw = (
            employment[geo] * 0.95
            - unemployment[geo] * 3.8
            + continuity.get(geo, 0) * 0.3
        )
        hiring_pressure = min(100, max(0, round(hiring_pressure_raw)))
        labour_resilience = min(100, max(0, round(labour_resilience_raw)))
        rows.append([digital[geo], green_share, labour_resilience, 100 - hiring_pressure])

    return countries, np.array(rows, dtype=float)


def run_pca(matrix: np.ndarray) -> tuple[np.ndarray, float]:
    """Returns (PC1 loadings, PC1 explained-variance ratio)."""
    standardized = (matrix - matrix.mean(axis=0)) / matrix.std(axis=0, ddof=1)
    u, s, vt = np.linalg.svd(standardized, full_matrices=False)
    explained_variance_ratio = (s**2) / np.sum(s**2)
    pc1_loadings = vt[0]
    return pc1_loadings, float(explained_variance_ratio[0])


def pearson_correlation(xs: list[float], ys: list[float]) -> float | None:
    if len(xs) < 3:
        return None
    xs_arr, ys_arr = np.array(xs), np.array(ys)
    if xs_arr.std() == 0 or ys_arr.std() == 0:
        return None
    return float(np.corrcoef(xs_arr, ys_arr)[0, 1])


def main() -> None:
    if not DB_PATH.exists():
        raise SystemExit(f"Analytics DB not found at {DB_PATH}. Run dbt build first.")

    conn = duckdb.connect(str(DB_PATH), read_only=True)
    countries, matrix = build_panel(conn)
    # columns: digital_employer_share, green_demand_share, labour_resilience, inverse_hiring_pressure
    pc1_loadings, explained_variance = run_pca(matrix)

    abs_loadings = np.abs(pc1_loadings)
    normalized_weights = abs_loadings / abs_loadings.sum()
    w_digital, w_green, w_labour_resilience, w_hiring_pressure = normalized_weights

    used_pca = explained_variance >= EXPLAINED_VARIANCE_THRESHOLD
    if not used_pca:
        # Documented fallback: roughly preserve the existing 0.45/0.25/0.30
        # split across the now four real components (labour_resilience,
        # inverse-hiring-pressure share the old 0.45+0.25=0.70, split
        # proportionally to their original weights; digital/green share
        # the old 0.30 evenly).
        w_labour_resilience, w_hiring_pressure = 0.45, 0.25
        w_digital, w_green = 0.15, 0.15

    composite = (
        w_digital * matrix[:, 0]
        + w_green * matrix[:, 1]
        + w_labour_resilience * matrix[:, 2]
        + w_hiring_pressure * matrix[:, 3]
    )
    unemployment_values = [
        v for v in [fetch_signal(conn, "unemployment_rate").get(c) for c in countries] if v is not None
    ]
    correlation_vs_unemployment = pearson_correlation(list(composite), unemployment_values)

    implementation_status = "live" if used_pca else "proxy_live"

    report = f"""# Transition Readiness weight validation results

Generated by `scripts/validate_transition_readiness_weights.py`.
Panel: {len(countries)} countries ({', '.join(countries)}).

## PCA

PC1 explained variance: {explained_variance:.1%}
Decision rule: PC1 used if explained variance >= {EXPLAINED_VARIANCE_THRESHOLD:.0%}.
PCA-derived weights used: {used_pca}

## Weights

w_digital = {w_digital:.4f}
w_green = {w_green:.4f}
w_labour_resilience = {w_labour_resilience:.4f}
w_hiring_pressure = {w_hiring_pressure:.4f}
(sum = {w_digital + w_green + w_labour_resilience + w_hiring_pressure:.4f})

## Face-validity check

Correlation of composite score vs. unemployment_rate: {correlation_vs_unemployment}
(Expected direction: negative -- higher composite readiness should associate
with lower unemployment. A positive or near-zero correlation here doesn't
invalidate the weights, but should be noted honestly in
ref_metric_registry.csv's notes if it occurs.)

## IMPLEMENTATION_STATUS: {implementation_status}
"""
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text(report, encoding="utf-8")
    print(report)
    print(f"Report written to {REPORT_PATH}")


if __name__ == "__main__":
    main()
