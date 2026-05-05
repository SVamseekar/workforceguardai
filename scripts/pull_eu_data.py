#!/usr/bin/env python3
"""Pull official Eurostat datasets and save them as modeled-ready Parquet files.

This script is intentionally production-friendly:
- dataset selection can be narrowed for incremental refreshes
- each run writes a manifest describing what succeeded or failed
- metadata is stored alongside the raw extracts for later provenance work
"""
from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Tuple

import numpy as np
import pandas as pd
import requests
import yaml

try:
    import pyarrow as pa
    import pyarrow.parquet as pq
except Exception as exc:  # pragma: no cover
    raise SystemExit("pyarrow is required. Install with: pip install pyarrow") from exc


def load_yaml(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def build_params(base: dict, extra: dict | None = None) -> dict:
    params = dict(base)
    if extra:
        for key, values in extra.items():
            if values is None:
                continue
            if isinstance(values, (list, tuple)):
                params[key] = ",".join(map(str, values))
            else:
                params[key] = str(values)
    return params


def request_json(url: str, params: dict, timeout: int = 120) -> dict:
    resp = requests.get(url, params=params, timeout=timeout)
    if resp.status_code != 200:
        raise RuntimeError(f"HTTP {resp.status_code} for {resp.url}: {resp.text[:200]}")
    return resp.json()


def discover_dimensions(code: str, base_url: str, lang: str) -> Tuple[List[str], Dict[str, List[str]], dict]:
    url = f"{base_url}/{code}"
    params = {"lang": lang, "lastTimePeriod": 1}
    js = request_json(url, params=params)
    dims = js.get("id", [])
    categories: Dict[str, List[str]] = {}
    for dim in dims:
        cat = js.get("dimension", {}).get(dim, {}).get("category", {})
        idx = cat.get("index", {})
        categories[dim] = list(idx.keys())
    meta = {
        "code": code,
        "label": js.get("label"),
        "updated": js.get("updated"),
        "dimensions": dims,
        "categories": {k: v[:50] for k, v in categories.items()},
    }
    return dims, categories, meta


def validate_filters(filters: dict, categories: Dict[str, List[str]]) -> dict:
    valid = {}
    for dim, values in filters.items():
        if dim not in categories:
            continue
        if not isinstance(values, (list, tuple)):
            values = [values]
        keep = [v for v in values if v in categories.get(dim, [])]
        if keep:
            valid[dim] = keep
    return valid


def jsonstat_to_frame(js: dict) -> pd.DataFrame:
    dims = js.get("id", [])
    sizes = js.get("size", [])
    if not dims or not sizes:
        raise ValueError("JSON-stat missing id/size dimensions.")

    dim_info = js.get("dimension", {})
    index_maps = {}
    code_by_index = {}
    label_maps = {}

    for dim in dims:
        cat = dim_info[dim]["category"]
        idx_map = cat.get("index", {})
        index_maps[dim] = idx_map
        code_by_index[dim] = {idx: code for code, idx in idx_map.items()}
        label_maps[dim] = cat.get("label", {})

    values = js.get("value", {})
    if isinstance(values, dict):
        indices = np.array(list(map(int, values.keys())), dtype=int)
        val = np.array(list(values.values()))
    else:
        val_arr = np.array(values)
        mask = ~pd.isna(val_arr)
        indices = np.arange(len(val_arr))[mask]
        val = val_arr[mask]

    if indices.size == 0:
        return pd.DataFrame(columns=[*dims, "value"])

    multi_idx = np.array(np.unravel_index(indices, sizes)).T

    data = {}
    for i, dim in enumerate(dims):
        codes = [code_by_index[dim][idx] for idx in multi_idx[:, i]]
        data[dim] = codes
        labels = label_maps.get(dim, {})
        if labels:
            data[f"{dim}_label"] = [labels.get(code, "") for code in codes]

    df = pd.DataFrame(data)
    df["value"] = val
    return df


def apply_geo_filter(df: pd.DataFrame, geo_codes: List[str], geo_level: str) -> pd.DataFrame:
    if "geo" not in df.columns:
        return df
    df = df[df["geo"].isin(geo_codes)].copy()
    if geo_level == "nuts2":
        df = df[df["geo"].str.len() == 4]
    elif geo_level == "country":
        df = df[df["geo"].str.len() == 2]
    return df


def write_parquet(path: Path, df: pd.DataFrame) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    table = pa.Table.from_pandas(df, preserve_index=False)
    pq.write_table(table, path, compression="snappy")


def fetch_dataset(
    code: str,
    base_url: str,
    lang: str,
    time_start: int,
    time_end: int,
    geo_level: str,
    geo_codes: List[str],
    filters: dict,
) -> Tuple[pd.DataFrame, dict]:
    url = f"{base_url}/{code}"
    dims, categories, meta = discover_dimensions(code, base_url, lang)

    base_params: Dict[str, Any] = {"lang": lang}
    if "time" in dims:
        base_params["sinceTimePeriod"] = str(time_start)
        base_params["untilTimePeriod"] = str(time_end)
    if "geo" in dims and geo_codes:
        base_params["geo"] = geo_codes
    elif "geo" in dims and geo_level in {"country", "nuts1", "nuts2", "nuts3"}:
        base_params["geoLevel"] = geo_level

    validated = validate_filters(filters, categories)
    params = build_params(base_params, validated)

    js = request_json(url, params=params)
    df = jsonstat_to_frame(js)
    meta["dimensions"] = js.get("id")
    return df, meta


def main() -> None:
    parser = argparse.ArgumentParser(description="Pull EU-wide data from Eurostat API")
    parser.add_argument("--config", type=Path, default=Path("configs/eu_sources.yaml"))
    parser.add_argument("--output", type=Path, default=Path("data/eu_raw"))
    parser.add_argument("--meta", type=Path, default=Path("data/eu_meta"))
    parser.add_argument(
        "--datasets",
        nargs="+",
        help="Optional list of dataset names to fetch. Defaults to all configured datasets.",
    )
    parser.add_argument("--dry-run", action="store_true", help="Limit to first dataset")
    args = parser.parse_args()

    cfg = load_yaml(args.config)
    settings = cfg["settings"]
    base_url = settings["base_url"]
    lang = settings.get("lang", "EN")
    time_start = int(settings["time_start"])
    time_end = int(settings["time_end"])

    geo = settings["geo"]
    geo_level = geo.get("level", "country")
    geo_codes = geo.get("eu27", [])

    datasets = cfg.get("datasets", [])
    if args.datasets:
        requested = set(args.datasets)
        datasets = [dataset for dataset in datasets if dataset["name"] in requested]
        missing = sorted(requested - {dataset["name"] for dataset in datasets})
        if missing:
            raise SystemExit(f"Unknown dataset names requested: {', '.join(missing)}")
    if args.dry_run:
        datasets = datasets[:1]

    args.output.mkdir(parents=True, exist_ok=True)
    args.meta.mkdir(parents=True, exist_ok=True)

    manifest = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "base_url": base_url,
        "geo_level": geo_level,
        "requested_datasets": [dataset["name"] for dataset in datasets],
        "completed": [],
        "failed": [],
    }

    for ds in datasets:
        name = ds["name"]
        code = ds["code"]
        filters = ds.get("filters", {})

        print(f"Fetching {name} ({code})...")
        try:
            df, meta = fetch_dataset(
                code=code,
                base_url=base_url,
                lang=lang,
                time_start=time_start,
                time_end=time_end,
                geo_level=geo_level,
                geo_codes=geo_codes,
                filters=filters,
            )
            df = apply_geo_filter(df, geo_codes, geo_level)

            write_parquet(args.output / f"{name}.parquet", df)
            with (args.meta / f"{name}.json").open("w", encoding="utf-8") as f:
                json.dump(meta, f, indent=2)

            manifest["completed"].append(
                {
                    "dataset": name,
                    "code": code,
                    "rows": int(len(df)),
                    "dimensions": meta.get("dimensions", []),
                    "output": str((args.output / f"{name}.parquet").resolve()),
                }
            )

            print(f"Saved {name}: {len(df)} rows")
        except Exception as exc:
            error_path = args.meta / "errors.json"
            errors = []
            if error_path.exists():
                with error_path.open("r", encoding="utf-8") as f:
                    errors = json.load(f)
            errors.append({"dataset": name, "code": code, "error": str(exc)})
            with error_path.open("w", encoding="utf-8") as f:
                json.dump(errors, f, indent=2)
            manifest["failed"].append({"dataset": name, "code": code, "error": str(exc)})
            print(f"Skipped {name} due to error: {exc}")

    with (args.meta / "manifest.json").open("w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)

    print("Done.")


if __name__ == "__main__":
    main()
