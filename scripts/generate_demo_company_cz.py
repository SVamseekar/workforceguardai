# scripts/generate_demo_company_cz.py
"""
Generates realistic demo company data for Meridian Financial Services s.r.o.
Run from the project root: python scripts/generate_demo_company_cz.py
Output: data/demo_raw/meridian_cz/payroll_snapshot.csv and job_architecture.csv
"""
from __future__ import annotations

import argparse
import random
from pathlib import Path

from demo_data.common import (
    PAYROLL_FIELDNAMES,
    SEED,
    UPLOAD_PAYROLL_FIELDNAMES,
    normal_pay,
    write_csv,
    write_job_architecture,
    write_payroll,
)

random.seed(SEED)

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT_DIR = ROOT / "data" / "demo_raw" / "meridian_cz"
DEFAULT_UPLOAD_SAMPLE = ROOT / "data" / "demo_samples" / "meridian_payroll_upload.csv"

SNAPSHOT_DATE = "2025-12-31"
COUNTRY = "CZ"
CURRENCY = "CZK"
VERSION = "demo-v1"
CZK_ROUND_TO = 5000

ESCO_RISK = "http://data.europa.eu/esco/occupation/7a6ca615-a2bc-499d-8288-d186ce2594ea"
ESCO_COMPLIANCE = "http://data.europa.eu/esco/occupation/4a39fddb-17e7-4431-be03-613edab8d1c8"
ESCO_ADVISOR = "http://data.europa.eu/esco/occupation/5e4d156a-1f05-4b2c-b0f0-5abb82d52ed6"
ESCO_OPS = "http://data.europa.eu/esco/occupation/2ff9e53c-6e7f-42af-8d71-b5dd7f283089"
ESCO_TECH = "http://data.europa.eu/esco/occupation/04ba4d6c-957d-417f-bf63-5b9e015a9f86"

# Job architecture: code, family, level, worker_category_id, label, nace, esco_uri
JOB_ARCHITECTURE = [
    ("RA-1", "Risk & Compliance", "P2", "risk_analyst", "Risk & Compliance", "K64", ESCO_RISK),
    ("RA-2", "Risk & Compliance", "P3", "risk_analyst", "Risk & Compliance", "K64", ESCO_COMPLIANCE),
    ("CA-1", "Client Advisory", "P2", "client_advisor", "Client Advisory", "K64", ESCO_ADVISOR),
    ("CA-2", "Client Advisory", "P3", "client_advisor", "Client Advisory", "K64", ESCO_ADVISOR),
    ("OPS-1", "Operations", "P1", "ops_support", "Operations", "K64", ESCO_OPS),
    ("OPS-2", "Operations", "P2", "ops_support", "Operations", "K64", ESCO_OPS),
    ("TP-1", "Technology", "IC2", "tech_platform", "Technology", "K64", ESCO_TECH),
    ("TP-2", "Technology", "IC3", "tech_platform", "Technology", "K64", ESCO_TECH),
    ("TP-3", "Technology", "IC4", "tech_platform", "Technology", "K64", ESCO_TECH),
]

# category_id -> [(job_codes), female_count, male_count, female_median, male_median]
CATEGORY_CONFIG = {
    "risk_analyst": (["RA-1", "RA-2"], 28, 42, 1_100_000, 1_280_000),
    "client_advisor": (["CA-1", "CA-2"], 35, 25, 950_000, 980_000),
    "ops_support": (["OPS-1", "OPS-2"], 22, 8, 720_000, 780_000),
    "tech_platform": (["TP-1", "TP-2", "TP-3"], 15, 35, 1_350_000, 1_520_000),
}

JOB_TITLE_MAP = {
    "RA-1": "Risk Analyst",
    "RA-2": "Senior Compliance Officer",
    "CA-1": "Client Advisor",
    "CA-2": "Senior Client Advisor",
    "OPS-1": "Operations Specialist",
    "OPS-2": "Operations Team Lead",
    "TP-1": "Software Engineer",
    "TP-2": "Senior Software Engineer",
    "TP-3": "Platform Engineer",
}

EXPECTED_EMPLOYEE_COUNT = sum(
    female_count + male_count
    for _, female_count, male_count, _, _ in CATEGORY_CONFIG.values()
)


