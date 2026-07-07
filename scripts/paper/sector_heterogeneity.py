#!/usr/bin/env python3
"""Sector heterogeneity tests for the gender pay gap panel.

Tests whether the SSRN preprint's headline sector contrast (Finance ~24-25%
gap vs Construction ~-3%) reflects a statistically real difference, not just
a descriptive one.

dim_sector mixes disjoint single-letter NACE Rev.2 sections (A, B, C, ... S)
with multi-letter aggregate/rollup codes (A-S, B-E, B-N, O-Q, ...) that
double-count the same underlying activities. All tests here use only the
single-letter sectors to avoid that overlap.
"""
from __future__ import annotations

from pathlib import Path

import pandas as pd
from scipy import stats
from statsmodels.stats.multitest import multipletests

ROOT = Path(__file__).resolve().parents[2]
EXPORT_DIR = ROOT / "data" / "paper_exports"
TABLES_DIR = EXPORT_DIR / "tables"
FIGURES_DIR = EXPORT_DIR / "figures"

FINANCE_SECTOR = "Financial and insurance activities"
ICT_SECTOR = "Information and communication"

# Single-letter NACE Rev.2 sections only -- excludes multi-letter aggregate
# rollups (A-S, B-E, B-N, G-I, M_N, O-Q, O-S, R_S, B-S, B-F, B-S_X_O) that
# double-count the disjoint sectors below.
SINGLE_LETTER_SECTORS = set("ABCDEFGHIJKLMNOPQRS")


def load_sector_panel() -> pd.DataFrame:
    path = EXPORT_DIR / "panel_country_sector_year.csv"
    if not path.exists():
        raise SystemExit(f"{path} not found. Run scripts/paper/export_panel_dataset.py first.")
    df = pd.read_csv(path)

    sector_codes = _load_sector_code_map()
    df["sector_code"] = df["sector_name"].map(sector_codes)
    df = df[df["sector_code"].isin(SINGLE_LETTER_SECTORS)].copy()
    return df


def _load_sector_code_map() -> dict[str, str]:
    import duckdb

    db_path = ROOT / "data" / "workforceguard_analytics.duckdb"
    con = duckdb.connect(str(db_path), read_only=True)
    rows = con.execute("select sector_code, sector_name from dim_sector").fetchall()
    return {name: code for code, name in rows}


def build_sector_summary(df: pd.DataFrame) -> pd.DataFrame:
    summary = (
        df.groupby(["sector_name", "sector_code"])["gender_pay_gap"]
        .agg(mean_gpg="mean", sd_gpg="std", min_gpg="min", max_gpg="max", n="count")
        .reset_index()
        .sort_values("mean_gpg", ascending=False)
    )
    return summary


def run_anova(df: pd.DataFrame) -> tuple[float, float]:
    groups = [
        group["gender_pay_gap"].dropna().to_numpy()
        for _, group in df.groupby("sector_name")
        if group["gender_pay_gap"].notna().sum() > 1
    ]
    f_stat, p_value = stats.f_oneway(*groups)
    return f_stat, p_value


def run_pairwise_vs_finance(df: pd.DataFrame) -> pd.DataFrame:
    finance_values = df.loc[df["sector_name"] == FINANCE_SECTOR, "gender_pay_gap"].dropna()
    other_sectors = [s for s in df["sector_name"].unique() if s != FINANCE_SECTOR]

    rows = []
    pvalues = []
    for sector in other_sectors:
        other_values = df.loc[df["sector_name"] == sector, "gender_pay_gap"].dropna()
        if len(other_values) < 2 or len(finance_values) < 2:
            continue
        t_stat, p_value = stats.ttest_ind(finance_values, other_values, equal_var=False)
        rows.append(
            {
                "sector": sector,
                "mean_difference": finance_values.mean() - other_values.mean(),
                "t_stat": t_stat,
                "p_value": p_value,
            }
        )
        pvalues.append(p_value)

    result = pd.DataFrame(rows)
    if not result.empty:
        _, p_adj, _, _ = multipletests(result["p_value"], alpha=0.05, method="bonferroni")
        result["p_adj_bonferroni"] = p_adj
        result["significant_vs_finance"] = result["p_adj_bonferroni"] < 0.05
    return result.sort_values("mean_difference", ascending=False)


