# scripts/ingest_uk_gpg.py
"""
Cleans and converts UK Gender Pay Gap CSV to parquet.
Run from project root: python scripts/ingest_uk_gpg.py
Input: data/public_company_raw/uk/uk_gpg_2024.csv
Output: data/public_company/uk_gpg.parquet
"""
from pathlib import Path
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "data" / "public_company_raw" / "uk" / "uk_gpg_2024.csv"
DST = ROOT / "data" / "public_company" / "uk_gpg.parquet"
DST.parent.mkdir(parents=True, exist_ok=True)

SIZE_BAND_MAP = {
    "Less than 250": "50-250",
    "250 to 499": "251-999",
    "500 to 999": "251-999",
    "1000 to 4999": "1000+",
    "5000 to 19,999": "1000+",
    "20,000 or more": "1000+",
    "Not Provided": "unknown",
}

if __name__ == "__main__":
    print(f"Reading {SRC}...")
    df = pd.read_csv(SRC, low_memory=False)
    print(f"  Raw rows: {len(df)}")

    df = df.rename(columns={
        "EmployerName": "company_name",
        "EmployerId": "employer_id",
        "SicCodes": "sic_codes",
        "DiffMeanHourlyPercent": "mean_pay_gap",
        "DiffMedianHourlyPercent": "median_pay_gap",
        "EmployerSize": "size_band_raw",
        "CurrentName": "current_name",
    })

    df["size_band"] = df["size_band_raw"].map(SIZE_BAND_MAP).fillna("unknown")
    df["year"] = 2024
    df["country_code"] = "GB"

    # Numeric coercion
    for col in ["mean_pay_gap", "median_pay_gap"]:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    # Drop rows missing core fields
    df = df.dropna(subset=["company_name", "median_pay_gap"])

    output = df[[
        "year", "employer_id", "company_name", "size_band",
        "mean_pay_gap", "median_pay_gap", "country_code",
    ]].copy()

    output.to_parquet(DST, index=False)
    print(f"  Written {len(output)} rows to {DST}")
