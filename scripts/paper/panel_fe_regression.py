#!/usr/bin/env python3
"""Panel fixed-effects regression of gender pay gap on labour market tightness.

Produces the paper's main results table (Table 2), replacing the SSRN
preprint's single cross-sectional Pearson correlation (r = +0.41) with a
two-way fixed effects panel identification strategy.

Five specifications:
  1. Pooled OLS with year dummies (baseline, mirrors the original correlation)
  2. Country + year fixed effects (main result)
  3. FE with additional controls (unemployment_rate, job_vacancy_rate)
  4. First differences (alternative estimator, addresses unit-root concerns)
  5. FE with employment_rate lagged one year (addresses reverse causality)

Standard errors are clustered at the country level in every specification.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd
import statsmodels.formula.api as smf
from linearmodels.panel import FirstDifferenceOLS, PanelOLS, PooledOLS
from scipy import stats

ROOT = Path(__file__).resolve().parents[2]
EXPORT_DIR = ROOT / "data" / "paper_exports"
TABLES_DIR = EXPORT_DIR / "tables"


def load_and_clean_panel() -> pd.DataFrame:
    panel_path = EXPORT_DIR / "panel_country_year.csv"
    if not panel_path.exists():
        raise SystemExit(f"{panel_path} not found. Run scripts/paper/export_panel_dataset.py first.")

    df = pd.read_csv(panel_path)
    df = df.dropna(subset=["gender_pay_gap", "employment_rate"]).copy()
    df["year_int"] = pd.to_numeric(df["year"])
    df = df.sort_values(["country_code", "year_int"])
    df["lagged_employment_rate"] = df.groupby("country_code")["employment_rate"].shift(1)
    df = df.set_index(["country_code", "year_int"])
    return df


def fmt_stars(coef: float, pvalue: float) -> str:
    stars = "***" if pvalue < 0.01 else "**" if pvalue < 0.05 else "*" if pvalue < 0.1 else ""
    return f"{coef:.3f}{stars}"


def run_model_1_pooled_ols(df: pd.DataFrame) -> dict:
    flat = df.reset_index()
    model = smf.ols("gender_pay_gap ~ employment_rate + C(year_int)", data=flat)
    result = model.fit(cov_type="cluster", cov_kwds={"groups": flat["country_code"]})
    return {
        "name": "Model 1: Pooled OLS",
        "coef": result.params["employment_rate"],
        "se": result.bse["employment_rate"],
        "pvalue": result.pvalues["employment_rate"],
        "n": int(result.nobs),
        "r2": result.rsquared,
        "entity_fe": False,
        "time_fe": True,
    }


def run_model_2_country_fe(df: pd.DataFrame) -> tuple[dict, PanelOLS]:
    model = PanelOLS(
        df["gender_pay_gap"],
        df[["employment_rate"]],
        entity_effects=True,
        time_effects=True,
    )
    result = model.fit(cov_type="clustered", cluster_entity=True)
    summary = {
        "name": "Model 2: Country + Year FE (main result)",
        "coef": result.params["employment_rate"],
        "se": result.std_errors["employment_rate"],
        "pvalue": result.pvalues["employment_rate"],
        "n": int(result.nobs),
        "r2": result.rsquared,
        "r2_within": result.rsquared_within,
        "entity_fe": True,
        "time_fe": True,
    }
    return summary, result


def run_model_3_fe_with_controls(df: pd.DataFrame) -> dict:
    controls = df.dropna(subset=["unemployment_rate", "job_vacancy_rate"])
    model = PanelOLS(
        controls["gender_pay_gap"],
        controls[["employment_rate", "unemployment_rate", "job_vacancy_rate"]],
        entity_effects=True,
        time_effects=True,
    )
    result = model.fit(cov_type="clustered", cluster_entity=True)
    return {
        "name": "Model 3: FE with controls",
        "coef": result.params["employment_rate"],
        "se": result.std_errors["employment_rate"],
        "pvalue": result.pvalues["employment_rate"],
        "n": int(result.nobs),
        "r2": result.rsquared,
        "r2_within": result.rsquared_within,
        "entity_fe": True,
        "time_fe": True,
    }


def run_model_4_first_differences(df: pd.DataFrame) -> dict:
    model = FirstDifferenceOLS(df["gender_pay_gap"], df[["employment_rate"]])
    result = model.fit(cov_type="clustered", cluster_entity=True)
    return {
        "name": "Model 4: First differences",
        "coef": result.params["employment_rate"],
        "se": result.std_errors["employment_rate"],
        "pvalue": result.pvalues["employment_rate"],
        "n": int(result.nobs),
        "r2": result.rsquared,
        "entity_fe": False,
        "time_fe": False,
    }


def run_model_5_lagged(df: pd.DataFrame) -> dict:
    lagged = df.dropna(subset=["lagged_employment_rate"])
    model = PanelOLS(
        lagged["gender_pay_gap"],
        lagged[["lagged_employment_rate"]],
        entity_effects=True,
        time_effects=True,
    )
    result = model.fit(cov_type="clustered", cluster_entity=True)
    return {
        "name": "Model 5: Lagged employment rate",
        "coef": result.params["lagged_employment_rate"],
        "se": result.std_errors["lagged_employment_rate"],
        "pvalue": result.pvalues["lagged_employment_rate"],
        "n": int(result.nobs),
        "r2": result.rsquared,
        "r2_within": result.rsquared_within,
        "entity_fe": True,
        "time_fe": True,
    }


def run_hausman_test(df: pd.DataFrame) -> tuple[float, float]:
    """Hausman test comparing fixed effects vs random effects for Model 2's spec."""
    from linearmodels.panel import RandomEffects

    fe_model = PanelOLS(df["gender_pay_gap"], df[["employment_rate"]], entity_effects=True)
    fe_result = fe_model.fit()
    re_model = RandomEffects(df["gender_pay_gap"], df[["employment_rate"]])
    re_result = re_model.fit()

    b_fe = fe_result.params
    b_re = re_result.params
    cov_fe = fe_result.cov
    cov_re = re_result.cov

    diff = b_fe - b_re
    cov_diff = cov_fe - cov_re
    try:
        stat = float(diff.T @ np.linalg.inv(cov_diff.values) @ diff)
    except np.linalg.LinAlgError:
        stat = float(diff.T @ np.linalg.pinv(cov_diff.values) @ diff)
    dof = len(diff)
    p_value = 1 - stats.chi2.cdf(stat, dof)
    return stat, p_value


