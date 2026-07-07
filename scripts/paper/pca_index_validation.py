#!/usr/bin/env python3
"""PCA validation of the Hiring Pressure Index (HPI) weighting scheme.

The HPI formula in analytics/models/marts/core/mart_semantic_metrics.sql is:

    hiring_pressure_raw = vacancy_rate * 11
        + max(0, 9 - unemployment_rate) * 4
        + max(0, 12 - labour_slack_rate) * 2.8
        + flow_to_employment * 0.9
        + flow_to_inactivity * 0.6

This script runs PCA on the same six underlying signals (standardized) and
compares the empirical weights above to the PC1 loadings, to check whether
the hand-set weights track the dominant axis of variation in the data.

Country-year rows with any missing value across the six signals are dropped
(PCA requires complete cases); see the printed sample size for how much of
the panel that excludes.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.decomposition import PCA
from sklearn.preprocessing import StandardScaler
from scipy.stats import spearmanr

ROOT = Path(__file__).resolve().parents[2]
EXPORT_DIR = ROOT / "data" / "paper_exports"
TABLES_DIR = EXPORT_DIR / "tables"
FIGURES_DIR = EXPORT_DIR / "figures"

SIGNAL_COLUMNS = [
    "job_vacancy_rate",
    "unemployment_rate",
    "employment_rate",
    "labour_slack_rate",
    "flow_to_employment",
    "flow_to_inactivity",
]

# HPI formula weights from mart_semantic_metrics.sql. unemployment_rate and
# labour_slack_rate enter the formula with a negative sign (via max(0, C - x)),
# so their effective direction is inverted relative to the raw signal.
HPI_EMPIRICAL_WEIGHTS = {
    "job_vacancy_rate": 11.0,
    "unemployment_rate": -4.0,
    "employment_rate": 0.0,
    "labour_slack_rate": -2.8,
    "flow_to_employment": 0.9,
    "flow_to_inactivity": 0.6,
}


def load_panel() -> pd.DataFrame:
    panel_path = EXPORT_DIR / "panel_country_year.csv"
    if not panel_path.exists():
        raise SystemExit(f"{panel_path} not found. Run scripts/paper/export_panel_dataset.py first.")
    df = pd.read_csv(panel_path)
    return df.dropna(subset=SIGNAL_COLUMNS).reset_index(drop=True)


def run_pca(df: pd.DataFrame) -> tuple[PCA, np.ndarray]:
    X = df[SIGNAL_COLUMNS].to_numpy()
    X_scaled = StandardScaler().fit_transform(X)
    pca = PCA(n_components=len(SIGNAL_COLUMNS))
    scores = pca.fit_transform(X_scaled)
    _orient_pc1_toward_vacancy(pca, scores)
    return pca, scores


def _orient_pc1_toward_vacancy(pca: PCA, scores: np.ndarray) -> None:
    """PCA component sign is arbitrary; anchor PC1 so higher PC1 means higher
    vacancy_rate (the intuitive 'tighter market' direction), so the sign of
    every downstream comparison (weights, plots) is stable and interpretable
    across sample changes rather than flipping based on which raw signal
    happens to dominate the fit."""
    vacancy_idx = SIGNAL_COLUMNS.index("job_vacancy_rate")
    if pca.components_[0, vacancy_idx] < 0:
        pca.components_[0] *= -1
        scores[:, 0] *= -1


def build_table_a1(pca: PCA) -> pd.DataFrame:
    variance_pct = pca.explained_variance_ratio_ * 100
    return pd.DataFrame(
        {
            "component": [f"PC{i + 1}" for i in range(len(variance_pct))],
            "eigenvalue": pca.explained_variance_,
            "variance_explained_pct": variance_pct,
            "cumulative_pct": np.cumsum(variance_pct),
        }
    )


def build_table_a2(pca: PCA) -> pd.DataFrame:
    n_components_to_report = min(4, pca.components_.shape[0])
    loadings = pca.components_[:n_components_to_report].T
    return pd.DataFrame(
        loadings,
        index=SIGNAL_COLUMNS,
        columns=[f"PC{i + 1}" for i in range(n_components_to_report)],
    ).reset_index().rename(columns={"index": "signal"})


def normalize_weights(weights: dict[str, float]) -> np.ndarray:
    values = np.array([weights[col] for col in SIGNAL_COLUMNS])
    span = np.max(np.abs(values))
    return values / span if span else values


def compare_weights_to_pc1(pca: PCA) -> tuple[float, float]:
    empirical = normalize_weights(HPI_EMPIRICAL_WEIGHTS)
    pc1_loadings = pca.components_[0]
    rho, p_value = spearmanr(empirical, pc1_loadings)
    return rho, p_value


def plot_scree(pca: PCA, out_path: Path) -> None:
    import matplotlib.pyplot as plt

    variance_pct = pca.explained_variance_ratio_ * 100
    fig, ax = plt.subplots(figsize=(7, 4.5))
    components = np.arange(1, len(variance_pct) + 1)
    ax.plot(components, variance_pct, marker="o")
    ax.set_xlabel("Principal component")
    ax.set_ylabel("Variance explained (%)")
    ax.set_title("Scree plot: HPI input signal PCA")
    ax.set_xticks(components)
    fig.tight_layout()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(out_path, dpi=300)
    plt.close(fig)


def plot_biplot(df: pd.DataFrame, pca: PCA, scores: np.ndarray, out_path: Path) -> None:
    import matplotlib.pyplot as plt

    fig, ax = plt.subplots(figsize=(7, 6))
    ax.scatter(scores[:, 0], scores[:, 1], alpha=0.5, s=20)

    for i, row in df.iterrows():
        ax.annotate(
            row["country_code"],
            (scores[i, 0], scores[i, 1]),
            fontsize=6,
            alpha=0.6,
        )

    loadings = pca.components_[:2].T
    scale = np.abs(scores[:, :2]).max() * 0.8
    for i, signal in enumerate(SIGNAL_COLUMNS):
        ax.arrow(0, 0, loadings[i, 0] * scale, loadings[i, 1] * scale, color="red", alpha=0.7, head_width=0.15)
        ax.annotate(signal, (loadings[i, 0] * scale, loadings[i, 1] * scale), fontsize=7, color="red")

    ax.set_xlabel(f"PC1 ({pca.explained_variance_ratio_[0] * 100:.1f}%)")
    ax.set_ylabel(f"PC2 ({pca.explained_variance_ratio_[1] * 100:.1f}%)")
    ax.set_title("PCA biplot: HPI input signals across country-year observations")
    fig.tight_layout()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(out_path, dpi=300)
    plt.close(fig)


def main() -> None:
    df = load_panel()
    print(f"PCA sample: {len(df)} country-year observations, {df['country_code'].nunique()} countries")

    pca, scores = run_pca(df)

    table_a1 = build_table_a1(pca)
    table_a1_path = TABLES_DIR / "table_a1_pca_results.csv"
    table_a1_path.parent.mkdir(parents=True, exist_ok=True)
    table_a1.to_csv(table_a1_path, index=False)

    table_a2 = build_table_a2(pca)
    table_a2.to_csv(TABLES_DIR / "table_a2_factor_loadings.csv", index=False)

    rho, p_value = compare_weights_to_pc1(pca)

    plot_scree(pca, FIGURES_DIR / "fig_a1_scree_plot.pdf")
    plot_biplot(df, pca, scores, FIGURES_DIR / "fig_a2_pca_biplot.pdf")

    pc1_variance = pca.explained_variance_ratio_[0] * 100
    dominant_signal = SIGNAL_COLUMNS[np.argmax(np.abs(pca.components_[0]))]
    print(f"\nPC1 explains {pc1_variance:.1f}% of variance — dominant loading on {dominant_signal}")
    print(f"Spearman rho (HPI empirical weights vs PC1 loadings) = {rho:.3f} (p = {p_value:.4f})")
    print(f"\nWrote {table_a1_path}")
    print(f"Wrote {TABLES_DIR / 'table_a2_factor_loadings.csv'}")
    print(f"Wrote {FIGURES_DIR / 'fig_a1_scree_plot.pdf'}")
    print(f"Wrote {FIGURES_DIR / 'fig_a2_pca_biplot.pdf'}")


if __name__ == "__main__":
    main()
