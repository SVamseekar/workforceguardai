from __future__ import annotations

import sys
import unittest
from pathlib import Path

import pandas as pd


ROOT_DIR = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = ROOT_DIR / "scripts"

if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from prepare_internal_company_data import (  # noqa: E402
    ATS_REQUISITION_OUTPUT_COLUMNS,
    HRIS_WORKFORCE_OUTPUT_COLUMNS,
    JOB_ARCHITECTURE_OUTPUT_COLUMNS,
    LEARNING_SKILL_OUTPUT_COLUMNS,
    PAYROLL_OUTPUT_COLUMNS,
    empty_frame,
    prepare_ats_requisition_snapshot,
    prepare_hris_workforce_snapshot,
    prepare_job_architecture,
    prepare_learning_skill_snapshot,
    prepare_payroll_snapshot,
)


class PrepareInternalCompanyDataTests(unittest.TestCase):
    def test_prepare_payroll_snapshot_normalizes_company_contract(self):
        frame = pd.DataFrame(
            [
                {
                    "Employee ID": "emp-1",
                    "Job Code": "SE-1",
                    "Job Title": "Software Engineer",
                    "Country Code": "de",
                    "Worker Category ID": "eng_ic",
                    "Gender": "F",
                    "Base Pay Amount": "95000",
                    "Pay Currency": "eur",
                    "Snapshot Date": "2026/03/31",
                    "Employment Status": "ACTIVE",
                }
            ]
        )

        prepared = prepare_payroll_snapshot(frame, "local")

        self.assertEqual(
            list(prepared.columns),
            [
                "employee_id",
                "job_code",
                "job_title",
                "country_code",
                "worker_category_id",
                "gender",
                "base_pay_amount",
                "pay_currency",
                "snapshot_date",
                "employment_status",
                "version",
            ],
        )
        self.assertEqual(prepared.iloc[0]["country_code"], "DE")
        self.assertEqual(prepared.iloc[0]["gender"], "female")
        self.assertEqual(prepared.iloc[0]["pay_currency"], "EUR")
        self.assertEqual(prepared.iloc[0]["employment_status"], "active")
        self.assertEqual(prepared.iloc[0]["snapshot_date"], "2026-03-31")
        self.assertEqual(float(prepared.iloc[0]["base_pay_amount"]), 95000.0)

    def test_prepare_job_architecture_keeps_worker_category_mapping(self):
        frame = pd.DataFrame(
            [
                {
                    "Job Code": "SE-1",
                    "Job Family": "Engineering",
                    "Job Level": "IC3",
                    "Worker Category ID": "eng_ic",
                    "Worker Category Label": "Engineering Individual Contributor",
                    "ESCO URI": "urn:esco:occupation:1",
                    "NACE Code": "J62",
                }
            ]
        )

        prepared = prepare_job_architecture(frame, "local")

        self.assertIn("worker_category_id", prepared.columns)
        self.assertIn("worker_category_label", prepared.columns)
        self.assertEqual(prepared.iloc[0]["nace_code"], "J62")

    def test_prepare_payroll_snapshot_requires_gender_for_pay_gap_benchmarking(self):
        frame = pd.DataFrame(
            [
                {
                    "Employee ID": "emp-1",
                    "Job Code": "SE-1",
                    "Job Title": "Software Engineer",
                    "Country Code": "DE",
                    "Worker Category ID": "eng_ic",
                    "Base Pay Amount": "95000",
                    "Pay Currency": "EUR",
                    "Snapshot Date": "2026-03-31",
                    "Employment Status": "active",
                }
            ]
        )

        with self.assertRaises(ValueError):
            prepare_payroll_snapshot(frame, "local")

    def test_empty_frame_matches_expected_placeholder_contract(self):
        payroll_placeholder = empty_frame(PAYROLL_OUTPUT_COLUMNS)
        job_architecture_placeholder = empty_frame(JOB_ARCHITECTURE_OUTPUT_COLUMNS)
        hris_placeholder = empty_frame(HRIS_WORKFORCE_OUTPUT_COLUMNS)
        ats_placeholder = empty_frame(ATS_REQUISITION_OUTPUT_COLUMNS)
        learning_placeholder = empty_frame(LEARNING_SKILL_OUTPUT_COLUMNS)

        self.assertEqual(list(payroll_placeholder.columns), PAYROLL_OUTPUT_COLUMNS)
        self.assertEqual(list(job_architecture_placeholder.columns), JOB_ARCHITECTURE_OUTPUT_COLUMNS)
        self.assertEqual(list(hris_placeholder.columns), HRIS_WORKFORCE_OUTPUT_COLUMNS)
        self.assertEqual(list(ats_placeholder.columns), ATS_REQUISITION_OUTPUT_COLUMNS)
        self.assertEqual(list(learning_placeholder.columns), LEARNING_SKILL_OUTPUT_COLUMNS)
        self.assertTrue(payroll_placeholder.empty)
        self.assertTrue(job_architecture_placeholder.empty)
        self.assertTrue(hris_placeholder.empty)
        self.assertTrue(ats_placeholder.empty)
        self.assertTrue(learning_placeholder.empty)

    def test_prepare_hris_workforce_snapshot_normalizes_optional_contract(self):
        frame = pd.DataFrame(
            [
                {
                    "Employee ID": "emp-1",
                    "Country Code": "fr",
                    "Worker Category ID": "ops_ic",
                    "Gender": "M",
                    "Employment Type": "Full Time",
                    "Hire Date": "2024-01-15",
                    "Termination Date": "",
                    "Snapshot Date": "2026-03-31",
                    "Employment Status": "Employed",
                }
            ]
        )

        prepared = prepare_hris_workforce_snapshot(frame, "local")

        self.assertEqual(prepared.iloc[0]["country_code"], "FR")
        self.assertEqual(prepared.iloc[0]["gender"], "male")
        self.assertEqual(prepared.iloc[0]["employment_type"], "full time")
        self.assertEqual(prepared.iloc[0]["snapshot_date"], "2026-03-31")

    def test_prepare_ats_requisition_snapshot_normalizes_optional_contract(self):
        frame = pd.DataFrame(
            [
                {
                    "Requisition ID": "req-1",
                    "Job Code": "SE-1",
                    "Country Code": "de",
                    "Worker Category ID": "eng_ic",
                    "Requisition Status": "Open",
                    "Opened Date": "2026/01/10",
                    "Closed Date": "",
                }
            ]
        )

        prepared = prepare_ats_requisition_snapshot(frame, "local")

        self.assertEqual(prepared.iloc[0]["country_code"], "DE")
        self.assertEqual(prepared.iloc[0]["requisition_status"], "open")
        self.assertEqual(prepared.iloc[0]["opened_date"], "2026-01-10")

    def test_prepare_learning_skill_snapshot_normalizes_optional_contract(self):
        frame = pd.DataFrame(
            [
                {
                    "Employee ID": "emp-1",
                    "Skill URI": "urn:esco:skill:1",
                    "Skill Label": "Data governance",
                    "Skill Type": "Skill",
                    "Proficiency Level": "4",
                    "Last Observed Date": "2026-03-01",
                }
            ]
        )

        prepared = prepare_learning_skill_snapshot(frame, "local")

        self.assertEqual(prepared.iloc[0]["skill_type"], "skill")
        self.assertEqual(float(prepared.iloc[0]["proficiency_level"]), 4.0)
        self.assertEqual(prepared.iloc[0]["last_observed_date"], "2026-03-01")


if __name__ == "__main__":
    unittest.main()
