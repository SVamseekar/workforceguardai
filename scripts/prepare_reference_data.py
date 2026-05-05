#!/usr/bin/env python3
"""Prepare official ESCO reference assets for WorkforceGuard analytics.

This script converts manually downloaded official ESCO assets into stable,
analytics-friendly Parquet files. It avoids brittle scraping of the ESCO
download UI and instead standardizes files after download.
"""
from __future__ import annotations

import argparse
import json
import re
import tempfile
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, Optional

import pandas as pd

try:
    import pyarrow as pa
    import pyarrow.parquet as pq
except Exception as exc:  # pragma: no cover
    raise SystemExit("pyarrow is required. Install with: pip install pyarrow") from exc


COLUMN_ALIASES = {
    "preferredlabel": "preferred_label",
    "alternatelabel": "alternate_label",
    "description": "description",
    "concepttype": "concept_type",
    "concepturi": "concept_uri",
    "uri": "concept_uri",
    "id": "concept_uri",
    "code": "code",
    "isuritranslatable": "is_uri_translatable",
    "isco08code": "isco08_code",
    "isco08label": "isco08_label",
    "skilltype": "skill_type",
    "reusabilitylevel": "reusability_level",
    "occupationuri": "occupation_uri",
    "skilluri": "skill_uri",
    "relationtype": "relation_type",
    "relation": "relation_type",
    "essential": "essential_flag",
    "digitalskillindicator": "digital_skill_indicator",
    "greenskillindicator": "green_skill_indicator",
    "nace_rev2_code": "nace_rev2_code",
    "nace_rev2_label": "nace_rev2_label",
    "nacecode": "nace_rev2_code",
    "nace_code": "nace_rev2_code",
    "nacelabel": "nace_rev2_label",
    "nace_title": "nace_rev2_label",
    "escouri": "esco_uri",
    "escooccupationuri": "esco_uri",
    "escooccupationlabel": "esco_label",
    "escopreferredlabel": "esco_label",
    "esco_label": "esco_label",
    "escopt": "esco_label",
    "escocode": "esco_code",
    "mappingtype": "mapping_type",
    "mappingstrength": "mapping_strength",
}


def load_yaml(path: Path) -> dict:
    import yaml

    with path.open("r", encoding="utf-8") as handle:
        return yaml.safe_load(handle)


def snake_case(value: str) -> str:
    normalized = re.sub(r"[^0-9a-zA-Z]+", "_", value).strip("_").lower()
    return COLUMN_ALIASES.get(normalized, normalized)


def normalize_columns(frame: pd.DataFrame) -> pd.DataFrame:
    renamed = {column: snake_case(column) for column in frame.columns}
    return frame.rename(columns=renamed)


def first_present(frame: pd.DataFrame, candidates: Iterable[str]) -> Optional[str]:
    for candidate in candidates:
        if candidate in frame.columns:
            return candidate
    return None


def stringify_columns(frame: pd.DataFrame, columns: Iterable[str]) -> pd.DataFrame:
    for column in columns:
        if column in frame.columns:
            frame[column] = frame[column].astype("string")
    return frame


def write_parquet(path: Path, frame: pd.DataFrame) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    table = pa.Table.from_pandas(frame, preserve_index=False)
    pq.write_table(table, path, compression="snappy")


def locate_zip_member(members: Iterable[str], expected_name: str, contains_tokens: Iterable[str]) -> Optional[str]:
    expected_name = expected_name.lower()
    for member in members:
        lowered = member.lower()
        basename = Path(member).name.lower()
        if basename == expected_name:
            return member
    for member in members:
        lowered = member.lower()
        if all(token in lowered for token in contains_tokens):
            return member
    return None


def locate_nested_input(input_dir: Path, expected_name: str) -> Optional[Path]:
    direct_path = input_dir / expected_name
    if direct_path.exists():
        return direct_path

    matches = sorted(
        path
        for path in input_dir.rglob(expected_name)
        if path.is_file() and "__MACOSX" not in path.parts
    )
    if matches:
        return matches[0]
    return None


