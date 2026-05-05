#!/usr/bin/env python3
"""Generate EU-calibrated training datasets (schema-preserving).

This script uses EU-informed priors to generate large, EU-calibrated datasets
that preserve the original schemas of the four learning projects.
"""
from __future__ import annotations

import argparse
from pathlib import Path
from typing import Dict, List

import numpy as np
import pandas as pd
import yaml

try:
    import pyarrow as pa
    import pyarrow.parquet as pq
except Exception as exc:  # pragma: no cover
    raise SystemExit(
        "pyarrow is required for Parquet output. Install with: pip install pyarrow"
    ) from exc


DATASET_KEYS = ["amazon_access", "employee_turnover", "income_qualification", "housing"]


def load_yaml(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def normalize_weights(weights: List[float]) -> np.ndarray:
    w = np.array(weights, dtype=float)
    total = w.sum()
    if total <= 0:
        raise ValueError("Year weights must sum to a positive value.")
    return w / total


def allocate_rows(total_rows: int, weights: np.ndarray) -> List[int]:
    return list(np.random.multinomial(total_rows, weights))


def minmax_norm(x: np.ndarray, vmin: float, vmax: float) -> np.ndarray:
    denom = (vmax - vmin) if vmax != vmin else 1.0
    return np.clip((x - vmin) / denom, 0.0, 1.0)


def build_nuts2_catalog(count: int, bounds: dict, rng: np.random.Generator) -> pd.DataFrame:
    codes = [f"NUTS2_{i:03d}" for i in range(1, count + 1)]
    lat = rng.uniform(bounds["eu_latitude"]["min"], bounds["eu_latitude"]["max"], size=count)
    lon = rng.uniform(bounds["eu_longitude"]["min"], bounds["eu_longitude"]["max"], size=count)
    return pd.DataFrame({"nuts2": codes, "latitude": lat, "longitude": lon})


def build_company_registry(
    count: int, nuts2_codes: List[str], rng: np.random.Generator
) -> pd.DataFrame:
    sectors = [
        "Manufacturing",
        "Information",
        "Finance",
        "Professional",
        "Retail",
        "Health",
        "Education",
        "Construction",
        "Transportation",
        "Hospitality",
        "Energy",
        "Public",
        "Agriculture",
        "Other",
    ]
    company_ids = [f"C{idx:04d}" for idx in range(1, count + 1)]
    nuts2 = rng.choice(nuts2_codes, size=count, replace=True)
    sector = rng.choice(sectors, size=count, replace=True)
    weights = rng.lognormal(mean=0.0, sigma=0.8, size=count)
    weights = weights / weights.sum()
    return pd.DataFrame(
        {"company_id": company_ids, "nuts2": nuts2, "sector": sector, "weight": weights}
    )


def build_region_year_priors(
    years: List[int], nuts2_codes: List[str], priors_cfg: dict, rng: np.random.Generator
) -> pd.DataFrame:
    rows = []
    for year in years:
        for nuts2 in nuts2_codes:
            row = {"year": year, "nuts2": nuts2}
            for key, bounds in priors_cfg.items():
                row[key] = rng.uniform(bounds["min"], bounds["max"])
            rows.append(row)
    return pd.DataFrame(rows)


def load_base_datasets(repo_root: Path) -> Dict[str, pd.DataFrame]:
    return {
        "amazon_access": pd.read_csv(
            repo_root / "projects" / "Amazon Employee Access" / "data" / "train" / "train.csv"
        ),
        "employee_turnover": pd.read_excel(
            repo_root
            / "projects"
            / "Employee Turnover Analytics"
            / "data"
            / "1673873196_hr_comma_sep.xlsx"
        ),
        "income_qualification": pd.read_csv(
            repo_root / "projects" / "Income Qualification" / "data" / "train.csv"
        ),
        "housing": pd.read_excel(
            repo_root
            / "projects"
            / "California Housing Price Prediction"
            / "data"
            / "1553768847_housing.xlsx"
        ),
    }


def adjust_amazon_access(
    df: pd.DataFrame, priors: dict, cfg: dict, base_rate: float, rng: np.random.Generator
) -> pd.DataFrame:
    vacancy_norm = minmax_norm(
        priors["vacancy_rate_pct"], cfg["vacancy_rate_pct"]["min"], cfg["vacancy_rate_pct"]["max"]
    )
    p_action = base_rate - (vacancy_norm - 0.5) * 0.08
    p_action = np.clip(p_action, 0.85, 0.99)
    df["ACTION"] = rng.binomial(1, p_action, size=len(df))
    return df


def adjust_employee_turnover(
    df: pd.DataFrame, priors: dict, cfg: dict, base_stats: dict, rng: np.random.Generator
) -> pd.DataFrame:
    satisfaction = df["satisfaction_level"].to_numpy()
    hours = df["average_montly_hours"].to_numpy()
    projects = df["number_project"].to_numpy()
    tenure = df["time_spend_company"].to_numpy()
    promo = df["promotion_last_5years"].to_numpy()

    hours_norm = minmax_norm(hours, base_stats["hours_min"], base_stats["hours_max"])
    projects_norm = minmax_norm(projects, base_stats["projects_min"], base_stats["projects_max"])
    tenure_norm = minmax_norm(tenure, base_stats["tenure_min"], base_stats["tenure_max"])

    base_risk = (
        (1 - satisfaction) * 0.4
        + hours_norm * 0.2
        + projects_norm * 0.2
        + tenure_norm * 0.1
        + (1 - promo) * 0.1
    )

    vacancy_norm = minmax_norm(
        priors["vacancy_rate_pct"], cfg["vacancy_rate_pct"]["min"], cfg["vacancy_rate_pct"]["max"]
    )
    housing_norm = minmax_norm(
        priors["housing_overburden_pct"],
        cfg["housing_overburden_pct"]["min"],
        cfg["housing_overburden_pct"]["max"],
    )
    commute_norm = minmax_norm(
        priors["commute_minutes"], cfg["commute_minutes"]["min"], cfg["commute_minutes"]["max"]
    )

    adj = 0.3 * vacancy_norm + 0.3 * housing_norm + 0.2 * commute_norm
    risk = np.clip(base_risk * 0.6 + adj * 0.4, 0.01, 0.99)
    df["left"] = rng.binomial(1, risk, size=len(df))
    return df


def adjust_income_qualification(
    df: pd.DataFrame, priors: dict, cfg: dict, rng: np.random.Generator
) -> pd.DataFrame:
    housing_norm = minmax_norm(
        priors["housing_overburden_pct"],
        cfg["housing_overburden_pct"]["min"],
        cfg["housing_overburden_pct"]["max"],
    )
    target = df["Target"].to_numpy().astype(int)
    shift_prob = 0.05 + 0.25 * housing_norm
    improve_prob = 0.03 * (1 - housing_norm)

    rand = rng.random(len(df))
    target = np.where((rand < shift_prob) & (target > 1), target - 1, target)
    rand2 = rng.random(len(df))
    target = np.where((rand2 < improve_prob) & (target < 4), target + 1, target)

    df["Target"] = target
    return df


def adjust_housing(
    df: pd.DataFrame,
    priors: dict,
    priors_cfg: dict,
    bounds_cfg: dict,
    region_lat: np.ndarray,
    region_lon: np.ndarray,
    rng: np.random.Generator,
) -> pd.DataFrame:
    housing_norm = minmax_norm(
        priors["housing_overburden_pct"],
        priors_cfg["housing_overburden_pct"]["min"],
        priors_cfg["housing_overburden_pct"]["max"],
    )
    rent_norm = minmax_norm(
        priors["rent_inflation_pct"],
        priors_cfg["rent_inflation_pct"]["min"],
        priors_cfg["rent_inflation_pct"]["max"],
    )
    employment_norm = minmax_norm(
        priors["employment_rate_pct"],
        priors_cfg["employment_rate_pct"]["min"],
        priors_cfg["employment_rate_pct"]["max"],
    )

    price_factor = 0.8 + housing_norm * 0.5 + rent_norm * 0.2
    income_factor = 0.9 + employment_norm * 0.2

    df["median_house_value"] = np.round(
        df["median_house_value"].to_numpy(dtype=float) * price_factor
    ).astype(int)
    df["median_income"] = df["median_income"].to_numpy(dtype=float) * income_factor

    df["latitude"] = region_lat + rng.normal(0, 0.5, size=len(df))
    df["longitude"] = region_lon + rng.normal(0, 0.5, size=len(df))
    df["latitude"] = np.clip(
        df["latitude"], bounds_cfg["eu_latitude"]["min"], bounds_cfg["eu_latitude"]["max"]
    )
    df["longitude"] = np.clip(
        df["longitude"], bounds_cfg["eu_longitude"]["min"], bounds_cfg["eu_longitude"]["max"]
    )

    return df


def write_parquet(path: Path, schema: pa.Schema, tables: List[pa.Table]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    writer = pq.ParquetWriter(path, schema=schema, compression="snappy")
    try:
        for table in tables:
            writer.write_table(table)
    finally:
        writer.close()


def generate_dataset(
    name: str,
    base_df: pd.DataFrame,
    output_dir: Path,
    links_dir: Path,
    years: List[int],
    rows_per_year: List[int],
    company_registry: pd.DataFrame,
    region_year_priors: pd.DataFrame,
    nuts2_catalog: pd.DataFrame,
    priors_cfg: dict,
    bounds_cfg: dict,
    chunk_size: int,
    rng: np.random.Generator,
) -> None:
    base_rate = None
    base_stats = {}
    if name == "amazon_access":
        base_rate = base_df["ACTION"].mean()
    if name == "employee_turnover":
        base_stats = {
            "hours_min": base_df["average_montly_hours"].min(),
            "hours_max": base_df["average_montly_hours"].max(),
            "projects_min": base_df["number_project"].min(),
            "projects_max": base_df["number_project"].max(),
            "tenure_min": base_df["time_spend_company"].min(),
            "tenure_max": base_df["time_spend_company"].max(),
        }

    nuts2_codes = nuts2_catalog["nuts2"].tolist()
    nuts2_index = {code: idx for idx, code in enumerate(nuts2_codes)}

    company_ids = company_registry["company_id"].to_numpy()
    company_weights = company_registry["weight"].to_numpy()
    company_nuts2 = company_registry["nuts2"].to_numpy()
    company_nuts2_idx = np.array([nuts2_index[c] for c in company_nuts2])

    priors_by_year = {}
    for year in years:
        year_df = (
            region_year_priors[region_year_priors["year"] == year]
            .set_index("nuts2")
            .loc[nuts2_codes]
        )
        priors_by_year[year] = {
            "vacancy_rate_pct": year_df["vacancy_rate_pct"].to_numpy(),
            "housing_overburden_pct": year_df["housing_overburden_pct"].to_numpy(),
            "commute_minutes": year_df["commute_minutes"].to_numpy(),
            "gender_pay_gap_pct": year_df["gender_pay_gap_pct"].to_numpy(),
            "job_quality_index": year_df["job_quality_index"].to_numpy(),
            "employment_rate_pct": year_df["employment_rate_pct"].to_numpy(),
            "rent_inflation_pct": year_df["rent_inflation_pct"].to_numpy(),
        }

    row_id = 1

    for year, total_rows in zip(years, rows_per_year):
        if total_rows == 0:
            continue
        output_path = output_dir / name / f"{year}.parquet"
        links_path = links_dir / name / f"{year}.parquet"
        output_path.parent.mkdir(parents=True, exist_ok=True)
        links_path.parent.mkdir(parents=True, exist_ok=True)

        data_writer = None
        links_writer = None

        priors_arrays = priors_by_year[year]

        remaining = total_rows
        while remaining > 0:
            batch = min(chunk_size, remaining)
            remaining -= batch

            sample_idx = rng.integers(0, len(base_df), size=batch)
            df = base_df.iloc[sample_idx].copy()

            company_idx = rng.choice(len(company_ids), size=batch, p=company_weights)
            nuts2_idx = company_nuts2_idx[company_idx]
            nuts2 = company_nuts2[company_idx]

            priors = {key: arr[nuts2_idx] for key, arr in priors_arrays.items()}

            if name == "amazon_access":
                df = adjust_amazon_access(df, priors, priors_cfg, base_rate, rng)
            elif name == "employee_turnover":
                df = adjust_employee_turnover(df, priors, priors_cfg, base_stats, rng)
            elif name == "income_qualification":
                df = adjust_income_qualification(df, priors, priors_cfg, rng)
            elif name == "housing":
                region_lat = nuts2_catalog["latitude"].to_numpy()[nuts2_idx]
                region_lon = nuts2_catalog["longitude"].to_numpy()[nuts2_idx]
                df = adjust_housing(
                    df,
                    priors,
                    priors_cfg,
                    bounds_cfg,
                    region_lat,
                    region_lon,
                    rng,
                )

            row_ids = np.arange(row_id, row_id + batch, dtype=np.int64)
            row_id += batch

            link_df = pd.DataFrame(
                {
                    "row_id": row_ids,
                    "year": np.full(batch, year, dtype=np.int16),
                    "nuts2": nuts2,
                    "company_id": company_ids[company_idx],
                }
            )

            data_table = pa.Table.from_pandas(df, preserve_index=False)
            link_table = pa.Table.from_pandas(link_df, preserve_index=False)

            if data_writer is None:
                data_writer = pq.ParquetWriter(output_path, data_table.schema, compression="snappy")
            if links_writer is None:
                links_writer = pq.ParquetWriter(links_path, link_table.schema, compression="snappy")

            data_writer.write_table(data_table)
            links_writer.write_table(link_table)

        if data_writer is not None:
            data_writer.close()
        if links_writer is not None:
            links_writer.close()

        print(f"[{name}] {year}: {total_rows} rows -> {output_path}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate EU-calibrated datasets")
    parser.add_argument(
        "--config",
        type=Path,
        default=Path("configs/eu_priors.yaml"),
        help="Path to priors config",
    )
    parser.add_argument("--output-dir", type=Path, default=Path("data/eu_calibrated"))
    parser.add_argument("--links-dir", type=Path, default=Path("data/links"))
    parser.add_argument("--priors-dir", type=Path, default=Path("data/priors"))
    parser.add_argument("--dry-run", action="store_true", help="Generate a small sample")
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parents[1]
    cfg = load_yaml(repo_root / args.config)

    rng = np.random.default_rng(cfg.get("seed", 42))

    years = cfg["scale"]["years"]
    weights = normalize_weights(cfg["scale"]["year_weights"])
    total_rows = cfg["scale"]["total_rows_per_dataset"]
    chunk_size = cfg["scale"]["chunk_size"]

    if args.dry_run:
        total_rows = min(20000, total_rows)
        chunk_size = min(5000, chunk_size)

    rows_per_year = allocate_rows(total_rows, weights)

    nuts2_catalog = build_nuts2_catalog(cfg["scale"]["nuts2_count"], cfg["bounds"], rng)
    company_registry = build_company_registry(
        cfg["scale"]["company_count"], nuts2_catalog["nuts2"].tolist(), rng
    )
    region_year_priors = build_region_year_priors(
        years, nuts2_catalog["nuts2"].tolist(), cfg["priors"], rng
    )

    args.priors_dir.mkdir(parents=True, exist_ok=True)
    nuts2_catalog.to_parquet(args.priors_dir / "nuts2_catalog.parquet", index=False)
    company_registry.to_parquet(args.priors_dir / "company_registry.parquet", index=False)
    region_year_priors.to_parquet(args.priors_dir / "region_year_priors.parquet", index=False)

    base_data = load_base_datasets(repo_root)

    for name, df in base_data.items():
        generate_dataset(
            name=name,
            base_df=df,
            output_dir=repo_root / args.output_dir,
            links_dir=repo_root / args.links_dir,
            years=years,
            rows_per_year=rows_per_year,
            company_registry=company_registry,
            region_year_priors=region_year_priors,
            nuts2_catalog=nuts2_catalog,
            priors_cfg=cfg["priors"],
            bounds_cfg=cfg["bounds"],
            chunk_size=chunk_size,
            rng=rng,
        )

    print("Done. EU-calibrated datasets generated.")


if __name__ == "__main__":
    main()
