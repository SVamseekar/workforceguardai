# scripts/build_internal_parquet.py
"""
Converts internal_raw CSVs to parquet and updates the internal manifest.
Run from project root: python scripts/build_internal_parquet.py
"""
import json
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "data" / "internal_raw"
OUT_DIR = ROOT / "data" / "internal"
META_DIR = ROOT / "data" / "internal_meta"
OUT_DIR.mkdir(parents=True, exist_ok=True)
META_DIR.mkdir(parents=True, exist_ok=True)


def convert(csv_name: str, parquet_name: str, dtypes: dict = None) -> int:
    src = RAW_DIR / csv_name
    dst = OUT_DIR / parquet_name
    df = pd.read_csv(src, dtype=dtypes)
    df.to_parquet(dst, index=False)
    print(f"  {csv_name} → {parquet_name} ({len(df)} rows)")
    return len(df)


def update_manifest(payroll_count: int, job_arch_count: int):
    path = META_DIR / "manifest.json"
    manifest = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "assets": [
            {
                "asset_type": "internal_payroll_snapshot",
                "version": "demo-v1",
                "record_count": payroll_count,
                "output": str(OUT_DIR / "payroll_snapshot.parquet"),
                "trusted_for_company_claims": True,
            },
            {
                "asset_type": "internal_job_architecture",
                "version": "demo-v1",
                "record_count": job_arch_count,
                "output": str(OUT_DIR / "job_architecture.parquet"),
                "trusted_for_company_claims": True,
            },
            {
                "asset_type": "internal_hris_workforce_snapshot",
                "version": "local",
                "record_count": 0,
                "output": str(OUT_DIR / "hris_workforce_snapshot.parquet"),
                "trusted_for_company_claims": False,
                "placeholder": True,
            },
            {
                "asset_type": "internal_ats_requisition_snapshot",
                "version": "local",
                "record_count": 0,
                "output": str(OUT_DIR / "ats_requisition_snapshot.parquet"),
                "trusted_for_company_claims": False,
                "placeholder": True,
            },
        ],
    }
    with path.open("w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)
    print(f"  Manifest updated → trusted_for_company_claims: True")


if __name__ == "__main__":
    print("Converting internal CSVs to parquet...")
    payroll_count = convert(
        "payroll_snapshot.csv",
        "payroll_snapshot.parquet",
        dtypes={"employee_id": str, "job_code": str, "country_code": str,
                "worker_category_id": str, "gender": str, "pay_currency": str,
                "employment_status": str, "version": str},
    )
    job_arch_count = convert(
        "job_architecture.csv",
        "job_architecture.parquet",
        dtypes={"job_code": str, "job_family": str, "job_level": str,
                "worker_category_id": str, "worker_category_label": str,
                "nace_code": str, "esco_uri": str, "version": str},
    )
    update_manifest(payroll_count, job_arch_count)
    print("Done.")
