#!/usr/bin/env python3
"""Robustness checks for the HPI weighting scheme and the panel FE result.

A. Alternative HPI weight sets — re-implements the HPI formula from
   mart_semantic_metrics.sql directly on the country-year panel (not the
   latest-period-only composite_indices.csv export), then compares three
   alternative weightings against it via Spearman rank correlation.
B. Time-window sensitivity — re-runs the Task 4 Model 2 FE spec on
   2019-2022 vs 2021-2024 subsamples.
C. Outlier exclusion — re-runs FE excluding Italy, Spain, and Construction.
D. Alternative tightness measure — re-runs FE with job_vacancy_rate in
   place of employment_rate.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd
from linearmodels.panel import PanelOLS
from scipy.stats import spearmanr

ROOT = Path(__file__).resolve().parents[2]
EXPORT_DIR = ROOT / "data" / "paper_exports"
TABLES_DIR = EXPORT_DIR / "tables"


def load_panel() -> pd.DataFrame:
    path = EXPORT_DIR / "panel_country_year.csv"
    if not path.exists():
        raise SystemExit(f"{path} not found. Run scripts/paper/export_panel_dataset.py first.")
    return pd.read_csv(path)


def compute_base_hpi(df: pd.DataFrame) -> pd.Series:
    """Re-implements the HPI formula from mart_semantic_metrics.sql."""
    vacancy = df["job_vacancy_rate"].fillna(0)
    unemployment = df["unemployment_rate"].fillna(0)
    slack = df["labour_slack_rate"]
    flow_emp = df["flow_to_employment"].fillna(0)
    flow_inact = df["flow_to_inactivity"].fillna(0)

    slack_term = np.where(slack.notna(), np.maximum(0, 12 - slack.fillna(0)) * 2.8, 0)

    raw = (
        vacancy * 11
        + np.maximum(0, 9 - unemployment) * 4
        + slack_term
        + flow_emp * 0.9
        + flow_inact * 0.6
    )
    return raw.clip(lower=0, upper=100).round()


def compute_hpi_equal(df: pd.DataFrame) -> pd.Series:
    """Equal weighting (w=1) across the same five components."""
    vacancy = df["job_vacancy_rate"].fillna(0)
    unemployment = df["unemployment_rate"].fillna(0)
    slack = df["labour_slack_rate"]
    flow_emp = df["flow_to_employment"].fillna(0)
    flow_inact = df["flow_to_inactivity"].fillna(0)

    slack_term = np.where(slack.notna(), np.maximum(0, 12 - slack.fillna(0)), 0)

    raw = vacancy + np.maximum(0, 9 - unemployment) + slack_term + flow_emp + flow_inact
    return raw.clip(lower=0)


def compute_hpi_vacancy_heavy(df: pd.DataFrame) -> pd.Series:
    """Vacancy-dominant weighting: vacancy_rate * 20, other terms halved."""
    vacancy = df["job_vacancy_rate"].fillna(0)
    unemployment = df["unemployment_rate"].fillna(0)
    slack = df["labour_slack_rate"]
    flow_emp = df["flow_to_employment"].fillna(0)
    flow_inact = df["flow_to_inactivity"].fillna(0)

    slack_term = np.where(slack.notna(), np.maximum(0, 12 - slack.fillna(0)) * 1.4, 0)

    raw = (
        vacancy * 20
        + np.maximum(0, 9 - unemployment) * 2
        + slack_term
        + flow_emp * 0.45
        + flow_inact * 0.3
    )
    return raw.clip(lower=0)


def compute_hpi_pca(df: pd.DataFrame, pc1_loadings: dict[str, float]) -> pd.Series:
    """PCA-weighted HPI using PC1 loadings from Task 3's pca_index_validation.py."""
    vacancy = df["job_vacancy_rate"].fillna(0)
    unemployment = df["unemployment_rate"].fillna(0)
    slack = df["labour_slack_rate"].fillna(0)
    flow_emp = df["flow_to_employment"].fillna(0)
    flow_inact = df["flow_to_inactivity"].fillna(0)

    raw = (
        vacancy * pc1_loadings["job_vacancy_rate"]
        + unemployment * pc1_loadings["unemployment_rate"]
        + slack * pc1_loadings["labour_slack_rate"]
        + flow_emp * pc1_loadings["flow_to_employment"]
        + flow_inact * pc1_loadings["flow_to_inactivity"]
    )
    return raw


def load_pc1_loadings() -> dict[str, float]:
    loadings_path = TABLES_DIR / "table_a2_factor_loadings.csv"
    if not loadings_path.exists():
        raise SystemExit(f"{loadings_path} not found. Run scripts/paper/pca_index_validation.py first.")
    loadings = pd.read_csv(loadings_path).set_index("signal")["PC1"].to_dict()
    return loadings


def robustness_a_weight_sets(df: pd.DataFrame) -> pd.DataFrame:
    base_hpi = compute_base_hpi(df)
    equal_hpi = compute_hpi_equal(df)
    vacancy_heavy_hpi = compute_hpi_vacancy_heavy(df)
    pc1_loadings = load_pc1_loadings()
    pca_hpi = compute_hpi_pca(df, pc1_loadings)

    variants = {
        "HPI_equal": equal_hpi,
        "HPI_vacancy_heavy": vacancy_heavy_hpi,
        "HPI_pca": pca_hpi,
    }

    rows = []
    for name, variant in variants.items():
        valid = base_hpi.notna() & variant.notna()
        rho, p_value = spearmanr(base_hpi[valid], variant[valid])
        rows.append({"hpi_variant": name, "spearman_rho": rho, "p_value": p_value, "n": int(valid.sum())})

    return pd.DataFrame(rows)


