"""Shared helpers for synthetic demo company generators."""
from __future__ import annotations

import csv
import random
from pathlib import Path
from typing import Iterable, Mapping, Sequence

SEED = 42

PAYROLL_FIELDNAMES = [
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
]

JOB_ARCH_FIELDNAMES = [
    "job_code",
    "job_family",
    "job_level",
    "worker_category_id",
    "worker_category_label",
    "nace_code",
    "esco_uri",
    "version",
]

HRIS_FIELDNAMES = [
    "employee_id",
    "country_code",
    "worker_category_id",
    "gender",
    "employment_type",
    "hire_date",
    "termination_date",
    "snapshot_date",
    "employment_status",
]

UPLOAD_PAYROLL_FIELDNAMES = [
    "employee_id",
    "job_code",
    "country_code",
    "worker_category_id",
    "gender",
    "base_salary",
    "currency",
    "snapshot_date",
    "job_title",
    "employment_status",
    "version",
]


def normal_pay(median: int, spread: float = 0.15, round_to: int = 500) -> int:
    """Return a pay amount within ±spread of median, rounded to nearest round_to."""
    low = int(median * (1 - spread))
    high = int(median * (1 + spread))
    raw = random.randint(low, high)
    return round(raw / round_to) * round_to


def write_csv(path: Path, fieldnames: Sequence[str], rows: Iterable[Mapping[str, object]]) -> int:
    """Write rows to CSV and return the number of rows written."""
    path.parent.mkdir(parents=True, exist_ok=True)
    materialized = list(rows)
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(materialized)
    return len(materialized)


def write_payroll(path: Path, rows: Iterable[Mapping[str, object]]) -> int:
    count = write_csv(path, PAYROLL_FIELDNAMES, rows)
    print(f"Written {count} rows to {path}")
    return count


def hris_rows_from_payroll(
    payroll_rows: Iterable[Mapping[str, object]],
    *,
    hire_date: str = "2020-01-15",
    employment_type: str = "full_time",
) -> list[dict[str, object]]:
    """Person-level HRIS rows aligned 1:1 with payroll so female_share is real."""
    rows: list[dict[str, object]] = []
    for payroll in payroll_rows:
        rows.append(
            {
                "employee_id": payroll["employee_id"],
                "country_code": payroll["country_code"],
                "worker_category_id": payroll["worker_category_id"],
                "gender": payroll["gender"],
                "employment_type": employment_type,
                "hire_date": hire_date,
                "termination_date": "",
                "snapshot_date": payroll["snapshot_date"],
                "employment_status": payroll["employment_status"],
            }
        )
    return rows


def write_hris(path: Path, rows: Iterable[Mapping[str, object]]) -> int:
    count = write_csv(path, HRIS_FIELDNAMES, rows)
    print(f"Written {count} HRIS rows to {path}")
    return count


def write_job_architecture(
    path: Path,
    job_architecture: Sequence[tuple[str, str, str, str, str, str, str]],
    version: str = "demo-v1",
) -> int:
    """Write job architecture rows from (code, family, level, cat_id, label, nace, esco) tuples."""
    rows = [
        {
            "job_code": code,
            "job_family": family,
            "job_level": level,
            "worker_category_id": category_id,
            "worker_category_label": category_label,
            "nace_code": nace,
            "esco_uri": esco,
            "version": version,
        }
        for code, family, level, category_id, category_label, nace, esco in job_architecture
    ]
    count = write_csv(path, JOB_ARCH_FIELDNAMES, rows)
    print(f"Written {count} job codes to {path}")
    return count
