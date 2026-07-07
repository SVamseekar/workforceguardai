# WorkforceGuard AI: System Description (Section 5.5)

*Facts below were verified directly against the codebase (`dashboard/backend/service.py`,
`analytics/`) rather than copied from `WORKFORCEGUARD_AI_REFERENCE.md`, since several details
in that document (governance storage format, model count, service.py line count) were out of
date at the time of writing.*

## Overview

WorkforceGuard AI is a single-tenant workforce intelligence and pay-transparency compliance
platform for HR, compensation, and compliance teams operating under the EU Pay Transparency
Directive (2023/970/EU). It ingests public Eurostat labour-market statistics and, where
configured, an employer's internal payroll and job-architecture data, and computes comparative
benchmarks, composite risk indices, and audit-ready compliance evidence from a single
reproducible data pipeline. The same warehouse and metric definitions that back this paper's
empirical results are the ones the live product serves to its users — there is no separate
"research" copy of the data.

## Data Pipeline Architecture

```
Eurostat JSON-stat API
  -> scripts/pull_eu_data.py         (fetch, dimension discovery, provenance manifest)
  -> data/eu_raw/*.parquet            (versioned, LFS-tracked extracts)
  -> analytics/ (dbt, 31 models)      (staging -> intermediate -> marts)
  -> data/workforceguard_analytics.duckdb
  -> dashboard/backend/service.py     (AnalyticsRepository, ~5,700 lines, FastAPI)
  -> dashboard/frontend/              (React / Vite dashboard)
```

`scripts/pull_eu_data.py` records a per-dataset `pulled_at` timestamp and Eurostat dataset code
in `data/eu_meta/manifest.json`, and every `stg_eurostat__*` staging model carries that same
`dataset_code` and `pulled_at` through to the warehouse (added as part of this paper's
provenance work; see `analytics/macros/provenance.sql`). `mart_semantic_metrics` additionally
carries a `formula_version` per composite metric, joined from `ref_metric_registry.csv` — the
same registry the dashboard backend reads to label every score it displays.

## The Four Composite Metrics

All four are computed in `analytics/models/marts/core/mart_semantic_metrics.sql` and clamped to
`[0, 100]`:

**Hiring Pressure Index (HPI)**, formula version 1.2:

```
hiring_pressure_raw = vacancy_rate * 11
    + max(0, 9 - unemployment_rate) * 4
    + max(0, 12 - labour_slack_rate) * 2.8
    + flow_to_employment * 0.9
    + flow_to_inactivity * 0.6
```

**Labour Resilience (LR)**, formula version 1.1:

```
labour_resilience_raw = employment_rate * 0.95
    - unemployment_rate * 3.8
    + employment_continuity * 0.3
```

**Equity Risk Score (ERS)**, formula version 1.0:

```
equity_risk_raw = pay_gap * 5.5
```

**Transition Readiness (TR)**, formula version 0.2:

```
transition_readiness = labour_resilience * 0.45
    + max(0, 100 - hiring_pressure_index) * 0.25
    + min(100, (digital_skill_coverage + green_skill_coverage) * 4) * 0.30
```

`digital_skill_coverage` and `green_skill_coverage` come from an ESCO occupation-skill
crosswalk, not from a labour-demand survey; `ref_metric_registry.csv` marks TR as
`proxy_live` for this reason, and this paper's Task 3 (PCA validation) treats HPI, not TR, as
the primary object of formal weight validation.

## Governance and Auditability

Governance actions (`review_required`, `approved`, `overridden`, `reversed`, `exported`) are
persisted as a genuine hash chain, not a plain append log: each event stores an `event_hash`
computed as `SHA-256` over its own canonicalized JSON payload, plus the `previous_hash` of the
prior event in sequence, anchored at a `GENESIS` value for the first event
(`dashboard/backend/service.py`, `_governance_event_hash` / `_governance_integrity`). Any
tampering with a past event breaks the hash chain at that point, which `_governance_integrity()`
detects and reports via `verified: false` and a `break_event_id`. This store is backed by
SQLite (`data/governance_events.sqlite`) in the current implementation, with a legacy JSON-file
loader retained for backward compatibility.

Every metric value returned by the API carries a `formula_version` and `human_review_required`
flag sourced from `ref_metric_registry.csv`, and every recommendation or insight the dashboard
surfaces carries an `evidence_bundle` linking back to its underlying provenance (source dataset,
formula version, review requirement).

## Clarification on "AI" Terminology

The product's "AI Analyst" and "AI-written" briefs are deterministic: headline text is selected
from a fixed set of threshold-based templates, and narrative summaries are built by concatenating
templated sentence fragments driven by the same warehouse values shown elsewhere in the
dashboard (`dashboard/backend/service.py`, `_build_intelligence`, `_build_executive_brief`).
There is no large language model inference in this path — no OpenAI, Anthropic, or other LLM API
call occurs anywhere in `dashboard/backend/`. This is a deliberate design choice for a compliance
product: every generated sentence is reproducible from the same warehouse state and traceable to
its source data, which a stochastic LLM-generated narrative would not guarantee.

## Replication Statement

All data, transformation logic (dbt models in `analytics/`), and application code are publicly
available at `github.com/SVamseekar/workforceguardai`. The exact Eurostat vintages used in this
study are recorded in `data/eu_meta/manifest.json` (dataset code and pull timestamp per
dataset) and archived at Zenodo (DOI: 10.5281/zenodo.20455974; to be updated with a
replication-package-specific record per Part 3, Task 2 of the publication plan). A reader with
the repository can reproduce all tables and figures in this paper by running, in order:

```
python scripts/pull_eu_data.py
cd analytics && dbt seed && dbt run
python scripts/paper/export_panel_dataset.py
python scripts/paper/pca_index_validation.py
python scripts/paper/panel_fe_regression.py
python scripts/paper/sector_heterogeneity.py
python scripts/paper/robustness_checks.py
python scripts/paper/generate_figures.py
python scripts/paper/descriptive_stats.py
```
