"""Unit tests for Directive-aligned pay-gap heat metrics.

These lock the calculator contract: hourly conversion, mean and median,
variable pay, small-n suppression, and honest review labels.
"""

from __future__ import annotations

import unittest

from pay_gap_metrics import (
    MIN_CELL_SIZE,
    classify_review_state,
    enrich_payroll_rows,
    gender_pay_gap,
    hourly_rate,
    median,
    quartile_female_shares,
    review_state_label,
    sector_letter,
    summarise_category,
)


class HourlyRateTests(unittest.TestCase):
    def test_annual_salary_at_40_hours_is_salary_over_2080(self):
        self.assertAlmostEqual(hourly_rate(52000, "annual", 40), 25.0)

    def test_monthly_salary_uses_weeks_over_twelve(self):
        monthly = 4000
        expected = monthly / (40 * 52 / 12)
        self.assertAlmostEqual(hourly_rate(monthly, "monthly", 40), expected)

    def test_hourly_amount_is_unchanged(self):
        self.assertEqual(hourly_rate(18.5, "hourly", 40), 18.5)

    def test_missing_or_zero_hours_returns_none(self):
        self.assertIsNone(hourly_rate(52000, "annual", 0))
        self.assertIsNone(hourly_rate(None, "annual", 40))


class GenderPayGapTests(unittest.TestCase):
    def test_standard_unadjusted_gap(self):
        self.assertEqual(gender_pay_gap(male_avg=100, female_avg=88), 12.0)

    def test_returns_none_without_male_average(self):
        self.assertIsNone(gender_pay_gap(male_avg=0, female_avg=80))
        self.assertIsNone(gender_pay_gap(male_avg=None, female_avg=80))


class MedianTests(unittest.TestCase):
    def test_odd_and_even_lists(self):
        self.assertEqual(median([3, 1, 2]), 2.0)
        self.assertEqual(median([4, 1, 3, 2]), 2.5)

    def test_empty_is_none(self):
        self.assertIsNone(median([]))


class ClassifyReviewStateTests(unittest.TestCase):
    def test_small_n_is_insufficient_even_with_large_gap(self):
        self.assertEqual(
            classify_review_state(female_count=2, male_count=20, gap_pct=18.0),
            "insufficient_sample",
        )
        self.assertLessEqual(2, MIN_CELL_SIZE)

    def test_below_five_percent_is_below_trigger_not_justified(self):
        self.assertEqual(
            classify_review_state(female_count=8, male_count=8, gap_pct=3.2),
            "below_trigger",
        )
        self.assertNotEqual(
            classify_review_state(female_count=8, male_count=8, gap_pct=3.2),
            "justified_difference",
        )

    def test_five_to_ten_is_observed_gap(self):
        self.assertEqual(
            classify_review_state(female_count=8, male_count=8, gap_pct=7.4),
            "observed_gap",
        )

    def test_ten_or_more_needs_review(self):
        self.assertEqual(
            classify_review_state(female_count=8, male_count=8, gap_pct=10.0),
            "unresolved_review_item",
        )

    def test_market_delta_does_not_by_itself_mark_unresolved(self):
        # Heat from market comparison is a separate flag, not a legal state.
        self.assertEqual(
            classify_review_state(female_count=8, male_count=8, gap_pct=1.0),
            "below_trigger",
        )


class ReviewStateLabelTests(unittest.TestCase):
    def test_labels_are_human_and_honest(self):
        self.assertEqual(review_state_label("below_trigger"), "Below 5% trigger")
        self.assertEqual(review_state_label("insufficient_sample"), "Too few people to report")
        self.assertEqual(review_state_label("observed_gap"), "Pay gap identified")
        self.assertEqual(review_state_label("unresolved_review_item"), "Needs review")
        self.assertNotIn("justified", review_state_label("below_trigger").lower())


class SectorLetterTests(unittest.TestCase):
    def test_nace_code_maps_to_letter(self):
        self.assertEqual(sector_letter("J62"), "J")
        self.assertEqual(sector_letter("k64"), "K")
        self.assertIsNone(sector_letter(""))
        self.assertIsNone(sector_letter(None))


