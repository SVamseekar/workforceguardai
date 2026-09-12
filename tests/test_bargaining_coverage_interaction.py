from __future__ import annotations

import sys
import unittest
from pathlib import Path

import pandas as pd


ROOT_DIR = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = ROOT_DIR / "scripts"
RESEARCH_DIR = ROOT_DIR / "analytics" / "research"

if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from bargaining_coverage_interaction import (  # noqa: E402
    EU27_COUNTRY_CODES,
    PRIMARY_PANEL_YEARS,
    build_interaction_panel,
    fit_binary_split_interaction,
    fit_continuous_interaction,
    fit_split_sample,
    institutional_gating_confirmed,
    load_bargaining_coverage,
    load_country_year_panel,
)


def _synthetic_panel() -> pd.DataFrame:
    rows = []
    for country, barg, intercept in [
        ("AA", 20.0, 12.0),
        ("BB", 40.0, 11.0),
        ("CC", 70.0, 9.0),
        ("DD", 90.0, 8.0),
    ]:
        for year, emp in [(2019, 70.0), (2020, 72.0), (2021, 74.0), (2022, 76.0)]:
            rows.append(
                {
                    "country_code": country,
                    "country_name": country,
                    "year": year,
                    "employment_rate": emp,
                    "gender_pay_gap": intercept + 0.05 * emp,
                    "barg_cov": barg,
                }
            )
    return pd.DataFrame(rows)


class BargainingCoverageInteractionTests(unittest.TestCase):
    def test_committed_adjcov_covers_all_eu27_member_states(self):
        frame = load_bargaining_coverage(RESEARCH_DIR / "ictwss_eu27_adjcov.csv")
        self.assertEqual(set(frame["country_code"]), set(EU27_COUNTRY_CODES))
        self.assertEqual(len(frame), 27)

    def test_committed_adjcov_uses_one_decimal_percent(self):
        frame = load_bargaining_coverage(RESEARCH_DIR / "ictwss_eu27_adjcov.csv")
        rounded = frame["adjcov_pct"].round(1)
        pd.testing.assert_series_equal(
            frame["adjcov_pct"], rounded, check_names=False
        )

    def test_spain_has_explicit_provenance_note(self):
        frame = load_bargaining_coverage(RESEARCH_DIR / "ictwss_eu27_adjcov.csv")
        spain = frame.loc[frame["country_code"] == "ES"].iloc[0]
        self.assertTrue(str(spain["note"]).strip())
        self.assertIn("Eurofound", str(spain["source"]))

    def test_interaction_column_is_employment_times_coverage(self):
        panel = pd.DataFrame(
            [
                {
                    "country_code": "DE",
                    "year": 2019,
                    "employment_rate": 80.0,
                    "gender_pay_gap": 18.0,
                }
            ]
        )
        barg = pd.DataFrame(
            [{"country_code": "DE", "country_name": "Germany", "adjcov_pct": 52.0}]
        )
        merged = build_interaction_panel(panel, barg)
        self.assertEqual(merged.loc[0, "barg_cov"], 52.0)
        self.assertEqual(merged.loc[0, "tightness_x_bargcov"], 80.0 * 52.0)

    def test_panel_loader_keeps_2019_2024_only(self):
        path = RESEARCH_DIR / "panel_country_year.csv"
        frame = load_country_year_panel(path)
        self.assertTrue(set(frame["year"]).issubset(set(PRIMARY_PANEL_YEARS)))
        self.assertEqual(frame["country_code"].nunique(), 27)

    def test_continuous_interaction_returns_clustered_twfe_fields(self):
        result = fit_continuous_interaction(_synthetic_panel())
        self.assertEqual(result["n_countries"], 4)
        self.assertEqual(result["n"], 16)
        self.assertIn("coef_interaction", result)
        self.assertIn("pvalue_interaction", result)
        self.assertIn("ci95_low_interaction", result)
        self.assertIn("ci95_high_interaction", result)

    def test_binary_split_and_split_sample_share_the_same_median(self):
        frame = _synthetic_panel()
        median = frame.drop_duplicates("country_code")["barg_cov"].median()
        binary = fit_binary_split_interaction(frame, median)
        split = fit_split_sample(frame, median)
        self.assertEqual(binary["median_bargcov"], median)
        self.assertEqual({row["spec"] for row in split}, {"Above-median BargCov", "Below-median BargCov"})
        self.assertEqual(sum(row["n_countries"] for row in split), 4)

    def test_primary_null_does_not_confirm_institutional_gating(self):
        primary = {"pvalue_interaction": 0.28}
        secondary = {"pvalue_interaction_diff_in_slopes": 0.02}
        self.assertFalse(institutional_gating_confirmed(primary, secondary))

    def test_primary_significant_interaction_confirms_gating(self):
        primary = {"pvalue_interaction": 0.01}
        secondary = {"pvalue_interaction_diff_in_slopes": 0.40}
        self.assertTrue(institutional_gating_confirmed(primary, secondary))


if __name__ == "__main__":
    unittest.main()
