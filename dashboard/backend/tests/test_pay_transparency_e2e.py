"""End-to-end pay-gap heat: CSV ingest → parquet → classification → overview payload."""

from __future__ import annotations

import json
import os
import shutil
import sys
import tempfile
import unittest
from pathlib import Path

os.environ.setdefault("SESSION_SECRET", "test-secret-not-for-production-use-only")

import duckdb
import pandas as pd

ROOT_DIR = Path(__file__).resolve().parents[3]
BACKEND_DIR = ROOT_DIR / "dashboard" / "backend"
ANALYTICS_DB_PATH = ROOT_DIR / "data" / "workforceguard_analytics.duckdb"

if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from pay_gap_metrics import enrich_payroll_rows, summarise_category
from service import AnalyticsRepository


def _csv(rows: list[dict]) -> bytes:
    import csv
    import io

    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=list(rows[0].keys()))
    writer.writeheader()
    writer.writerows(rows)
    return buf.getvalue().encode()


def _people(n_female: int, n_male: int, female_pay: int = 50000, male_pay: int = 65000) -> list[dict]:
    rows = []
    for i in range(n_female):
        rows.append(
            {
                "employee_id": f"f-{i:03d}",
                "job_code": "SE-1",
                "country_code": "DE",
                "worker_category_id": "eng_ic",
                "gender": "female",
                "base_salary": female_pay + i * 100,
                "currency": "EUR",
                "snapshot_date": "2025-12-31",
                "weekly_hours": 40,
                "pay_frequency": "annual",
                "variable_pay_amount": 1000,
            }
        )
    for i in range(n_male):
        rows.append(
            {
                "employee_id": f"m-{i:03d}",
                "job_code": "SE-1",
                "country_code": "DE",
                "worker_category_id": "eng_ic",
                "gender": "male",
                "base_salary": male_pay + i * 100,
                "currency": "EUR",
                "snapshot_date": "2025-12-31",
                "weekly_hours": 40,
                "pay_frequency": "annual",
                "variable_pay_amount": 4000,
            }
        )
    return rows


