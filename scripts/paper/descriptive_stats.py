#!/usr/bin/env python3
"""Descriptive statistics table (Table 1) for the WorkforceGuard AI paper.

Panel A: variable-level descriptive statistics across the full country-year
panel. Panel B: country-level means, sorted by mean HPI (tightest markets
first), joined from composite_indices.csv (latest-period snapshot).
"""
from __future__ import annotations

from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
EXPORT_DIR = ROOT / "data" / "paper_exports"
TABLES_DIR = EXPORT_DIR / "tables"

PANEL_A_VARIABLES = [
    "employment_rate",
    "unemployment_rate",
    "gender_pay_gap",
    "job_vacancy_rate",
    "labour_slack_rate",
]


def load_panel() -> pd.DataFrame:
    path = EXPORT_DIR / "panel_country_year.csv"
    if not path.exists():
        raise SystemExit(f"{path} not found. Run scripts/paper/export_panel_dataset.py first.")
    return pd.read_csv(path)


def build_panel_a(df: pd.DataFrame) -> pd.DataFrame:
    rows = []
    n_total = len(df)
    for col in PANEL_A_VARIABLES:
        series = df[col]
        n_non_missing = series.notna().sum()
        rows.append(
            {
                "variable": col,
                "n": n_non_missing,
                "mean": series.mean(),
                "sd": series.std(),
                "min": series.min(),
                "p25": series.quantile(0.25),
                "median": series.median(),
                "p75": series.quantile(0.75),
                "max": series.max(),
                "pct_missing": (1 - n_non_missing / n_total) * 100,
            }
        )
    return pd.DataFrame(rows)


def build_panel_b(df: pd.DataFrame) -> pd.DataFrame:
    composite_path = EXPORT_DIR / "composite_indices.csv"
    if not composite_path.exists():
        raise SystemExit(f"{composite_path} not found. Run scripts/paper/export_panel_dataset.py first.")
    composite = pd.read_csv(composite_path)
    composite_wide = composite.pivot(index="geo_id", columns="metric_id", values="metric_value")

    country_means = df.groupby("country_code").agg(
        mean_employment_rate=("employment_rate", "mean"),
        mean_gender_pay_gap=("gender_pay_gap", "mean"),
    )

    panel_b = country_means.join(composite_wide, how="left")
    panel_b = panel_b.rename(
        columns={
            "hiring_pressure_index": "mean_hpi",
            "equity_risk_score": "mean_ers",
        }
    )
    panel_b = panel_b[["mean_employment_rate", "mean_gender_pay_gap", "mean_hpi", "mean_ers"]]
    panel_b = panel_b.sort_values("mean_hpi", ascending=False).reset_index()
    panel_b = panel_b.rename(columns={"country_code": "country_code" if "country_code" in panel_b.columns else "geo_id"})
    return panel_b


def print_section_text(df: pd.DataFrame, panel_a: pd.DataFrame) -> None:
    n_countries = df["country_code"].nunique()
    n_years = df["year"].nunique()
    n_obs = len(df)

    gpg_row = panel_a.loc[panel_a["variable"] == "gender_pay_gap"].iloc[0]
    emp_row = panel_a.loc[panel_a["variable"] == "employment_rate"].iloc[0]

    missing_by_year = (
        df.assign(missing=df["employment_rate"].isna())
        .groupby("year")["missing"]
        .mean()
        .sort_values(ascending=False)
    )
    worst_year = missing_by_year.index[0] if missing_by_year.iloc[0] > 0 else None

    print("\n--- Text for Section 4.2 ---")
    print(
        f"The unbalanced panel covers {n_countries} countries, {n_years} years, and {n_obs} observations. "
        f"Mean gender pay gap across the sample is {gpg_row['mean']:.1f}% (SD={gpg_row['sd']:.1f}). "
        f"Mean employment rate is {emp_row['mean']:.1f}% (SD={emp_row['sd']:.1f}). "
        f"{emp_row['pct_missing']:.1f}% of employment_rate observations are missing"
        + (f", concentrated in {worst_year}." if worst_year else ".")
    )


def main() -> None:
    df = load_panel()

    panel_a = build_panel_a(df)
    TABLES_DIR.mkdir(parents=True, exist_ok=True)
    panel_a.to_csv(TABLES_DIR / "table1_descriptive_stats.csv", index=False)
    panel_a.to_latex(TABLES_DIR / "table1_descriptive_stats.tex", index=False, float_format="%.2f")

    panel_b = build_panel_b(df)
    panel_b.to_csv(TABLES_DIR / "table1b_country_means.csv", index=False)

    print("Table 1, Panel A: Descriptive statistics")
    print(panel_a.to_string(index=False))
    print("\nTable 1, Panel B: Country-level means (sorted by mean HPI)")
    print(panel_b.to_string(index=False))

    print_section_text(df, panel_a)

    print(f"\nWrote {TABLES_DIR / 'table1_descriptive_stats.csv'}")
    print(f"Wrote {TABLES_DIR / 'table1_descriptive_stats.tex'}")
    print(f"Wrote {TABLES_DIR / 'table1b_country_means.csv'}")


if __name__ == "__main__":
    main()