class EnrichPayrollRowsTests(unittest.TestCase):
    def test_defaults_annual_40_hours_and_zero_variable(self):
        rows = enrich_payroll_rows(
            [
                {
                    "employee_id": "e1",
                    "base_salary": 52000,
                    "gender": "female",
                }
            ]
        )
        row = rows[0]
        self.assertEqual(row["pay_frequency"], "annual")
        self.assertEqual(row["weekly_hours"], 40.0)
        self.assertEqual(row["variable_pay_amount"], 0.0)
        self.assertEqual(row["hours_basis"], "assumed_default")
        self.assertAlmostEqual(row["hourly_base"], 25.0)
        self.assertAlmostEqual(row["hourly_total"], 25.0)

    def test_reported_hours_and_variable_pay(self):
        rows = enrich_payroll_rows(
            [
                {
                    "employee_id": "e1",
                    "base_pay_amount": 40000,
                    "weekly_hours": 20,
                    "pay_frequency": "annual",
                    "variable_pay_amount": 4160,
                    "gender": "male",
                }
            ]
        )
        row = rows[0]
        self.assertEqual(row["hours_basis"], "reported")
        self.assertAlmostEqual(row["hourly_base"], 40000 / (20 * 52))
        self.assertAlmostEqual(row["hourly_variable"], 4160 / (20 * 52))
        self.assertAlmostEqual(row["hourly_total"], row["hourly_base"] + row["hourly_variable"])


class SummariseCategoryTests(unittest.TestCase):
    def _balanced_rows(self):
        female = [
            {
                "gender": "female",
                "hourly_base": 20 + i,
                "hourly_variable": 2,
                "hourly_total": 22 + i,
                "variable_pay_amount": 2000,
            }
            for i in range(5)
        ]
        male = [
            {
                "gender": "male",
                "hourly_base": 28 + i,
                "hourly_variable": 4,
                "hourly_total": 32 + i,
                "variable_pay_amount": 4000,
            }
            for i in range(5)
        ]
        return female + male

    def test_mean_and_median_and_variable_and_quartiles(self):
        summary = summarise_category(self._balanced_rows())
        self.assertEqual(summary["female_count"], 5)
        self.assertEqual(summary["male_count"], 5)
        self.assertIsNotNone(summary["mean_gap_total"])
        self.assertIsNotNone(summary["median_gap_total"])
        self.assertIsNotNone(summary["mean_gap_base"])
        self.assertIsNotNone(summary["median_gap_variable"])
        self.assertEqual(summary["female_variable_incidence_pct"], 100.0)
        self.assertEqual(summary["male_variable_incidence_pct"], 100.0)
        self.assertEqual(len(summary["quartile_female_share_pct"]), 4)
        self.assertEqual(summary["review_state"], "unresolved_review_item")
        self.assertEqual(summary["sample_status"], "reportable")

    def test_small_category_is_not_reportable(self):
        rows = [
            {"gender": "female", "hourly_base": 20, "hourly_variable": 0, "hourly_total": 20, "variable_pay_amount": 0},
            {"gender": "male", "hourly_base": 30, "hourly_variable": 0, "hourly_total": 30, "variable_pay_amount": 0},
        ]
        summary = summarise_category(rows)
        self.assertEqual(summary["review_state"], "insufficient_sample")
        self.assertIsNone(summary["mean_gap_total"])
        self.assertEqual(summary["sample_status"], "suppressed")


class QuartileShareTests(unittest.TestCase):
    def test_four_bands_from_sorted_pay(self):
        rows = [{"hourly_total": float(i), "gender": "female" if i < 4 else "male"} for i in range(8)]
        shares = quartile_female_shares(rows)
        self.assertEqual(len(shares), 4)
        self.assertTrue(all(0 <= value <= 100 for value in shares))


if __name__ == "__main__":
    unittest.main()