class PayTransparencyHeatE2ETests(unittest.TestCase):
    def test_ingest_enriches_hourly_and_variable_columns(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            internal_dir = Path(temp_dir) / "internal"
            internal_dir.mkdir()
            repo = AnalyticsRepository(ROOT_DIR, internal_data_dir=internal_dir)
            result = repo.ingest_uploaded_payroll(_csv(_people(5, 5)))
            self.assertEqual(result["status"], "accepted")
            df = pd.read_parquet(internal_dir / "payroll_snapshot.parquet")
            self.assertTrue((df["hourly_total"] > 0).all())
            self.assertTrue((df["variable_pay_amount"] > 0).all())
            self.assertEqual(df["hours_basis"].iloc[0], "reported")

    def test_category_summary_from_uploaded_file_is_reportable_heat(self):
        rows = enrich_payroll_rows(_people(5, 5))
        summary = summarise_category(rows)
        self.assertEqual(summary["sample_status"], "reportable")
        self.assertEqual(summary["review_state"], "unresolved_review_item")
        self.assertIsNotNone(summary["mean_gap_total"])
        self.assertIsNotNone(summary["median_gap_total"])
        self.assertGreater(summary["male_variable_incidence_pct"], 0)

    def test_small_n_category_is_suppressed_in_overview(self):
        if not ANALYTICS_DB_PATH.exists():
            self.skipTest("Analytics DB not available")
        with tempfile.TemporaryDirectory() as temp_dir:
            db_path = Path(temp_dir) / "workforceguard_analytics.duckdb"
            shutil.copyfile(ANALYTICS_DB_PATH, db_path)
            with duckdb.connect(str(db_path)) as connection:
                connection.execute("drop view if exists stg_internal__payroll_snapshot")
                connection.execute(
                    """
                    create table stg_internal__payroll_snapshot as
                    select * from (
                        values
                            ('emp-1', 'SE-1', 'Software Engineer', 'DE', 'eng_ic', 'female', 90000, 'EUR', '2026-03-31'::date, 'active', 'local', 'internal_payroll_snapshot'),
                            ('emp-2', 'SE-1', 'Software Engineer', 'DE', 'eng_ic', 'male', 110000, 'EUR', '2026-03-31'::date, 'active', 'local', 'internal_payroll_snapshot')
                    ) as seeded(
                        employee_id, job_code, job_title, country_code, worker_category_id, gender,
                        base_pay_amount, pay_currency, snapshot_date, employment_status, source_version, dataset_name
                    )
                    """
                )
                connection.execute("drop view if exists stg_internal__job_architecture")
                connection.execute(
                    """
                    create table stg_internal__job_architecture as
                    select * from (
                        values
                            ('SE-1', 'Engineering', 'IC3', 'eng_ic', 'Engineering Individual Contributor', 'urn:esco:occupation:1', 'J62', 'local', 'internal_job_architecture')
                    ) as seeded(
                        job_code, job_family, job_level, worker_category_id, worker_category_label,
                        esco_uri, nace_code, source_version, dataset_name
                    )
                    """
                )
                connection.execute(
                    """
                    create or replace table fct_internal_pay_snapshot as
                    select * from (
                        values
                            ('DE::eng_ic::2026-03-31', 'DE', '2026-03-31'::date, 'eng_ic', 'J62', 'urn:esco:occupation:1', 'EUR', 2, 1, 1, 100000, 90000, 110000, NULL)
                    ) as seeded(
                        internal_pay_snapshot_id, country_code, snapshot_date, worker_category_id, nace_code,
                        esco_uri, pay_currency, headcount, female_count, male_count, avg_base_pay,
                        female_avg_base_pay, male_avg_base_pay, internal_gender_pay_gap
                    )
                    """
                )
                connection.execute(
                    """
                    create or replace table dim_worker_category as
                    select * from (
                        values
                            ('eng_ic', 'Engineering Individual Contributor', 'Engineering', 'IC3', 'urn:esco:occupation:1', 'J62', 1)
                    ) as seeded(
                        worker_category_id, worker_category_label, primary_job_family, representative_job_level,
                        representative_esco_uri, representative_nace_code, mapped_job_code_count
                    )
                    """
                )
                connection.execute(
                    """
                    create or replace table mart_internal_market_pay_benchmark as
                    select * from (
                        values
                            ('DE::eng_ic::2026-03-31', 'DE', '2026-03-31'::date, 'eng_ic', 'Engineering Individual Contributor',
                             'Engineering', 'IC3', 'J62', 2, 1, 1, 40.0, 'B-S', '2024', 18.0, 22.0, true)
                    ) as seeded(
                        benchmark_row_id, country_code, snapshot_date, worker_category_id, worker_category_label,
                        primary_job_family, representative_job_level, representative_nace_code, headcount,
                        female_count, male_count, internal_gender_pay_gap, market_sector_id, market_period_code,
                        market_gender_pay_gap, gap_to_market, market_benchmark_available
                    )
                    """
                )
            internal_dir = Path(temp_dir) / "internal"
            internal_dir.mkdir()
            manifest_dir = Path(temp_dir) / "internal_meta"
            manifest_dir.mkdir()
            (manifest_dir / "manifest.json").write_text(
                json.dumps(
                    {
                        "generated_at": "2026-03-31T00:00:00+00:00",
                        "assets": [
                            {
                                "asset_type": "internal_payroll_snapshot",
                                "version": "local",
                                "record_count": 2,
                                "output": str(internal_dir / "payroll_snapshot.parquet"),
                                "trusted_for_company_claims": True,
                            },
                            {
                                "asset_type": "internal_job_architecture",
                                "version": "local",
                                "record_count": 1,
                                "output": str(internal_dir / "job_architecture.parquet"),
                                "trusted_for_company_claims": True,
                            },
                        ],
                        "missing_inputs": [],
                    }
                )
            )
            repo = AnalyticsRepository(
                ROOT_DIR,
                internal_data_dir=internal_dir,
                analytics_db_path=db_path,
            )
            overview = repo.build_overview(geography="DE")
            self.assertTrue(overview["pay_transparency"]["available"], overview["pay_transparency"])
            item = overview["pay_transparency"]["review_items"][0]
            self.assertEqual(item["review_state"], "insufficient_sample")
            self.assertIsNone(item["internal_gap"])
            self.assertEqual(item["review_label"], "Too few people to report")


if __name__ == "__main__":
    unittest.main()