def _fit_fe(panel: pd.DataFrame, tightness_col: str = "employment_rate") -> dict:
    clean = panel.dropna(subset=["gender_pay_gap", tightness_col]).copy()
    clean["year_int"] = pd.to_numeric(clean["year"])
    clean = clean.set_index(["country_code", "year_int"])
    if clean.index.get_level_values(0).nunique() < 3 or len(clean) < 5:
        return {"coefficient": None, "se": None, "pvalue": None, "n": len(clean)}
    model = PanelOLS(clean["gender_pay_gap"], clean[[tightness_col]], entity_effects=True, time_effects=True)
    result = model.fit(cov_type="clustered", cluster_entity=True)
    return {
        "coefficient": result.params[tightness_col],
        "se": result.std_errors[tightness_col],
        "pvalue": result.pvalues[tightness_col],
        "n": int(result.nobs),
    }


def robustness_b_time_windows(df: pd.DataFrame) -> pd.DataFrame:
    full = _fit_fe(df)
    pre_covid = _fit_fe(df[df["year"].between(2019, 2022)])
    post_covid = _fit_fe(df[df["year"].between(2021, 2024)])

    rows = [
        {"specification": "Full sample (2019-2024)", **full},
        {"specification": "2019-2022", **pre_covid},
        {"specification": "2021-2024", **post_covid},
    ]
    return pd.DataFrame(rows)


def robustness_c_outlier_exclusion(df: pd.DataFrame) -> pd.DataFrame:
    full = _fit_fe(df)
    excl_italy_spain = _fit_fe(df[~df["country_code"].isin(["IT", "ES"])])

    sector_path = EXPORT_DIR / "panel_country_sector_year.csv"
    construction_note = "excludes Construction sector rows (not applicable to country-year panel)"

    rows = [
        {"specification": "Full sample", **full},
        {"specification": "Excluding Italy and Spain", **excl_italy_spain},
    ]
    print(f"\nNote: {construction_note} — the country-year panel has no sector dimension "
          "to exclude Construction from; this robustness cut applies to the country-sector "
          "panel used in Task 5 instead, not the Task 4 FE regression.")
    return pd.DataFrame(rows)


def robustness_d_alternative_tightness(df: pd.DataFrame) -> pd.DataFrame:
    employment_based = _fit_fe(df, tightness_col="employment_rate")
    vacancy_based = _fit_fe(df, tightness_col="job_vacancy_rate")

    rows = [
        {"tightness_measure": "employment_rate", **employment_based},
        {"tightness_measure": "job_vacancy_rate", **vacancy_based},
    ]
    return pd.DataFrame(rows)


def main() -> None:
    df = load_panel()

    table5a = robustness_a_weight_sets(df)
    table5a.to_csv(TABLES_DIR / "table5a_hpi_robustness.csv", index=False)
    print("Robustness A — HPI weight sets vs base formula:")
    print(table5a.to_string(index=False))

    table5b = robustness_b_time_windows(df)
    table5b.to_csv(TABLES_DIR / "table5b_time_window_robustness.csv", index=False)
    print("\nRobustness B — time window sensitivity:")
    print(table5b.to_string(index=False))

    table5c = robustness_c_outlier_exclusion(df)
    table5c.to_csv(TABLES_DIR / "table5c_outlier_robustness.csv", index=False)
    print("\nRobustness C — outlier exclusion:")
    print(table5c.to_string(index=False))

    table5d = robustness_d_alternative_tightness(df)
    table5d.to_csv(TABLES_DIR / "table5d_tightness_measure_robustness.csv", index=False)
    print("\nRobustness D — alternative tightness measure:")
    print(table5d.to_string(index=False))

    combined = pd.concat(
        [
            table5b.rename(columns={"specification": "row_label"}).assign(check="B_time_window"),
            table5c.rename(columns={"specification": "row_label"}).assign(check="C_outlier"),
            table5d.rename(columns={"tightness_measure": "row_label"}).assign(check="D_tightness_measure"),
        ],
        ignore_index=True,
    )
    combined = combined[["check", "row_label", "coefficient", "se", "pvalue", "n"]]
    combined.to_csv(TABLES_DIR / "table5_full_robustness.csv", index=False)
    combined.to_latex(TABLES_DIR / "table5_full_robustness.tex", index=False)

    print(f"\nWrote {TABLES_DIR / 'table5a_hpi_robustness.csv'}")
    print(f"Wrote {TABLES_DIR / 'table5b_time_window_robustness.csv'}")
    print(f"Wrote {TABLES_DIR / 'table5c_outlier_robustness.csv'}")
    print(f"Wrote {TABLES_DIR / 'table5d_tightness_measure_robustness.csv'}")
    print(f"Wrote {TABLES_DIR / 'table5_full_robustness.csv'}")
    print(f"Wrote {TABLES_DIR / 'table5_full_robustness.tex'}")


if __name__ == "__main__":
    main()
