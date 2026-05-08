# scripts/ingest_egapro.py
"""
Cleans and converts the Égapro XLSX to parquet.
Run from project root: python scripts/ingest_egapro.py
Input: data/public_company_raw/france/france_index_raw.xlsx
Output: data/public_company/egapro_index.parquet
"""
import re
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "data" / "public_company_raw" / "france" / "france_index_raw.xlsx"
DST = ROOT / "data" / "public_company" / "egapro_index.parquet"
DST.parent.mkdir(parents=True, exist_ok=True)

# Map French size band labels to standard bands
SIZE_BAND_MAP = {
    "50 à 250": "50-250",
    "251 à 999": "251-999",
    "1000 et plus": "1000+",
}

# Extract 5-char NAF code from "62.02A - Description" format
NAF_PATTERN = re.compile(r"^(\d{2}\.\d{2}[A-Z])")


def extract_naf_code(raw: str) -> str | None:
    if not isinstance(raw, str):
        return None
    m = NAF_PATTERN.match(raw.strip())
    return m.group(1) if m else None


def extract_naf_section(naf_code: str | None) -> str | None:
    """Map NAF code prefix to NACE section letter."""
    if not naf_code:
        return None
    prefix = int(naf_code[:2])
    if prefix <= 3:
        return "A"
    if prefix <= 9:
        return "B"
    if prefix <= 33:
        return "C"
    if prefix == 35:
        return "D"
    if prefix <= 39:
        return "E"
    if prefix <= 43:
        return "F"
    if prefix <= 47:
        return "G"
    if prefix <= 53:
        return "H"
    if prefix <= 56:
        return "I"
    if prefix <= 63:
        return "J"
    if prefix <= 66:
        return "K"
    if prefix == 68:
        return "L"
    if prefix <= 75:
        return "M"
    if prefix <= 82:
        return "N"
    if prefix == 84:
        return "O"
    if prefix == 85:
        return "P"
    if prefix <= 88:
        return "Q"
    if prefix <= 93:
        return "R"
    if prefix <= 96:
        return "S"
    return None


def is_numeric_score(val) -> bool:
    try:
        int(str(val).strip())
        return True
    except (ValueError, TypeError):
        return False


if __name__ == "__main__":
    print(f"Reading {SRC}...")
    df = pd.read_excel(SRC)
    print(f"  Raw rows: {len(df)}")

    # Rename columns
    df = df.rename(columns={
        "Année": "year",
        "SIREN": "siren",
        "Raison Sociale": "company_name",
        "Tranche d'effectifs": "size_band_raw",
        "Code NAF": "naf_raw",
        "Note Index": "index_score_raw",
        "Note Ecart rémunération": "score_pay_gap",
        "Note Hautes rémunérations": "score_top_earners",
        "Note Retour congé maternité": "score_maternity",
        "Région": "region",
        "Département": "department",
        "Pays": "country",
    })

    # Keep only rows with valid numeric index scores
    df = df[df["index_score_raw"].apply(is_numeric_score)].copy()
    df["index_score"] = df["index_score_raw"].astype(int)
    print(f"  Rows with valid index scores: {len(df)}")

    # Clean fields
    df["naf_code"] = df["naf_raw"].apply(extract_naf_code)
    df["nace_section"] = df["naf_code"].apply(extract_naf_section)
    df["size_band"] = df["size_band_raw"].map(SIZE_BAND_MAP).fillna("unknown")
    df["siren"] = df["siren"].astype(str).str.strip()
    df["company_name"] = df["company_name"].astype(str).str.strip()
    df["year"] = df["year"].astype(int)

    # Numeric component scores — coerce NC to null
    for col in ["score_pay_gap", "score_top_earners", "score_maternity"]:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    # Final column selection
    output = df[[
        "year", "siren", "company_name", "size_band", "naf_code",
        "nace_section", "index_score", "score_pay_gap",
        "score_top_earners", "score_maternity", "region",
    ]].copy()

    output.to_parquet(DST, index=False)
    print(f"  Written {len(output)} rows to {DST}")
    print(f"  Years: {sorted(output['year'].unique())}")
    print(f"  Unique companies: {output['siren'].nunique()}")
    print(f"  NACE sections: {sorted(output['nace_section'].dropna().unique())}")
