from __future__ import annotations

import csv
import sys
import tempfile
import unittest
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = ROOT_DIR / "scripts"

if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from demo_data.common import (  # noqa: E402
    JOB_ARCH_FIELDNAMES,
    PAYROLL_FIELDNAMES,
    UPLOAD_PAYROLL_FIELDNAMES,
)
from generate_demo_company_cz import (  # noqa: E402
    CATEGORY_CONFIG,
    EXPECTED_EMPLOYEE_COUNT,
    JOB_ARCHITECTURE,
    generate_company_data,
    generate_payroll,
    generate_upload_sample_rows,
)
from prepare_internal_company_data import (  # noqa: E402
    prepare_job_architecture,
    prepare_payroll_snapshot,
)


class SeedDemoTenantGeneratorTests(unittest.TestCase):
    def test_meridian_cz_payroll_row_count(self):
        rows = generate_payroll()
        self.assertEqual(len(rows), EXPECTED_EMPLOYEE_COUNT)
        self.assertEqual(EXPECTED_EMPLOYEE_COUNT, 210)

        expected_by_category = {
            category_id: female_count + male_count
            for category_id, (_, female_count, male_count, _, _) in CATEGORY_CONFIG.items()
        }
        actual_by_category: dict[str, int] = {}
        for row in rows:
            category_id = str(row["worker_category_id"])
            actual_by_category[category_id] = actual_by_category.get(category_id, 0) + 1
        self.assertEqual(actual_by_category, expected_by_category)

    def test_meridian_cz_required_payroll_columns(self):
        import pandas as pd

        with tempfile.TemporaryDirectory() as temp_dir:
            output_dir = Path(temp_dir)
            generate_company_data(output_dir)
            payroll_path = output_dir / "payroll_snapshot.csv"

            with payroll_path.open(encoding="utf-8") as handle:
                reader = csv.DictReader(handle)
                self.assertEqual(reader.fieldnames, PAYROLL_FIELDNAMES)
                rows = list(reader)

            self.assertEqual(len(rows), EXPECTED_EMPLOYEE_COUNT)
            prepared = prepare_payroll_snapshot(pd.read_csv(payroll_path), "demo-v1")
            self.assertEqual(len(prepared), EXPECTED_EMPLOYEE_COUNT)

    def test_meridian_cz_job_architecture_columns_and_count(self):
        import pandas as pd

        with tempfile.TemporaryDirectory() as temp_dir:
            output_dir = Path(temp_dir)
            generate_company_data(output_dir)
            job_arch_path = output_dir / "job_architecture.csv"

            with job_arch_path.open(encoding="utf-8") as handle:
                reader = csv.DictReader(handle)
                self.assertEqual(reader.fieldnames, JOB_ARCH_FIELDNAMES)
                rows = list(reader)

            self.assertEqual(len(rows), len(JOB_ARCHITECTURE))
            prepared = prepare_job_architecture(pd.read_csv(job_arch_path), "demo-v1")
            self.assertEqual(len(prepared), len(JOB_ARCHITECTURE))
            self.assertTrue((prepared["nace_code"] == "K64").all())

    def test_meridian_upload_sample_has_api_columns_and_minimum_rows(self):
        rows = generate_upload_sample_rows()
        self.assertGreaterEqual(len(rows), 10)
        self.assertEqual(set(rows[0].keys()), set(UPLOAD_PAYROLL_FIELDNAMES))
        self.assertTrue(all(row["currency"] == "CZK" for row in rows))
        self.assertTrue(all(row["country_code"] == "CZ" for row in rows))

        categories_with_gap_story = {"risk_analyst", "ops_support", "tech_platform"}
        present_categories = {str(row["worker_category_id"]) for row in rows}
        self.assertTrue(categories_with_gap_story.issubset(present_categories))


if __name__ == "__main__":
    unittest.main()
