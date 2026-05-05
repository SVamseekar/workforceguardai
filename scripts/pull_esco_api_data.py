#!/usr/bin/env python3
"""Pull official ESCO reference data via the European Commission ESCO API.

This script materializes the minimum Phase 1 reference assets needed for
WorkforceGuard:
- occupations
- skills
- occupation-to-skill relations

The ESCO-NACE crosswalk remains an official downloadable file and is handled
by `scripts/prepare_reference_data.py`.
"""
from __future__ import annotations

import argparse
import json
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List

import pandas as pd
import requests

try:
    import pyarrow as pa
    import pyarrow.parquet as pq
except Exception as exc:  # pragma: no cover
    raise SystemExit("pyarrow is required. Install with: pip install pyarrow") from exc


BASE_URL = "https://ec.europa.eu/esco/api/resource"
ESCO_OCCUPATION_SCHEME = "http://data.europa.eu/esco/concept-scheme/occupations"
ESCO_SKILL_SCHEME = "http://data.europa.eu/esco/concept-scheme/skills"


def write_parquet(path: Path, frame: pd.DataFrame) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    table = pa.Table.from_pandas(frame, preserve_index=False)
    pq.write_table(table, path, compression="snappy")


def fetch_json(session: requests.Session, url: str, params: Dict[str, Any]) -> Dict[str, Any]:
    last_error: Exception | None = None
    for attempt in range(5):
        try:
            response = session.get(url, params=params, timeout=60, headers={"Accept": "application/json"})
            response.raise_for_status()
            return response.json()
        except requests.RequestException as exc:
            last_error = exc
            time.sleep(1.5 * (attempt + 1))
    if last_error:
        raise last_error
    raise RuntimeError("ESCO request failed without a captured exception")


def paged_concepts(
    session: requests.Session,
    kind: str,
    scheme_uri: str,
    version: str,
    language: str,
    page_size: int = 50,
) -> List[Dict[str, Any]]:
    url = f"{BASE_URL}/{kind}"
    concepts: List[Dict[str, Any]] = []
    next_url = url
    next_params: Dict[str, Any] | None = {
        "isInScheme": scheme_uri,
        "language": language,
        "selectedVersion": version,
        "limit": page_size,
        "offset": 0,
    }

    while True:
        payload = fetch_json(session, next_url, next_params or {})
        batch = payload.get("concepts", [])
        concepts.extend(batch)
        next_href = payload.get("_links", {}).get("next", {}).get("href")
        if not batch or not next_href:
            break
        next_url = next_href
        next_params = None

    return concepts


def concept_detail(session: requests.Session, kind: str, uri: str, version: str, language: str) -> Dict[str, Any]:
    return fetch_json(
        session,
        f"{BASE_URL}/{kind}",
        {"uri": uri, "language": language, "selectedVersion": version},
    )


def english_label(value: Any) -> str | None:
    if isinstance(value, dict):
        return value.get("en") or next(iter(value.values()), None)
    if isinstance(value, list):
        return value[0] if value else None
    return value


def normalize_occupations(details: Iterable[Dict[str, Any]], version: str) -> pd.DataFrame:
    rows = []
    for item in details:
        rows.append(
            {
                "esco_uri": item.get("uri"),
                "preferred_label": english_label(item.get("preferredLabel")) or item.get("title"),
                "description": english_label(item.get("description")),
                "code": item.get("code"),
                "concept_type": item.get("className"),
                "version": version,
            }
        )
    return pd.DataFrame(rows).drop_duplicates(subset=["esco_uri"]).reset_index(drop=True)


def normalize_skills(details: Iterable[Dict[str, Any]], version: str) -> pd.DataFrame:
    rows = []
    for item in details:
        rows.append(
            {
                "skill_uri": item.get("uri"),
                "preferred_label": english_label(item.get("preferredLabel")) or item.get("title"),
                "description": english_label(item.get("description")),
                "skill_type": item.get("className") or item.get("skillType"),
                "reuse_level": item.get("reuseLevel"),
                "version": version,
            }
        )
    return pd.DataFrame(rows).drop_duplicates(subset=["skill_uri"]).reset_index(drop=True)