def generate_payroll() -> list[dict[str, object]]:
    rows: list[dict[str, object]] = []
    emp_id = 1

    for category_id, (job_codes, female_count, male_count, female_median, male_median) in CATEGORY_CONFIG.items():
        for gender, count, median in [
            ("female", female_count, female_median),
            ("male", male_count, male_median),
        ]:
            for _ in range(count):
                job_code = random.choice(job_codes)
                rows.append(
                    {
                        "employee_id": f"emp-{emp_id:04d}",
                        "job_code": job_code,
                        "job_title": JOB_TITLE_MAP[job_code],
                        "country_code": COUNTRY,
                        "worker_category_id": category_id,
                        "gender": gender,
                        "base_pay_amount": normal_pay(median, round_to=CZK_ROUND_TO),
                        "pay_currency": CURRENCY,
                        "snapshot_date": SNAPSHOT_DATE,
                        "employment_status": "active",
                        "version": VERSION,
                    }
                )
                emp_id += 1

    random.shuffle(rows)
    return rows


def generate_upload_sample_rows() -> list[dict[str, object]]:
    """Small payroll slice for drag-drop upload demos (API column names)."""
    samples = [
        ("RA-1", "risk_analyst", "female", 1_050_000),
        ("RA-1", "risk_analyst", "female", 1_120_000),
        ("RA-2", "risk_analyst", "female", 1_180_000),
        ("RA-1", "risk_analyst", "male", 1_320_000),
        ("RA-2", "risk_analyst", "male", 1_360_000),
        ("RA-2", "risk_analyst", "male", 1_290_000),
        ("CA-1", "client_advisor", "female", 930_000),
        ("CA-2", "client_advisor", "female", 970_000),
        ("CA-1", "client_advisor", "male", 990_000),
        ("CA-2", "client_advisor", "male", 975_000),
        ("OPS-1", "ops_support", "female", 700_000),
        ("OPS-2", "ops_support", "female", 735_000),
        ("OPS-1", "ops_support", "male", 795_000),
        ("OPS-2", "ops_support", "male", 770_000),
        ("TP-1", "tech_platform", "female", 1_320_000),
        ("TP-2", "tech_platform", "female", 1_400_000),
        ("TP-1", "tech_platform", "male", 1_540_000),
        ("TP-3", "tech_platform", "male", 1_580_000),
    ]
    rows: list[dict[str, object]] = []
    for index, (job_code, category_id, gender, salary) in enumerate(samples, start=1):
        rows.append(
            {
                "employee_id": f"upload-{index:03d}",
                "job_code": job_code,
                "country_code": COUNTRY,
                "worker_category_id": category_id,
                "gender": gender,
                "base_salary": salary,
                "currency": CURRENCY,
                "snapshot_date": SNAPSHOT_DATE,
                "job_title": JOB_TITLE_MAP[job_code],
                "employment_status": "active",
                "version": "upload-demo-v1",
            }
        )
    return rows


def write_upload_sample(path: Path) -> int:
    count = write_csv(path, UPLOAD_PAYROLL_FIELDNAMES, generate_upload_sample_rows())
    print(f"Written {count} upload sample rows to {path}")
    return count


def generate_company_data(output_dir: Path, upload_sample_path: Path | None = None) -> dict[str, int]:
    output_dir.mkdir(parents=True, exist_ok=True)
    payroll_rows = generate_payroll()
    payroll_count = write_payroll(output_dir / "payroll_snapshot.csv", payroll_rows)
    job_arch_count = write_job_architecture(output_dir / "job_architecture.csv", JOB_ARCHITECTURE, version=VERSION)
    upload_count = 0
    if upload_sample_path is not None:
        upload_count = write_upload_sample(upload_sample_path)
    return {
        "payroll_rows": payroll_count,
        "job_architecture_rows": job_arch_count,
        "upload_sample_rows": upload_count,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate Meridian Financial Services CZ demo data")
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument(
        "--upload-sample",
        type=Path,
        default=None,
        help="Optional path for API-shaped payroll upload CSV (default: skip unless --write-upload-sample)",
    )
    parser.add_argument(
        "--write-upload-sample",
        action="store_true",
        help=f"Also write upload sample CSV to {DEFAULT_UPLOAD_SAMPLE}",
    )
    args = parser.parse_args()

    upload_path = args.upload_sample
    if args.write_upload_sample and upload_path is None:
        upload_path = DEFAULT_UPLOAD_SAMPLE

    generate_company_data(args.output_dir, upload_sample_path=upload_path)
    print("Meridian CZ demo company data generated.")


if __name__ == "__main__":
    main()
