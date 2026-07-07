#!/usr/bin/env python3
"""Publication-quality figures for the WorkforceGuard AI paper.

Figure 3 (sector GPG bars) is produced separately in sector_heterogeneity.py
for data-locality reasons; this script keeps the same font/palette/DPI
conventions for consistency across all figures.

All figures: 300 DPI, 7-inch width, PDF, colourblind-safe palette.
"""
from __future__ import annotations

from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns
from adjustText import adjust_text
from scipy import stats

ROOT = Path(__file__).resolve().parents[2]
EXPORT_DIR = ROOT / "data" / "paper_exports"
FIGURES_DIR = EXPORT_DIR / "figures"

PRIORITY_COUNTRIES = ["DE", "CZ", "HU", "LV"]

sns.set_palette("colorblind")
plt.rcParams["font.family"] = "DejaVu Serif"


def load_latest_country_year() -> pd.DataFrame:
    panel = pd.read_csv(EXPORT_DIR / "panel_country_year.csv")
    valid = panel.dropna(subset=["employment_rate", "gender_pay_gap"])
    return valid.loc[valid.groupby("country_code")["year"].idxmax()].reset_index(drop=True)


def load_composite_wide() -> pd.DataFrame:
    composite = pd.read_csv(EXPORT_DIR / "composite_indices.csv")
    wide = composite.pivot(index="geo_id", columns="metric_id", values="metric_value").reset_index()
    return wide


def figure_1_scatter(latest: pd.DataFrame, out_path: Path) -> None:
    fig, ax = plt.subplots(figsize=(7, 5.5))
    x = latest["employment_rate"].to_numpy()
    y = latest["gender_pay_gap"].to_numpy()

    sns.regplot(x=x, y=y, ax=ax, scatter_kws={"s": 30, "alpha": 0.7}, line_kws={"color": "#d62728"})

    texts = [
        ax.annotate(row.country_code, (row.employment_rate, row.gender_pay_gap), fontsize=7)
        for row in latest.itertuples()
    ]
    adjust_text(texts, ax=ax, arrowprops=dict(arrowstyle="-", color="grey", lw=0.5))

    r, p = stats.pearsonr(x, y)
    ax.annotate(
        f"r = {r:+.2f}, p = {p:.3f}, N = {len(latest)}",
        xy=(0.03, 0.95),
        xycoords="axes fraction",
        fontsize=9,
        va="top",
    )

    ax.set_xlabel("Employment rate (%, latest available year)")
    ax.set_ylabel("Gender pay gap (%, latest available year)")
    ax.set_title("Labour Market Tightness and Gender Pay Gap across EU Member States")
    fig.tight_layout()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(out_path, dpi=300)
    plt.close(fig)


def figure_2_risk_quadrant(composite_wide: pd.DataFrame, out_path: Path) -> None:
    fig, ax = plt.subplots(figsize=(7, 6.5))

    hpi = composite_wide["hiring_pressure_index"]
    ers = composite_wide["equity_risk_score"]

    def quadrant_color(h: float, e: float) -> str:
        if h > 50 and e > 50:
            return "#d62728"
        if h <= 50 and e > 50:
            return "#ff7f0e"
        if h > 50 and e <= 50:
            return "#1f77b4"
        return "#7f7f7f"

    colors = [quadrant_color(h, e) for h, e in zip(hpi, ers)]
    ax.scatter(hpi, ers, c=colors, s=40, edgecolor="black", linewidth=0.3)

    texts = [
        ax.annotate(row.geo_id, (row.hiring_pressure_index, row.equity_risk_score), fontsize=7)
        for row in composite_wide.itertuples()
    ]
    adjust_text(texts, ax=ax, arrowprops=dict(arrowstyle="-", color="grey", lw=0.5))

    ax.axvline(50, color="black", linestyle="--", linewidth=0.8)
    ax.axhline(50, color="black", linestyle="--", linewidth=0.8)

    ax.text(75, 90, "Priority Intervention", fontsize=8, fontstyle="italic", ha="center")
    ax.text(25, 90, "Equity Risk", fontsize=8, fontstyle="italic", ha="center")
    ax.text(75, 5, "Tight but Equitable", fontsize=8, fontstyle="italic", ha="center")
    ax.text(25, 5, "Stable Markets", fontsize=8, fontstyle="italic", ha="center")

    ax.set_xlim(-2, 102)
    ax.set_ylim(-2, 102)
    ax.set_xlabel("Hiring Pressure Index (HPI, 0-100)")
    ax.set_ylabel("Equity Risk Score (ERS, 0-100)")
    ax.set_title("Combined Risk Quadrant: HPI x ERS across EU Countries")
    fig.text(
        0.5, -0.02,
        "HPI = Hiring Pressure Index; ERS = Equity Risk Score. Both computed from Eurostat panel\n"
        "data via dbt pipeline. Thresholds at 50 are analytical, not regulatory.",
        ha="center", fontsize=7,
    )
    fig.tight_layout()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(out_path, dpi=300, bbox_inches="tight")
    plt.close(fig)