def run_sector_specific_fe(df: pd.DataFrame, all_sector_coef: float) -> pd.DataFrame:
    from linearmodels.panel import PanelOLS

    country_year_path = EXPORT_DIR / "panel_country_year.csv"
    panel = pd.read_csv(country_year_path)

    rows = []
    for sector_name, sector_code in [(FINANCE_SECTOR, "K"), (ICT_SECTOR, "J")]:
        sector_df = df[df["sector_name"] == sector_name][
            ["country_code", "year", "gender_pay_gap"]
        ].rename(columns={"gender_pay_gap": "sector_gender_pay_gap"})
        merged = panel.merge(sector_df, on=["country_code", "year"], how="inner")
        merged = merged.dropna(subset=["sector_gender_pay_gap", "employment_rate"])
        if merged["country_code"].nunique() < 3:
            rows.append({"sector": sector_name, "coefficient": None, "n": len(merged), "note": "insufficient countries"})
            continue

        merged["year_int"] = pd.to_numeric(merged["year"])
        merged = merged.set_index(["country_code", "year_int"])
        model = PanelOLS(
            merged["sector_gender_pay_gap"],
            merged[["employment_rate"]],
            entity_effects=True,
            time_effects=True,
        )
        try:
            result = model.fit(cov_type="clustered", cluster_entity=True)
            rows.append(
                {
                    "sector": sector_name,
                    "coefficient": result.params["employment_rate"],
                    "se": result.std_errors["employment_rate"],
                    "pvalue": result.pvalues["employment_rate"],
                    "n": int(result.nobs),
                }
            )
        except Exception as exc:  # insufficient rank/variation for this sector's sample
            rows.append({"sector": sector_name, "coefficient": None, "n": len(merged), "note": str(exc)})

    result_df = pd.DataFrame(rows)
    result_df["all_sector_coefficient"] = all_sector_coef
    return result_df


def plot_sector_bars(summary: pd.DataFrame, out_path: Path) -> None:
    import matplotlib.pyplot as plt

    ordered = summary.sort_values("mean_gpg", ascending=False)
    colors = [
        "#d62728" if row.sector_name == FINANCE_SECTOR
        else "#7f7f7f" if row.sector_code == "F"
        else "#1f77b4"
        for row in ordered.itertuples()
    ]

    fig, ax = plt.subplots(figsize=(7, 6))
    ax.barh(ordered["sector_code"], ordered["mean_gpg"], color=colors)
    eu27_avg = ordered["mean_gpg"].mean()
    ax.axvline(eu27_avg, color="black", linestyle="--", linewidth=1, label=f"Sample average ({eu27_avg:.1f}%)")
    ax.set_xlabel("Mean gender pay gap (%)")
    ax.set_ylabel("NACE Rev.2 section")
    ax.set_title("Gender pay gap by sector (single-letter NACE sections)")
    ax.legend()
    ax.invert_yaxis()
    fig.tight_layout()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(out_path, dpi=300)
    plt.close(fig)


def main() -> None:
    df = load_sector_panel()
    print(f"Sector panel (single-letter NACE only): {len(df)} rows, {df['sector_name'].nunique()} sectors")

    summary = build_sector_summary(df)
    TABLES_DIR.mkdir(parents=True, exist_ok=True)
    summary.to_csv(TABLES_DIR / "table3_sector_heterogeneity.csv", index=False)
    summary.to_latex(TABLES_DIR / "table3_sector_heterogeneity.tex", index=False)

    f_stat, anova_p = run_anova(df)
    print(f"\nANOVA: F = {f_stat:.2f}, p = {anova_p:.6f} — sectors "
          f"{'are' if anova_p < 0.05 else 'are not'} significantly different")

    pairwise = run_pairwise_vs_finance(df)
    pairwise.to_csv(TABLES_DIR / "table3b_finance_pairwise.csv", index=False)

    from linearmodels.panel import PanelOLS
    all_sector_panel = pd.read_csv(EXPORT_DIR / "panel_country_year.csv")
    all_sector_panel = all_sector_panel.dropna(subset=["gender_pay_gap", "employment_rate"])
    all_sector_panel["year_int"] = pd.to_numeric(all_sector_panel["year"])
    all_sector_panel = all_sector_panel.set_index(["country_code", "year_int"])
    all_sector_model = PanelOLS(
        all_sector_panel["gender_pay_gap"],
        all_sector_panel[["employment_rate"]],
        entity_effects=True,
        time_effects=True,
    ).fit(cov_type="clustered", cluster_entity=True)
    all_sector_coef = all_sector_model.params["employment_rate"]

    sector_fe = run_sector_specific_fe(df, all_sector_coef)
    sector_fe.to_csv(TABLES_DIR / "table3c_sector_specific_fe.csv", index=False)
    for _, row in sector_fe.iterrows():
        if pd.notna(row.get("coefficient")):
            print(f"{row['sector']} FE coefficient: {row['coefficient']:.3f} vs all-sector {all_sector_coef:.3f}")
        else:
            print(f"{row['sector']}: could not estimate ({row.get('note', 'unknown')})")

    plot_sector_bars(summary, FIGURES_DIR / "fig3_sector_gpg_bars.pdf")

    print(f"\nWrote {TABLES_DIR / 'table3_sector_heterogeneity.csv'}")
    print(f"Wrote {TABLES_DIR / 'table3b_finance_pairwise.csv'}")
    print(f"Wrote {TABLES_DIR / 'table3c_sector_specific_fe.csv'}")
    print(f"Wrote {FIGURES_DIR / 'fig3_sector_gpg_bars.pdf'}")


if __name__ == "__main__":
    main()
