#!/usr/bin/env python3
"""Two-way FE interaction of employment rate with ICTWSS bargaining coverage.

BargCov is a time-invariant country trait (latest pre-2019 AdjCov). Country
fixed effects absorb the main effect; the interaction is identified from
within-country employment-rate variation times cross-country BargCov.

Primary spec (Model 6):
    GPG_it = β1 EmpRate_it + β2 (EmpRate_it × BargCov_i) + γ_i + δ_t + ε_it

Secondary spec (Model 6b): binary above/below-median split on BargCov, plus
split-sample slopes. Institutional gating is confirmed only if the primary
continuous interaction is significant at 5%. A significant binary split
alone does not confirm gating.

Usage: python scripts/bargaining_coverage_interaction.py
"""
from __future__ import annotations

import argparse
from pathlib import Path
from typing import Any

import pandas as pd
from linearmodels.panel import PanelOLS


ROOT = Path(__file__).resolve().parents[1]
RESEARCH_DIR = ROOT / "analytics" / "research"

EU27_COUNTRY_CODES = (
    "AT",
    "BE",
    "BG",
    "CY",
    "CZ",
    "DE",
    "DK",
    "EE",
    "EL",
    "ES",
    "FI",
    "FR",
    "HR",
    "HU",
    "IE",
    "IT",
    "LT",
    "LU",
    "LV",
    "MT",
    "NL",
    "PL",
    "PT",
    "RO",
    "SE",
    "SI",
    "SK",
)
PRIMARY_PANEL_YEARS = (2019, 2020, 2021, 2022, 2023, 2024)
GATING_PVALUE = 0.05

_REQUIRED_PANEL = ("country_code", "year", "employment_rate", "gender_pay_gap")


def load_bargaining_coverage(path: Path | str) -> pd.DataFrame:
    frame = pd.read_csv(path)
    required = {"country_code", "country_name", "adjcov_pct", "source"}
    missing = required - set(frame.columns)
    if missing:
        raise ValueError(f"bargaining coverage file missing columns: {sorted(missing)}")
    frame = frame.copy()
    frame["adjcov_pct"] = frame["adjcov_pct"].astype(float).round(1)
    if "note" not in frame.columns:
        frame["note"] = ""
    frame["note"] = frame["note"].fillna("").astype(str)
    frame["source"] = frame["source"].fillna("").astype(str)
    return frame.reset_index(drop=True)


def load_country_year_panel(path: Path | str) -> pd.DataFrame:
    frame = pd.read_csv(path)
    missing = set(_REQUIRED_PANEL) - set(frame.columns)
    if missing:
        raise ValueError(f"country-year panel missing columns: {sorted(missing)}")
    frame = frame.loc[frame["year"].isin(PRIMARY_PANEL_YEARS)].copy()
    frame["year"] = frame["year"].astype(int)
    return frame.reset_index(drop=True)


def build_interaction_panel(panel: pd.DataFrame, barg: pd.DataFrame) -> pd.DataFrame:
    keep_barg = barg[["country_code", "adjcov_pct"]].copy()
    if "country_name" in barg.columns and "country_name" not in panel.columns:
        keep_barg["country_name"] = barg["country_name"]
    merged = panel.merge(keep_barg, on="country_code", how="inner")
    merged["barg_cov"] = merged["adjcov_pct"]
    merged["tightness_x_bargcov"] = merged["employment_rate"] * merged["barg_cov"]
    return merged.reset_index(drop=True)


def _ensure_interaction(frame: pd.DataFrame) -> pd.DataFrame:
    data = frame.copy()
    if "tightness_x_bargcov" not in data.columns:
        if "barg_cov" not in data.columns:
            raise ValueError("panel needs barg_cov or tightness_x_bargcov")
        data["tightness_x_bargcov"] = data["employment_rate"] * data["barg_cov"]
    return data


