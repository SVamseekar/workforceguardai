#!/usr/bin/env python3
"""Prepare internal company data assets for WorkforceGuard Phase 3 experiments."""
from __future__ import annotations

import argparse
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable

import pandas as pd

try:
    import pyarrow as pa
    import pyarrow.parquet as pq
except Exception as exc:  # pragma: no cover
    raise SystemExit("pyarrow is required. Install with: pip install pyarrow") from exc


PAYROLL_REQUIRED_COLUMNS = {
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
}

JOB_ARCHITECTURE_REQUIRED_COLUMNS = {
    "job_code",
    "job_family",
    "job_level",
    "worker_category_id",
    "worker_category_label",
    "esco_uri",
    "nace_code",
}

HRIS_WORKFORCE_REQUIRED_COLUMNS = {
    "employee_id",
    "country_code",
    "worker_category_id",
    "gender",
    "employment_type",
    "hire_date",
    "snapshot_date",
    "employment_status",
}

ATS_REQUISITION_REQUIRED_COLUMNS = {
    "requisition_id",
    "job_code",
    "country_code",
    "worker_category_id",
    "requisition_status",
    "opened_date",
}

LEARNING_SKILL_REQUIRED_COLUMNS = {
    "employee_id",
    "skill_uri",
    "skill_label",
    "skill_type",
    "proficiency_level",
    "last_observed_date",
}