def resolve_reference_inputs(
    input_dir: Path,
    config_inputs: Dict[str, str],
    provided: Dict[str, Optional[Path]],
) -> Dict[str, Path]:
    resolved: Dict[str, Path] = {}
    for key, filename in config_inputs.items():
        if provided.get(key):
            resolved[key] = provided[key]
        else:
            resolved[key] = input_dir / filename

    if all(resolved[key].exists() for key in [
        "esco_occupations",
        "esco_skills",
        "esco_occupation_skill_relations",
    ]):
        return resolved

    nested_files = {
        "esco_occupations": locate_nested_input(input_dir, "occupations_en.csv"),
        "esco_skills": locate_nested_input(input_dir, "skills_en.csv"),
        "esco_occupation_skill_relations": locate_nested_input(input_dir, "occupationSkillRelations_en.csv"),
    }
    for key, path in nested_files.items():
        if path and not resolved[key].exists():
            resolved[key] = path

    if all(resolved[key].exists() for key in [
        "esco_occupations",
        "esco_skills",
        "esco_occupation_skill_relations",
    ]):
        return resolved

    zip_candidates: list[Path] = []
    if provided.get("esco_classification_zip"):
        zip_candidates.append(provided["esco_classification_zip"])
    configured_zip = resolved.get("esco_classification_zip")
    if configured_zip and configured_zip.exists():
        zip_candidates.append(configured_zip)
    zip_candidates.extend(sorted(input_dir.glob("*.zip")))
    seen = set()
    zip_candidates = [path for path in zip_candidates if not (path in seen or seen.add(path))]
    if not zip_candidates:
        return resolved

    latest_zip = zip_candidates[0]
    with zipfile.ZipFile(latest_zip) as archive, tempfile.TemporaryDirectory() as tmp_dir:
        members = archive.namelist()
        extraction_plan = {
            "esco_occupations": locate_zip_member(members, "occupations_en.csv", ["occupation", "en", ".csv"]),
            "esco_skills": locate_zip_member(members, "skills_en.csv", ["skill", "en", ".csv"]),
            "esco_occupation_skill_relations": locate_zip_member(
                members,
                "occupationSkillRelations_en.csv",
                ["occup", "skill", "relation", "en", ".csv"],
            ),
        }
        extracted_dir = Path(tmp_dir)
        for key, member in extraction_plan.items():
            if member and not resolved[key].exists():
                archive.extract(member, path=extracted_dir)
                resolved[key] = extracted_dir / member

        # Keep extracted temp files alive by copying them into the raw dir when needed.
        for key, path in list(resolved.items()):
            if path.exists() and str(extracted_dir) in str(path):
                target = input_dir / Path(path).name
                target.write_bytes(path.read_bytes())
                resolved[key] = target

    return resolved


def prepare_esco_occupations(frame: pd.DataFrame, version: str) -> pd.DataFrame:
    frame = normalize_columns(frame).copy()
    uri_column = first_present(frame, ["concept_uri", "uri"])
    label_column = first_present(frame, ["preferred_label", "preferredlabel"])
    if not uri_column or not label_column:
        raise ValueError("ESCO occupations file is missing a URI or preferred-label column.")

    output = pd.DataFrame(
        {
            "esco_uri": frame[uri_column],
            "preferred_label": frame[label_column],
            "concept_type": frame.get("concept_type"),
            "description": frame.get("description"),
            "isco08_code": frame.get("isco08_code"),
            "isco08_label": frame.get("isco08_label"),
            "version": version,
        }
    )
    output = stringify_columns(output, output.columns)
    return output.drop_duplicates(subset=["esco_uri"]).reset_index(drop=True)


def prepare_esco_skills(frame: pd.DataFrame, version: str) -> pd.DataFrame:
    frame = normalize_columns(frame).copy()
    uri_column = first_present(frame, ["concept_uri", "uri"])
    label_column = first_present(frame, ["preferred_label", "preferredlabel"])
    if not uri_column or not label_column:
        raise ValueError("ESCO skills file is missing a URI or preferred-label column.")

    output = pd.DataFrame(
        {
            "skill_uri": frame[uri_column],
            "preferred_label": frame[label_column],
            "skill_type": frame.get("skill_type"),
            "reusability_level": frame.get("reusability_level"),
            "description": frame.get("description"),
            "digital_skill_indicator": frame.get("digital_skill_indicator"),
            "green_skill_indicator": frame.get("green_skill_indicator"),
            "version": version,
        }
    )
    output = stringify_columns(output, output.columns)
    return output.drop_duplicates(subset=["skill_uri"]).reset_index(drop=True)


def prepare_esco_relations(frame: pd.DataFrame, version: str) -> pd.DataFrame:
    frame = normalize_columns(frame).copy()
    occupation_column = first_present(frame, ["occupation_uri"])
    skill_column = first_present(frame, ["skill_uri"])
    if not occupation_column or not skill_column:
        raise ValueError("ESCO relation file is missing occupation_uri or skill_uri.")

    output = pd.DataFrame(
        {
            "occupation_uri": frame[occupation_column],
            "skill_uri": frame[skill_column],
            "relation_type": frame.get("relation_type"),
            "essential_flag": frame.get("essential_flag"),
            "version": version,
        }
    )
    output = stringify_columns(output, output.columns)
    return output.drop_duplicates().reset_index(drop=True)


def load_excel_sheet(path: Path) -> pd.DataFrame:
    if path.suffix.lower() == ".csv":
        return normalize_columns(pd.read_csv(path, low_memory=False))

    workbook = pd.ExcelFile(path)
    for sheet_name in workbook.sheet_names:
        frame = workbook.parse(sheet_name)
        frame = frame.dropna(how="all")
        if frame.empty:
            continue
        normalized = normalize_columns(frame)
        has_esco = any(column in normalized.columns for column in ["esco_uri", "esco_label", "concept_uri"])
        has_nace = any(column in normalized.columns for column in ["nace_rev2_code", "nace_rev2_label"])
        if has_esco and has_nace:
            return normalized
    raise ValueError(f"No usable ESCO-NACE crosswalk sheet found in {path}")


