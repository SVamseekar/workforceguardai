#!/usr/bin/env python3
"""Regenerate landingFacts countrySamples and research constants from paper_exports."""

from __future__ import annotations

import math
import re
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
EXPORTS = ROOT / "data" / "paper_exports"
LANDING_FACTS = ROOT / "dashboard" / "frontend" / "src" / "components" / "landing" / "landingFacts.ts"

FIN_SECTOR = "Financial and insurance activities"
COUNTRY_SAMPLES = ["CZ", "HU", "FR", "EE", "DE", "IT", "NL", "SE", "IE", "ES"]
COUNTRY_NAMES = {
    "CZ": "Czechia",
    "HU": "Hungary",
    "FR": "France",
    "EE": "Estonia",
    "DE": "Germany",
    "IT": "Italy",
    "NL": "Netherlands",
    "SE": "Sweden",
    "IE": "Ireland",
    "ES": "Spain",
}


def _pearsonr(x: pd.Series, y: pd.Series) -> float:
    if len(x) < 2:
        return float("nan")
    xv = x.astype(float)
    yv = y.astype(float)
    num = ((xv - xv.mean()) * (yv - yv.mean())).sum()
    den = math.sqrt(((xv - xv.mean()) ** 2).sum() * ((yv - yv.mean()) ** 2).sum())
    return float(num / den) if den else float("nan")


def build_country_samples() -> list[dict]:
    panel = pd.read_csv(EXPORTS / "panel_country_sector_year.csv")
    emp = pd.read_csv(EXPORTS / "panel_country_year.csv")
    comp = pd.read_csv(EXPORTS / "composite_indices.csv")
    comp_all = comp[comp["sector_id"] == "ALL"].pivot(
        index="geo_id", columns="metric_id", values="metric_value"
    )

    rows: list[dict] = []
    for code in COUNTRY_SAMPLES:
        fin = (
            panel[(panel["country_code"] == code) & (panel["sector_name"] == FIN_SECTOR)]
            .dropna(subset=["gender_pay_gap"])
            .sort_values("year")
            .iloc[-1]
        )
        employment = emp[emp["country_code"] == code].sort_values("year").iloc[-1]
        rows.append(
            {
                "code": code,
                "name": COUNTRY_NAMES[code],
                "employmentRatePct": round(float(employment["employment_rate"]), 1),
                "financeGpgPct": round(float(fin["gender_pay_gap"]), 1),
                "hpi": int(round(float(comp_all.loc[code, "hiring_pressure_index"]))),
                "ers": int(round(float(comp_all.loc[code, "equity_risk_score"]))),
                "period": str(int(fin["year"])),
            }
        )
    return rows


def build_research_constants() -> dict:
    emp = pd.read_csv(EXPORTS / "panel_country_year.csv")
    panel = pd.read_csv(EXPORTS / "panel_country_sector_year.csv")

    latest_year = int(emp["year"].max())
    while latest_year >= int(emp["year"].min()):
        sub = emp[emp["year"] == latest_year].dropna(subset=["employment_rate", "gender_pay_gap"])
        if len(sub) >= 2:
            break
        latest_year -= 1

    correlation = _pearsonr(sub["employment_rate"], sub["gender_pay_gap"])
    eu_gpg = round(float(emp["gender_pay_gap"].mean()), 1)
    finance_gpg = round(
        float(panel[panel["sector_name"] == FIN_SECTOR]["gender_pay_gap"].mean()), 1
    )

    return {
        "eu27UnadjustedGapPct": eu_gpg,
        "eu27FinanceSectorGapPct": finance_gpg,
        "employmentGapCorrelation": round(correlation, 2),
        "panelCountries": int(emp["country_code"].nunique()),
        "panelSectors": 11,
    }


def _format_country_samples(rows: list[dict]) -> str:
    lines = []
    for row in rows:
        lines.append(
            "    { "
            f"code: '{row['code']}', name: '{row['name']}', "
            f"employmentRatePct: {row['employmentRatePct']}, financeGpgPct: {row['financeGpgPct']}, "
            f"hpi: {row['hpi']}, ers: {row['ers']}, period: '{row['period']}' "
            "},"
        )
    return "\n".join(lines)


def _format_research(research: dict) -> str:
    return f"""  research: {{
    eu27UnadjustedGapPct: {research['eu27UnadjustedGapPct']},
    eu27FinanceSectorGapPct: {research['eu27FinanceSectorGapPct']},
    employmentGapCorrelation: {research['employmentGapCorrelation']},
    panelCountries: {research['panelCountries']},
    panelSectors: {research['panelSectors']},
  }},"""


def update_landing_facts() -> None:
    text = LANDING_FACTS.read_text()
    research = build_research_constants()
    samples = build_country_samples()

    text = re.sub(
        r"  research: \{[^}]+\},",
        _format_research(research),
        text,
        count=1,
        flags=re.DOTALL,
    )

    text = re.sub(
        r"  // Synced from data/paper_exports/.*?\n  countrySamples: \[[^\]]+\] as const,",
        (
            "  // Synced from data/paper_exports/ via scripts/sync_landing_facts.py\n"
            f"  countrySamples: [\n{_format_country_samples(samples)}\n  ] as const,"
        ),
        text,
        count=1,
        flags=re.DOTALL,
    )

    LANDING_FACTS.write_text(text)
    print(f"Updated {LANDING_FACTS}")
    print("research:", research)
    print("countrySamples:", len(samples), "rows")


def check_landing_facts() -> int:
    original = LANDING_FACTS.read_text()
    update_landing_facts()
    updated = LANDING_FACTS.read_text()
    LANDING_FACTS.write_text(original)
    if original == updated:
        print("landingFacts.ts is in sync with data/paper_exports/")
        return 0
    print(
        "landingFacts.ts is out of sync with data/paper_exports/.\n"
        "Run: python scripts/sync_landing_facts.py"
    )
    return 1


if __name__ == "__main__":
    import sys

    if "--check" in sys.argv:
        raise SystemExit(check_landing_facts())
    update_landing_facts()
