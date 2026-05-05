#!/usr/bin/env python3
"""Bootstrap helper for the WorkforceGuard analytics foundation.

This script does not download anything by itself. It checks that the expected
local data folders exist and gives a quick workspace summary before dbt work.
"""
from __future__ import annotations

from pathlib import Path
import json


ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "data" / "eu_raw"
META_DIR = ROOT / "data" / "eu_meta"
REFERENCE_RAW_DIR = ROOT / "data" / "reference_raw"
REFERENCE_DIR = ROOT / "data" / "reference"
ANALYTICS_DIR = ROOT / "analytics"

PHASE1_DATASETS = {
    "job_vacancy_rate",
    "unemployment_rate",
    "employment_rate",
    "gender_pay_gap_sector",
    "labour_market_flows",
    "labour_market_slack",
}

REFERENCE_ASSETS = {
    "esco_occupations.parquet": 3000,
    "esco_skills.parquet": 10000,
    "esco_occupation_skill_relations.parquet": 50000,
    "esco_nace_crosswalk.parquet": 4000,
}


def main() -> None:
    parquet_files = sorted(RAW_DIR.glob("*.parquet"))
    meta_files = sorted(META_DIR.glob("*.json"))
    raw_names = {path.stem for path in parquet_files}
    reference_files = sorted(REFERENCE_DIR.glob("*.parquet"))
    reference_raw_files = sorted(path for path in REFERENCE_RAW_DIR.glob("*") if path.name != ".gitkeep")
    reference_names = {path.name for path in reference_files}
    prepared_manifest = REFERENCE_DIR / "manifest.json"
    esco_api_manifest = REFERENCE_DIR / "esco_api_manifest.json"

    manifest_assets = {}
    if prepared_manifest.exists():
        with prepared_manifest.open("r", encoding="utf-8") as handle:
            for asset in json.load(handle).get("assets", []):
                manifest_assets[Path(asset["output"]).name] = asset.get("record_count", 0)
    if esco_api_manifest.exists():
        with esco_api_manifest.open("r", encoding="utf-8") as handle:
            for asset in json.load(handle).get("assets", []):
                asset_name = f"{asset['asset_type']}.parquet"
                manifest_assets[asset_name] = max(
                    manifest_assets.get(asset_name, 0),
                    asset.get("rows", 0),
                )

    print("WorkforceGuard phase 1 workspace")
    print(f"- analytics project: {'present' if ANALYTICS_DIR.exists() else 'missing'}")
    print(f"- raw parquet files: {len(parquet_files)}")
    print(f"- metadata files: {len(meta_files)}")
    print(f"- prepared reference assets: {len(reference_files)}")
    print(f"- reference raw files: {len(reference_raw_files)}")

    if parquet_files:
        print("- sample raw datasets:")
        for path in parquet_files[:5]:
            print(f"  - {path.name}")

    if not parquet_files:
        print("- no raw parquet files found; run scripts/pull_eu_data.py first")

    missing_phase1 = sorted(PHASE1_DATASETS - raw_names)
    print(f"- core market datasets live: {len(PHASE1_DATASETS) - len(missing_phase1)}/{len(PHASE1_DATASETS)}")
    if missing_phase1:
        print("- missing core market datasets:")
        for dataset in missing_phase1:
            print(f"  - {dataset}")

    if reference_files:
        print("- prepared reference assets:")
        for path in reference_files[:5]:
            print(f"  - {path.name}")

    ready_reference = []
    partial_reference = []
    for asset_name, minimum_rows in REFERENCE_ASSETS.items():
        if asset_name not in reference_names:
            continue
        actual_rows = manifest_assets.get(asset_name, 0)
        if actual_rows >= minimum_rows:
            ready_reference.append(asset_name)
        else:
            partial_reference.append(f"{asset_name} ({actual_rows} rows)")

    missing_reference = sorted(set(REFERENCE_ASSETS) - reference_names)
    print(f"- reference assets ready: {len(ready_reference)}/{len(REFERENCE_ASSETS)}")
    if missing_reference:
        print("- missing prepared reference assets:")
        for dataset in missing_reference:
            print(f"  - {dataset}")
    if partial_reference:
        print("- partial reference assets detected:")
        for dataset in partial_reference:
            print(f"  - {dataset}")

    if not reference_raw_files:
        print("- no reference raw files found; place official ESCO downloads in data/reference_raw")


if __name__ == "__main__":
    main()