def prepare_crosswalk(frame: pd.DataFrame, version: str) -> pd.DataFrame:
    frame = normalize_columns(frame).copy()
    esco_column = first_present(frame, ["esco_uri", "concept_uri"])
    nace_code_column = first_present(frame, ["nace_rev2_code"])
    if not esco_column or not nace_code_column:
        raise ValueError("ESCO-NACE crosswalk is missing an ESCO URI or NACE code column.")

    nace_label_column = first_present(frame, ["nace_rev2_label"])
    esco_label_column = first_present(frame, ["esco_label", "preferred_label"])

    output = pd.DataFrame(
        {
            "esco_uri": frame[esco_column],
            "esco_label": frame.get(esco_label_column),
            "nace_rev2_code": frame[nace_code_column],
            "nace_rev2_label": frame.get(nace_label_column),
            "mapping_type": frame.get("mapping_type"),
            "mapping_strength": frame.get("mapping_strength"),
            "crosswalk_version": version,
        }
    )
    output = stringify_columns(output, output.columns)
    return output.drop_duplicates().reset_index(drop=True)


def build_manifest_entry(path: Path, record_count: int, asset_type: str, version: str) -> Dict[str, Any]:
    return {
        "asset_type": asset_type,
        "version": version,
        "record_count": int(record_count),
        "output": str(path.resolve()),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Prepare ESCO reference assets for analytics use")
    parser.add_argument("--config", type=Path, default=Path("configs/reference_sources.yaml"))
    parser.add_argument("--input-dir", type=Path, default=Path("data/reference_raw"))
    parser.add_argument("--output-dir", type=Path, default=Path("data/reference"))
    parser.add_argument("--manifest", type=Path, default=Path("data/reference/manifest.json"))
    parser.add_argument("--occupations-file", type=Path)
    parser.add_argument("--skills-file", type=Path)
    parser.add_argument("--relations-file", type=Path)
    parser.add_argument("--crosswalk-file", type=Path)
    parser.add_argument("--classification-zip", type=Path)
    args = parser.parse_args()

    config = load_yaml(args.config)
    versions = config.get("versions", {})
    inputs = config.get("inputs", {})

    resolved_inputs = resolve_reference_inputs(
        args.input_dir,
        inputs,
        {
            "esco_occupations": args.occupations_file,
            "esco_skills": args.skills_file,
            "esco_occupation_skill_relations": args.relations_file,
            "esco_classification_zip": args.classification_zip,
        },
    )
    occupations_path = resolved_inputs["esco_occupations"]
    skills_path = resolved_inputs["esco_skills"]
    relations_path = resolved_inputs["esco_occupation_skill_relations"]
    crosswalk_path = args.crosswalk_file or (args.input_dir / inputs["esco_nace_crosswalk"])

    args.output_dir.mkdir(parents=True, exist_ok=True)
    manifest: Dict[str, Any] = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "sources": config.get("sources", {}),
        "assets": [],
        "missing_inputs": [],
    }

    if occupations_path.exists():
        occupations = pd.read_csv(occupations_path, low_memory=False)
        prepared = prepare_esco_occupations(occupations, versions.get("esco", "unknown"))
        output_path = args.output_dir / "esco_occupations.parquet"
        write_parquet(output_path, prepared)
        manifest["assets"].append(build_manifest_entry(output_path, len(prepared), "esco_occupations", versions.get("esco", "unknown")))
    else:
        manifest["missing_inputs"].append(str(occupations_path))

    if skills_path.exists():
        skills = pd.read_csv(skills_path, low_memory=False)
        prepared = prepare_esco_skills(skills, versions.get("esco", "unknown"))
        output_path = args.output_dir / "esco_skills.parquet"
        write_parquet(output_path, prepared)
        manifest["assets"].append(build_manifest_entry(output_path, len(prepared), "esco_skills", versions.get("esco", "unknown")))
    else:
        manifest["missing_inputs"].append(str(skills_path))

    if relations_path.exists():
        relations = pd.read_csv(relations_path, low_memory=False)
        prepared = prepare_esco_relations(relations, versions.get("esco", "unknown"))
        output_path = args.output_dir / "esco_occupation_skill_relations.parquet"
        write_parquet(output_path, prepared)
        manifest["assets"].append(
            build_manifest_entry(output_path, len(prepared), "esco_occupation_skill_relations", versions.get("esco", "unknown"))
        )
    else:
        manifest["missing_inputs"].append(str(relations_path))

    if crosswalk_path.exists():
        crosswalk = load_excel_sheet(crosswalk_path)
        prepared = prepare_crosswalk(crosswalk, versions.get("esco_nace_crosswalk", "unknown"))
        output_path = args.output_dir / "esco_nace_crosswalk.parquet"
        write_parquet(output_path, prepared)
        manifest["assets"].append(build_manifest_entry(output_path, len(prepared), "esco_nace_crosswalk", versions.get("esco_nace_crosswalk", "unknown")))
    else:
        manifest["missing_inputs"].append(str(crosswalk_path))

    args.manifest.parent.mkdir(parents=True, exist_ok=True)
    with args.manifest.open("w", encoding="utf-8") as handle:
        json.dump(manifest, handle, indent=2)

    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
