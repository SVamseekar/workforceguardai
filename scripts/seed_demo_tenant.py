#!/usr/bin/env python3
"""Seed a demo tenant with synthetic internal company data."""
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any

try:
    import pyarrow.parquet as pq
except Exception as exc:  # pragma: no cover
    raise SystemExit("pyarrow is required. Install with: pip install pyarrow") from exc


ROOT = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = ROOT / "scripts"
DEFAULT_TENANT_ID = "a0000000-0000-4000-8000-000000000001"
MERIDIAN_UPLOAD_SAMPLE = ROOT / "data" / "demo_samples" / "meridian_payroll_upload.csv"

SCENARIO_GENERATORS = {
    "aerotech-fr": {
        "script": SCRIPTS_DIR / "generate_demo_company.py",
        "copy_from": ROOT / "data" / "internal_raw",
        "upload_sample": None,
    },
    "meridian-cz": {
        "script": SCRIPTS_DIR / "generate_demo_company_cz.py",
        "copy_from": None,
        "upload_sample": MERIDIAN_UPLOAD_SAMPLE,
    },
}


def tenant_schema_name(tenant_id: str) -> str:
    safe = re.sub(r"[^a-zA-Z0-9_]", "_", tenant_id).lower()
    return f"tenant_{safe}"


def run_generator(scenario: str, raw_dir: Path) -> None:
    config = SCENARIO_GENERATORS[scenario]
    raw_dir.mkdir(parents=True, exist_ok=True)

    if config["copy_from"] is not None:
        subprocess.run(
            [sys.executable, str(config["script"])],
            cwd=str(ROOT),
            check=True,
        )
        for filename in ("payroll_snapshot.csv", "job_architecture.csv"):
            shutil.copy2(config["copy_from"] / filename, raw_dir / filename)
        return

    cmd = [sys.executable, str(config["script"]), "--output-dir", str(raw_dir)]
    upload_sample = config.get("upload_sample")
    if upload_sample is not None:
        cmd.extend(["--upload-sample", str(upload_sample)])
    subprocess.run(cmd, cwd=str(ROOT), check=True)


def run_prepare_internal(raw_dir: Path, internal_dir: Path, manifest_path: Path) -> dict[str, Any]:
    internal_dir.mkdir(parents=True, exist_ok=True)
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [
            sys.executable,
            str(SCRIPTS_DIR / "prepare_internal_company_data.py"),
            "--input-dir",
            str(raw_dir),
            "--output-dir",
            str(internal_dir),
            "--manifest",
            str(manifest_path),
            "--trust-company-data",
        ],
        cwd=str(ROOT),
        check=True,
    )
    return json.loads(manifest_path.read_text(encoding="utf-8"))


def run_dbt_internal(internal_dir: Path, tenant_id: str) -> None:
    analytics_dir = ROOT / "analytics"
    if not analytics_dir.exists():
        print("Skipping dbt: analytics directory not found.")
        return

    dbt_env = {**os.environ, "WORKFORCEGUARD_INTERNAL_PATH": str(internal_dir)}
    subprocess.run(
        [
            "dbt",
            "run",
            "--project-dir",
            str(analytics_dir),
            "--profiles-dir",
            str(analytics_dir),
            "--select",
            "tag:internal",
            "--vars",
            f'{{"tenant_schema": "{tenant_schema_name(tenant_id)}"}}',
        ],
        cwd=str(ROOT),
        env=dbt_env,
        check=False,
    )


def parquet_row_count(path: Path) -> int:
    if not path.exists():
        return 0
    return pq.read_table(path).num_rows


def print_health_summary(
    scenario: str,
    tenant_id: str,
    internal_dir: Path,
    manifest_path: Path,
    manifest: dict[str, Any],
) -> None:
    payroll_path = internal_dir / "payroll_snapshot.parquet"
    job_arch_path = internal_dir / "job_architecture.parquet"

    print("\n=== Demo tenant health summary ===")
    print(f"Scenario:     {scenario}")
    print(f"Tenant ID:    {tenant_id}")
    print(f"Internal dir: {internal_dir}")
    print(f"Manifest:     {manifest_path}")
    print(f"Payroll rows: {parquet_row_count(payroll_path)}")
    print(f"Job arch rows: {parquet_row_count(job_arch_path)}")

    trusted_assets = [
        asset
        for asset in manifest.get("assets", [])
        if asset.get("trusted_for_company_claims")
    ]
    print(f"Trusted assets in manifest: {len(trusted_assets)}")
    for asset in manifest.get("assets", []):
        asset_type = asset.get("asset_type", "unknown")
        record_count = asset.get("record_count", 0)
        trusted = asset.get("trusted_for_company_claims", False)
        print(f"  - {asset_type}: {record_count} rows (trusted={trusted})")

    missing_inputs = manifest.get("missing_inputs", [])
    if missing_inputs:
        print(f"Missing inputs: {len(missing_inputs)}")
        for missing in missing_inputs:
            print(f"  - {missing}")


def seed_demo_tenant(scenario: str, tenant_id: str, *, skip_dbt: bool = False) -> dict[str, Any]:
    if scenario not in SCENARIO_GENERATORS:
        raise ValueError(f"Unknown scenario {scenario!r}. Choose from: {', '.join(SCENARIO_GENERATORS)}")

    tenant_dir = ROOT / "data" / "tenants" / tenant_id
    internal_dir = tenant_dir / "internal"
    manifest_path = tenant_dir / "internal_meta" / "manifest.json"

    with tempfile.TemporaryDirectory(prefix=f"demo-{scenario}-") as temp_dir:
        raw_dir = Path(temp_dir)
        run_generator(scenario, raw_dir)
        manifest = run_prepare_internal(raw_dir, internal_dir, manifest_path)

    if not skip_dbt:
        run_dbt_internal(internal_dir, tenant_id)

    print_health_summary(scenario, tenant_id, internal_dir, manifest_path, manifest)
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed WorkforceGuard demo tenant internal data")
    parser.add_argument(
        "--scenario",
        required=True,
        choices=sorted(SCENARIO_GENERATORS),
        help="Demo company scenario to generate",
    )
    parser.add_argument(
        "--tenant-id",
        default=DEFAULT_TENANT_ID,
        help=f"Target tenant UUID (default: {DEFAULT_TENANT_ID})",
    )
    parser.add_argument(
        "--skip-dbt",
        action="store_true",
        help="Skip dbt tag:internal rebuild (useful when dbt is unavailable)",
    )
    args = parser.parse_args()

    seed_demo_tenant(args.scenario, args.tenant_id, skip_dbt=args.skip_dbt)


if __name__ == "__main__":
    main()