def run_country_fe_ftest(fe_result) -> tuple[float, float]:
    """F-test for joint significance of country fixed effects vs pooled OLS."""
    f_stat = fe_result.f_pooled.stat
    p_value = fe_result.f_pooled.pval
    return f_stat, p_value


def build_table2(models: list[dict]) -> pd.DataFrame:
    rows = []
    for m in models:
        rows.append(
            {
                "model": m["name"],
                "coefficient": fmt_stars(m["coef"], m["pvalue"]),
                "std_error": f"({m['se']:.3f})",
                "n": m["n"],
                "r_squared": f"{m['r2']:.3f}",
                "r_squared_within": f"{m.get('r2_within', float('nan')):.3f}" if "r2_within" in m else "",
                "entity_fe": "Yes" if m["entity_fe"] else "No",
                "time_fe": "Yes" if m["time_fe"] else "No",
            }
        )
    return pd.DataFrame(rows)


def export_latex(table: pd.DataFrame, out_path: Path) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    latex = table.to_latex(index=False, escape=True)
    out_path.write_text(latex)


def main() -> None:
    df = load_and_clean_panel()
    print(f"Panel: {len(df)} country-year observations, {df.index.get_level_values(0).nunique()} countries")

    model_1 = run_model_1_pooled_ols(df)
    model_2, fe_result = run_model_2_country_fe(df)
    model_3 = run_model_3_fe_with_controls(df)
    model_4 = run_model_4_first_differences(df)
    model_5 = run_model_5_lagged(df)

    models = [model_1, model_2, model_3, model_4, model_5]
    table2 = build_table2(models)

    TABLES_DIR.mkdir(parents=True, exist_ok=True)
    table2.to_csv(TABLES_DIR / "table2_panel_fe_results.csv", index=False)
    export_latex(table2, TABLES_DIR / "table2_panel_fe_results.tex")

    hausman_stat, hausman_p = run_hausman_test(df)
    ftest_stat, ftest_p = run_country_fe_ftest(fe_result)

    print(f"\nHausman test (FE vs RE): chi2 = {hausman_stat:.2f}, p = {hausman_p:.4f} "
          f"-> FE {'preferred' if hausman_p < 0.05 else 'not preferred over RE'}")
    print(f"F-test for country FE: F = {ftest_stat:.2f}, p = {ftest_p:.4f}")

    m2 = model_2
    direction = "increase" if m2["coef"] > 0 else "decrease"
    print(
        f"\nMAIN RESULT: Country+Year FE coefficient on employment_rate = {m2['coef']:.3f} "
        f"(SE = {m2['se']:.3f}, p = {m2['pvalue']:.4f}, N = {m2['n']}, "
        f"n_countries = {df.index.get_level_values(0).nunique()})"
    )
    print(
        f"Interpretation: A 1pp increase in employment rate is associated with a "
        f"{abs(m2['coef']):.3f}pp {direction} in gender pay gap, "
        f"{'confirming' if m2['coef'] > 0 else 'contradicting'} the SSRN preprint's r=+0.41 finding "
        "under panel fixed effects."
    )
    print(f"\nWrote {TABLES_DIR / 'table2_panel_fe_results.csv'}")
    print(f"Wrote {TABLES_DIR / 'table2_panel_fe_results.tex'}")


if __name__ == "__main__":
    main()