def normalize_relations(details: Iterable[Dict[str, Any]], version: str) -> pd.DataFrame:
    rows = []
    for item in details:
        occupation_uri = item.get("uri")
        for link_type, essential_flag in (("hasEssentialSkill", True), ("hasOptionalSkill", False)):
            for linked_skill in item.get("_links", {}).get(link_type, []):
                rows.append(
                    {
                        "occupation_uri": occupation_uri,
                        "skill_uri": linked_skill.get("uri"),
                        "relation_type": link_type,
                        "essential_flag": essential_flag,
                        "version": version,
                    }
                )
    return pd.DataFrame(rows).drop_duplicates().reset_index(drop=True)


def fetch_detail_batch(kind: str, uris: List[str], version: str, language: str, max_workers: int) -> List[Dict[str, Any]]:
    details: List[Dict[str, Any]] = []
    with requests.Session() as session:
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            futures = {
                executor.submit(concept_detail, session, kind, uri, version, language): uri
                for uri in uris
            }
            for future in as_completed(futures):
                details.append(future.result())
    return details


def main() -> None:
    parser = argparse.ArgumentParser(description="Pull ESCO occupations, skills, and relations via API")
    parser.add_argument("--output-dir", type=Path, default=Path("data/reference"))
    parser.add_argument("--manifest", type=Path, default=Path("data/reference/esco_api_manifest.json"))
    parser.add_argument("--version", default="v1.2.0")
    parser.add_argument("--language", default="en")
    parser.add_argument("--max-workers", type=int, default=8)
    parser.add_argument("--page-size", type=int, default=50)
    args = parser.parse_args()

    manifest: Dict[str, Any] = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source": "official_esco_api",
        "version": args.version,
        "language": args.language,
        "assets": [],
    }

    with requests.Session() as session:
        occupation_refs = paged_concepts(
            session, "occupation", ESCO_OCCUPATION_SCHEME, args.version, args.language, page_size=args.page_size
        )
        skill_refs = paged_concepts(
            session, "skill", ESCO_SKILL_SCHEME, args.version, args.language, page_size=args.page_size
        )

    print(f"Fetched {len(occupation_refs)} occupation references")
    print(f"Fetched {len(skill_refs)} skill references")

    occupation_uris = [item["uri"] for item in occupation_refs]
    occupation_details = fetch_detail_batch("occupation", occupation_uris, args.version, args.language, args.max_workers)
    print(f"Fetched {len(occupation_details)} occupation detail records")

    occupations = normalize_occupations(occupation_details, args.version)
    skills = normalize_skills(skill_refs, args.version)
    relations = normalize_relations(occupation_details, args.version)

    args.output_dir.mkdir(parents=True, exist_ok=True)
    occupation_path = args.output_dir / "esco_occupations.parquet"
    skills_path = args.output_dir / "esco_skills.parquet"
    relations_path = args.output_dir / "esco_occupation_skill_relations.parquet"

    write_parquet(occupation_path, occupations)
    write_parquet(skills_path, skills)
    write_parquet(relations_path, relations)

    manifest["assets"] = [
        {"asset_type": "esco_occupations", "rows": int(len(occupations)), "output": str(occupation_path.resolve())},
        {"asset_type": "esco_skills", "rows": int(len(skills)), "output": str(skills_path.resolve())},
        {
            "asset_type": "esco_occupation_skill_relations",
            "rows": int(len(relations)),
            "output": str(relations_path.resolve()),
        },
    ]

    args.manifest.parent.mkdir(parents=True, exist_ok=True)
    with args.manifest.open("w", encoding="utf-8") as handle:
        json.dump(manifest, handle, indent=2)

    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