PAYROLL_OUTPUT_COLUMNS = [
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

JOB_ARCHITECTURE_OUTPUT_COLUMNS = [
    "job_code",
    "job_family",
    "job_level",
    "worker_category_id",
    "worker_category_label",
    "esco_uri",
    "nace_code",
    "version",
]

HRIS_WORKFORCE_OUTPUT_COLUMNS = [
    "employee_id",
    "country_code",
    "worker_category_id",
    "gender",
    "employment_type",
    "hire_date",
    "termination_date",
    "snapshot_date",
    "employment_status",
    "version",
]

ATS_REQUISITION_OUTPUT_COLUMNS = [
    "requisition_id",
    "job_code",
    "country_code",
    "worker_category_id",
    "requisition_status",
    "opened_date",
    "closed_date",
    "version",
]

LEARNING_SKILL_OUTPUT_COLUMNS = [
    "employee_id",
    "skill_uri",
    "skill_label",
    "skill_type",
    "proficiency_level",
    "last_observed_date",
    "version",
]


def load_yaml(path: Path) -> dict:
    import yaml

    with path.open("r", encoding="utf-8") as handle:
        return yaml.safe_load(handle)


def snake_case(value: str) -> str:
    return re.sub(r"[^0-9a-zA-Z]+", "_", value).strip("_").lower()


def normalize_columns(frame: pd.DataFrame) -> pd.DataFrame:
    return frame.rename(columns={column: snake_case(column) for column in frame.columns})


def stringify_columns(frame: pd.DataFrame, columns: Iterable[str]) -> pd.DataFrame:
    for column in columns:
        if column in frame.columns:
            frame[column] = frame[column].astype("string")
    return frame


def validate_required_columns(frame: pd.DataFrame, required: set[str], asset_name: str) -> None:
    missing = sorted(required - set(frame.columns))
    if missing:
        raise ValueError(f"{asset_name} is missing required columns: {', '.join(missing)}")


def normalize_gender(value: Any) -> str | None:
    normalized = str(value).strip().lower()
    if normalized in {"f", "female", "woman"}:
        return "female"
    if normalized in {"m", "male", "man"}:
        return "male"
    return None


def normalize_status(value: Any) -> str:
    return str(value).strip().lower()


def normalize_currency(value: Any) -> str:
    return str(value).strip().upper()


def write_parquet(path: Path, frame: pd.DataFrame) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    table = pa.Table.from_pandas(frame, preserve_index=False)
    pq.write_table(table, path, compression="snappy")


def build_manifest_entry(
    path: Path,
    record_count: int,
    asset_type: str,
    version: str,
    trusted_for_company_claims: bool = False,
) -> Dict[str, Any]:
    return {
        "asset_type": asset_type,
        "version": version,
        "record_count": int(record_count),
        "output": str(path.resolve()),
        "trusted_for_company_claims": bool(trusted_for_company_claims),
    }


def empty_frame(columns: list[str]) -> pd.DataFrame:
    return pd.DataFrame({column: pd.Series(dtype="string") for column in columns})


def prepare_payroll_snapshot(frame: pd.DataFrame, version: str) -> pd.DataFrame:
    frame = normalize_columns(frame).copy()
    validate_required_columns(frame, PAYROLL_REQUIRED_COLUMNS, "Payroll snapshot")

    parsed_dates = pd.to_datetime(frame["snapshot_date"], errors="coerce")
    pay_amount = pd.to_numeric(frame["base_pay_amount"], errors="coerce")
    normalized_gender = frame["gender"].map(normalize_gender)

    output = pd.DataFrame(
        {
            "employee_id": frame["employee_id"],
            "job_code": frame["job_code"],
            "job_title": frame["job_title"],
            "country_code": frame["country_code"].astype("string").str.upper(),
            "worker_category_id": frame["worker_category_id"],
            "gender": normalized_gender,
            "base_pay_amount": pay_amount,
            "pay_currency": frame["pay_currency"].map(normalize_currency),
            "snapshot_date": parsed_dates.dt.strftime("%Y-%m-%d"),
            "employment_status": frame["employment_status"].map(normalize_status),
            "version": version,
        }
    )
    output = output.dropna(
        subset=["employee_id", "job_code", "country_code", "worker_category_id", "gender", "base_pay_amount", "snapshot_date"]
    )
    output = stringify_columns(
        output,
        [
            "employee_id",
            "job_code",
            "job_title",
            "country_code",
            "worker_category_id",
            "gender",
            "pay_currency",
            "snapshot_date",
            "employment_status",
            "version",
        ],
    )
    return output.drop_duplicates(subset=["employee_id", "snapshot_date"]).reset_index(drop=True)


def prepare_job_architecture(frame: pd.DataFrame, version: str) -> pd.DataFrame:
    frame = normalize_columns(frame).copy()
    validate_required_columns(frame, JOB_ARCHITECTURE_REQUIRED_COLUMNS, "Job architecture")

    output = pd.DataFrame(
        {
            "job_code": frame["job_code"],
            "job_family": frame["job_family"],
            "job_level": frame["job_level"],
            "worker_category_id": frame["worker_category_id"],
            "worker_category_label": frame["worker_category_label"],
            "esco_uri": frame["esco_uri"],
            "nace_code": frame["nace_code"].astype("string").str.upper(),
            "version": version,
        }
    )
    output = output.dropna(subset=["job_code", "worker_category_id", "worker_category_label", "nace_code"])
    output = stringify_columns(output, output.columns)
    return output.drop_duplicates(subset=["job_code"]).reset_index(drop=True)


def prepare_hris_workforce_snapshot(frame: pd.DataFrame, version: str) -> pd.DataFrame:
    frame = normalize_columns(frame).copy()
    validate_required_columns(frame, HRIS_WORKFORCE_REQUIRED_COLUMNS, "HRIS workforce snapshot")

    hire_dates = pd.to_datetime(frame["hire_date"], errors="coerce")
    termination_dates = (
        pd.to_datetime(frame["termination_date"], errors="coerce")
        if "termination_date" in frame.columns
        else pd.Series(pd.NaT, index=frame.index)
    )
    snapshot_dates = pd.to_datetime(frame["snapshot_date"], errors="coerce")

    output = pd.DataFrame(
        {
            "employee_id": frame["employee_id"],
            "country_code": frame["country_code"].astype("string").str.upper(),
            "worker_category_id": frame["worker_category_id"],
            "gender": frame["gender"].map(normalize_gender),
            "employment_type": frame["employment_type"].map(normalize_status),
            "hire_date": hire_dates.dt.strftime("%Y-%m-%d"),
            "termination_date": termination_dates.dt.strftime("%Y-%m-%d"),
            "snapshot_date": snapshot_dates.dt.strftime("%Y-%m-%d"),
            "employment_status": frame["employment_status"].map(normalize_status),
            "version": version,
        }
    )
    output = output.dropna(
        subset=["employee_id", "country_code", "worker_category_id", "gender", "hire_date", "snapshot_date"]
    )
    output = stringify_columns(output, HRIS_WORKFORCE_OUTPUT_COLUMNS)
    return output.drop_duplicates(subset=["employee_id", "snapshot_date"]).reset_index(drop=True)


def prepare_ats_requisition_snapshot(frame: pd.DataFrame, version: str) -> pd.DataFrame:
    frame = normalize_columns(frame).copy()
    validate_required_columns(frame, ATS_REQUISITION_REQUIRED_COLUMNS, "ATS requisition snapshot")

    opened_dates = pd.to_datetime(frame["opened_date"], errors="coerce")
    closed_dates = (
        pd.to_datetime(frame["closed_date"], errors="coerce")
        if "closed_date" in frame.columns
        else pd.Series(pd.NaT, index=frame.index)
    )

    output = pd.DataFrame(
        {
            "requisition_id": frame["requisition_id"],
            "job_code": frame["job_code"],
            "country_code": frame["country_code"].astype("string").str.upper(),
            "worker_category_id": frame["worker_category_id"],
            "requisition_status": frame["requisition_status"].map(normalize_status),
            "opened_date": opened_dates.dt.strftime("%Y-%m-%d"),
            "closed_date": closed_dates.dt.strftime("%Y-%m-%d"),
            "version": version,
        }
    )
    output = output.dropna(subset=["requisition_id", "job_code", "country_code", "worker_category_id", "opened_date"])
    output = stringify_columns(output, ATS_REQUISITION_OUTPUT_COLUMNS)
    return output.drop_duplicates(subset=["requisition_id"]).reset_index(drop=True)


def prepare_learning_skill_snapshot(frame: pd.DataFrame, version: str) -> pd.DataFrame:
    frame = normalize_columns(frame).copy()
    validate_required_columns(frame, LEARNING_SKILL_REQUIRED_COLUMNS, "Learning skill snapshot")

    observed_dates = pd.to_datetime(frame["last_observed_date"], errors="coerce")
    proficiency = pd.to_numeric(frame["proficiency_level"], errors="coerce")

    output = pd.DataFrame(
        {
            "employee_id": frame["employee_id"],
            "skill_uri": frame["skill_uri"],
            "skill_label": frame["skill_label"],
            "skill_type": frame["skill_type"].map(normalize_status),
            "proficiency_level": proficiency,
            "last_observed_date": observed_dates.dt.strftime("%Y-%m-%d"),
            "version": version,
        }
    )
    output = output.dropna(subset=["employee_id", "skill_uri", "skill_label", "last_observed_date"])
    output = stringify_columns(
        output,
        ["employee_id", "skill_uri", "skill_label", "skill_type", "last_observed_date", "version"],
    )
    return output.drop_duplicates(subset=["employee_id", "skill_uri", "last_observed_date"]).reset_index(drop=True)


def main() -> None:
    parser = argparse.ArgumentParser(description="Prepare internal company assets for WorkforceGuard")
    parser.add_argument("--config", type=Path, default=Path("configs/internal_sources.yaml"))
    parser.add_argument("--input-dir", type=Path, default=Path("data/internal_raw"))
    parser.add_argument("--output-dir", type=Path, default=Path("data/internal"))
    parser.add_argument("--manifest", type=Path, default=Path("data/internal_meta/manifest.json"))
    parser.add_argument("--payroll-file", type=Path)
    parser.add_argument("--job-architecture-file", type=Path)
    parser.add_argument("--hris-workforce-file", type=Path)
    parser.add_argument("--ats-requisition-file", type=Path)
    parser.add_argument("--learning-skill-file", type=Path)
    parser.add_argument(
        "--write-empty-placeholders",
        action="store_true",
        help="Write zero-row Parquet placeholders when raw company files are absent.",
    )
    parser.add_argument(
        "--trust-company-data",
        action="store_true",
        help="Mark loaded internal assets as trusted real employer data for company-specific claims.",
    )
    args = parser.parse_args()

    config = load_yaml(args.config)
    versions = config.get("versions", {})
    inputs = config.get("inputs", {})

    payroll_path = args.payroll_file or (args.input_dir / inputs["payroll_snapshot"])
    job_architecture_path = args.job_architecture_file or (args.input_dir / inputs["job_architecture"])
    hris_workforce_path = args.hris_workforce_file or (args.input_dir / inputs["hris_workforce_snapshot"])
    ats_requisition_path = args.ats_requisition_file or (args.input_dir / inputs["ats_requisition_snapshot"])
    learning_skill_path = args.learning_skill_file or (args.input_dir / inputs["learning_skill_snapshot"])

    args.output_dir.mkdir(parents=True, exist_ok=True)
    manifest: Dict[str, Any] = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "assets": [],
        "missing_inputs": [],
    }

    if payroll_path.exists():
        payroll = pd.read_csv(payroll_path, low_memory=False)
        prepared_payroll = prepare_payroll_snapshot(payroll, versions.get("internal_payroll_snapshot", "local"))
        payroll_output = args.output_dir / "payroll_snapshot.parquet"
        write_parquet(payroll_output, prepared_payroll)
        manifest["assets"].append(
            build_manifest_entry(
                payroll_output,
                len(prepared_payroll),
                "internal_payroll_snapshot",
                versions.get("internal_payroll_snapshot", "local"),
                trusted_for_company_claims=args.trust_company_data,
            )
        )
    else:
        manifest["missing_inputs"].append(str(payroll_path))
        if args.write_empty_placeholders:
            payroll_output = args.output_dir / "payroll_snapshot.parquet"
            prepared_payroll = empty_frame(PAYROLL_OUTPUT_COLUMNS)
            write_parquet(payroll_output, prepared_payroll)
            placeholder_entry = build_manifest_entry(
                payroll_output,
                len(prepared_payroll),
                "internal_payroll_snapshot",
                versions.get("internal_payroll_snapshot", "local"),
                trusted_for_company_claims=False,
            )
            placeholder_entry["placeholder"] = True
            manifest["assets"].append(placeholder_entry)

    if job_architecture_path.exists():
        job_architecture = pd.read_csv(job_architecture_path, low_memory=False)
        prepared_job_architecture = prepare_job_architecture(
            job_architecture,
            versions.get("internal_job_architecture", "local"),
        )
        job_architecture_output = args.output_dir / "job_architecture.parquet"
        write_parquet(job_architecture_output, prepared_job_architecture)
        manifest["assets"].append(
            build_manifest_entry(
                job_architecture_output,
                len(prepared_job_architecture),
                "internal_job_architecture",
                versions.get("internal_job_architecture", "local"),
                trusted_for_company_claims=args.trust_company_data,
            )
        )
    else:
        manifest["missing_inputs"].append(str(job_architecture_path))
        if args.write_empty_placeholders:
            job_architecture_output = args.output_dir / "job_architecture.parquet"
            prepared_job_architecture = empty_frame(JOB_ARCHITECTURE_OUTPUT_COLUMNS)
            write_parquet(job_architecture_output, prepared_job_architecture)
            placeholder_entry = build_manifest_entry(
                job_architecture_output,
                len(prepared_job_architecture),
                "internal_job_architecture",
                versions.get("internal_job_architecture", "local"),
                trusted_for_company_claims=False,
            )
            placeholder_entry["placeholder"] = True
            manifest["assets"].append(placeholder_entry)

    optional_assets = [
        (
            hris_workforce_path,
            "hris_workforce_snapshot.parquet",
            "internal_hris_workforce_snapshot",
            HRIS_WORKFORCE_OUTPUT_COLUMNS,
            prepare_hris_workforce_snapshot,
        ),
        (
            ats_requisition_path,
            "ats_requisition_snapshot.parquet",
            "internal_ats_requisition_snapshot",
            ATS_REQUISITION_OUTPUT_COLUMNS,
            prepare_ats_requisition_snapshot,
        ),
        (
            learning_skill_path,
            "learning_skill_snapshot.parquet",
            "internal_learning_skill_snapshot",
            LEARNING_SKILL_OUTPUT_COLUMNS,
            prepare_learning_skill_snapshot,
        ),
    ]

    for input_path, output_filename, asset_type, output_columns, prepare_func in optional_assets:
        version = versions.get(asset_type, "local")
        output_path = args.output_dir / output_filename
        if input_path.exists():
            raw_frame = pd.read_csv(input_path, low_memory=False)
            prepared_frame = prepare_func(raw_frame, version)
            write_parquet(output_path, prepared_frame)
            manifest["assets"].append(
                build_manifest_entry(
                    output_path,
                    len(prepared_frame),
                    asset_type,
                    version,
                    trusted_for_company_claims=args.trust_company_data,
                )
            )
            continue

        manifest["missing_inputs"].append(str(input_path))
        prepared_frame = empty_frame(output_columns)
        write_parquet(output_path, prepared_frame)
        placeholder_entry = build_manifest_entry(
            output_path,
            len(prepared_frame),
            asset_type,
            version,
            trusted_for_company_claims=False,
        )
        placeholder_entry["placeholder"] = True
        manifest["assets"].append(placeholder_entry)

    args.manifest.parent.mkdir(parents=True, exist_ok=True)
    with args.manifest.open("w", encoding="utf-8") as handle:
        json.dump(manifest, handle, indent=2)

    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