def _indexed(frame: pd.DataFrame, columns: list[str]) -> pd.DataFrame:
    data = frame.loc[:, ["country_code", "year", *columns]].copy()
    data = data.dropna()
    data["year"] = data["year"].astype(int)
    return data.set_index(["country_code", "year"]).sort_index()


def _ci_bounds(result: Any, term: str) -> tuple[float, float]:
    row = result.conf_int().loc[term]
    return float(row.iloc[0]), float(row.iloc[1])


def _param(result: Any, term: str, field: str = "params") -> float:
    table = getattr(result, field)
    if term not in table.index:
        return float("nan")
    return float(table[term])


def _fit_twfe(data: pd.DataFrame, formula: str) -> Any:
    # drop_absorbed keeps the estimator runnable when a synthetic panel has
    # no leftover within-cell variation after two-way demeaning (e.g. the
    # same employment path in every country). Real EU27 data is not absorbed.
    model = PanelOLS.from_formula(formula, data=data, drop_absorbed=True)
    return model.fit(cov_type="clustered", cluster_entity=True)


def fit_continuous_interaction(frame: pd.DataFrame) -> dict[str, Any]:
    data = _indexed(
        _ensure_interaction(frame),
        ["employment_rate", "gender_pay_gap", "tightness_x_bargcov"],
    )
    result = _fit_twfe(
        data,
        "gender_pay_gap ~ employment_rate + tightness_x_bargcov + EntityEffects + TimeEffects",
    )
    ci_low, ci_high = _ci_bounds(result, "tightness_x_bargcov")
    return {
        "spec": "Model 6: Two-way FE + tightness x BargCov interaction",
        "n": int(result.nobs),
        "n_countries": int(data.index.get_level_values(0).nunique()),
        "coef_employment_rate": _param(result, "employment_rate"),
        "se_employment_rate": _param(result, "employment_rate", "std_errors"),
        "pvalue_employment_rate": _param(result, "employment_rate", "pvalues"),
        "coef_interaction": _param(result, "tightness_x_bargcov"),
        "se_interaction": _param(result, "tightness_x_bargcov", "std_errors"),
        "pvalue_interaction": _param(result, "tightness_x_bargcov", "pvalues"),
        "ci95_low_interaction": ci_low,
        "ci95_high_interaction": ci_high,
        "r2_within": float(result.rsquared_within),
    }


def fit_binary_split_interaction(frame: pd.DataFrame, median: float) -> dict[str, Any]:
    data = frame.copy()
    data["high_barg"] = (data["barg_cov"] >= median).astype(float)
    data["emp_x_high_barg"] = data["employment_rate"] * data["high_barg"]
    indexed = _indexed(
        data,
        ["employment_rate", "gender_pay_gap", "emp_x_high_barg"],
    )
    result = _fit_twfe(
        indexed,
        "gender_pay_gap ~ employment_rate + emp_x_high_barg + EntityEffects + TimeEffects",
    )
    below = _param(result, "employment_rate")
    diff = _param(result, "emp_x_high_barg")
    return {
        "spec": "Model 6b (secondary): binary median-split BargCov interaction",
        "n": int(result.nobs),
        "n_countries": int(indexed.index.get_level_values(0).nunique()),
        "median_bargcov": float(median),
        "coef_employment_rate_below_median": below,
        "se_employment_rate_below_median": _param(
            result, "employment_rate", "std_errors"
        ),
        "pvalue_employment_rate_below_median": _param(
            result, "employment_rate", "pvalues"
        ),
        "coef_interaction_diff_in_slopes": diff,
        "se_interaction_diff_in_slopes": _param(
            result, "emp_x_high_barg", "std_errors"
        ),
        "pvalue_interaction_diff_in_slopes": _param(
            result, "emp_x_high_barg", "pvalues"
        ),
        "implied_above_median_slope": below + diff,
        "r2_within": float(result.rsquared_within),
    }