def figure_4_priority_cases(latest: pd.DataFrame, composite_wide: pd.DataFrame, out_path: Path) -> None:
    merged = latest.merge(composite_wide, left_on="country_code", right_on="geo_id", how="inner")

    fig, ax = plt.subplots(figsize=(7, 5.5))
    is_priority = merged["country_code"].isin(PRIORITY_COUNTRIES)

    ax.scatter(
        merged.loc[~is_priority, "hiring_pressure_index"],
        merged.loc[~is_priority, "gender_pay_gap"],
        c="#7f7f7f", s=30, alpha=0.6, label="Other EU countries",
    )
    ax.scatter(
        merged.loc[is_priority, "hiring_pressure_index"],
        merged.loc[is_priority, "gender_pay_gap"],
        c="#d62728", s=50, label="Priority intervention cases",
    )

    texts = [
        ax.annotate(row.country_code, (row.hiring_pressure_index, row.gender_pay_gap), fontsize=8, fontweight="bold")
        for row in merged[is_priority].itertuples()
    ]
    adjust_text(texts, ax=ax, arrowprops=dict(arrowstyle="-", color="grey", lw=0.5))

    eu27_avg_gpg = merged["gender_pay_gap"].mean()
    ax.axhline(eu27_avg_gpg, color="black", linestyle="--", linewidth=0.8, label=f"Sample average ({eu27_avg_gpg:.1f}%)")

    ax.set_xlabel("Hiring Pressure Index (HPI, 0-100)")
    ax.set_ylabel("Gender pay gap (%, latest available year)")
    ax.set_title("Hiring Pressure vs Gender Pay Gap - Priority Intervention Cases")
    ax.legend(fontsize=8)
    fig.tight_layout()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(out_path, dpi=300)
    plt.close(fig)


def main() -> None:
    latest = load_latest_country_year()
    composite_wide = load_composite_wide()

    figure_1_scatter(latest, FIGURES_DIR / "fig1_tightness_gpg_scatter.pdf")
    print(f"Wrote {FIGURES_DIR / 'fig1_tightness_gpg_scatter.pdf'}")

    figure_2_risk_quadrant(composite_wide, FIGURES_DIR / "fig2_combined_risk_quadrant.pdf")
    print(f"Wrote {FIGURES_DIR / 'fig2_combined_risk_quadrant.pdf'}")

    missing_priority = [c for c in PRIORITY_COUNTRIES if c not in latest["country_code"].values]
    if missing_priority:
        print(f"Note: priority countries missing latest-year data, excluded from Figure 4: {missing_priority}")

    figure_4_priority_cases(latest, composite_wide, FIGURES_DIR / "fig4_priority_cases.pdf")
    print(f"Wrote {FIGURES_DIR / 'fig4_priority_cases.pdf'}")


if __name__ == "__main__":
    main()