def fit_split_sample(frame: pd.DataFrame, median: float) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for label, mask in (
        ("Above-median BargCov", frame["barg_cov"] >= median),
        ("Below-median BargCov", frame["barg_cov"] < median),
    ):
        subset = frame.loc[mask]
        indexed = _indexed(subset, ["employment_rate", "gender_pay_gap"])
        n_countries = int(indexed.index.get_level_values(0).nunique())
        try:
            result = _fit_twfe(
                indexed,
                "gender_pay_gap ~ employment_rate + EntityEffects + TimeEffects",
            )
        except ValueError as exc:
            if "fully absorbed" not in str(exc):
                raise
            rows.append(
                {
                    "spec": label,
                    "n": int(len(indexed)),
                    "n_countries": n_countries,
                    "coef_employment_rate": float("nan"),
                    "se_employment_rate": float("nan"),
                    "pvalue_employment_rate": float("nan"),
                    "r2_within": float("nan"),
                }
            )
            continue
        rows.append(
            {
                "spec": label,
                "n": int(result.nobs),
                "n_countries": n_countries,
                "coef_employment_rate": _param(result, "employment_rate"),
                "se_employment_rate": _param(result, "employment_rate", "std_errors"),
                "pvalue_employment_rate": _param(result, "employment_rate", "pvalues"),
                "r2_within": float(result.rsquared_within),
            }
        )
    return rows


def institutional_gating_confirmed(
    primary: dict[str, Any],
    secondary: dict[str, Any] | None = None,
) -> bool:
    del secondary
    pvalue = primary.get("pvalue_interaction")
    if pvalue is None:
        return False
    return float(pvalue) < GATING_PVALUE


def _write_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    pd.DataFrame(rows).to_csv(path, index=False)


def run(research_dir: Path = RESEARCH_DIR) -> dict[str, Any]:
    barg = load_bargaining_coverage(research_dir / "ictwss_eu27_adjcov.csv")
    panel = load_country_year_panel(research_dir / "panel_country_year.csv")
    merged = build_interaction_panel(panel, barg)
    merged = merged.dropna(subset=["employment_rate", "gender_pay_gap", "barg_cov"])
    median = float(merged.drop_duplicates("country_code")["barg_cov"].median())
    primary = fit_continuous_interaction(merged)
    secondary = fit_binary_split_interaction(merged, median)
    split = fit_split_sample(merged, median)
    confirmed = institutional_gating_confirmed(primary, secondary)
    _write_csv(research_dir / "table_model6_interaction.csv", [primary])
    _write_csv(research_dir / "table_model6b_binary_split_interaction.csv", [secondary])
    _write_csv(research_dir / "table_model6_split_sample.csv", split)
    return {
        "primary": primary,
        "secondary": secondary,
        "split": split,
        "median_bargcov": median,
        "institutional_gating_confirmed": confirmed,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--research-dir",
        type=Path,
        default=RESEARCH_DIR,
        help="Directory with ictwss_eu27_adjcov.csv and panel_country_year.csv",
    )
    args = parser.parse_args()
    results = run(args.research_dir)
    primary = results["primary"]
    secondary = results["secondary"]
    print(primary["spec"])
    print(
        f"  interaction coef={primary['coef_interaction']:.4f} "
        f"p={primary['pvalue_interaction']:.3f} "
        f"N={primary['n']} countries={primary['n_countries']}"
    )
    print(secondary["spec"])
    print(
        f"  slope difference p={secondary['pvalue_interaction_diff_in_slopes']:.3f} "
        f"median BargCov={secondary['median_bargcov']:.1f}"
    )
    print(
        "institutional_gating_confirmed="
        f"{results['institutional_gating_confirmed']}"
    )
    if results["institutional_gating_confirmed"]:
        print("Primary interaction is significant; a product research view may be considered.")
    else:
        print(
            "Primary continuous interaction is not significant. "
            "Do not add a product composite or research view."
        )


if __name__ == "__main__":
    main()
