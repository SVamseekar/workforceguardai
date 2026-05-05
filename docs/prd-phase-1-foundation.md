# Phase 1 PRD: External Data Foundation

## Phase Goal

Turn WorkforceGuard from a prototype dashboard into a trustworthy external-data workforce intelligence product for Europe.

## Status

Complete.

## Problem Statement

HR and strategy users need a reliable way to understand labour-market pressure, pay-gap signals, and workforce conditions across Europe without reading raw statistical datasets.

Before Phase 1, the project risk was becoming a visually polished dashboard with weak semantics and fragile data behavior.

## Primary Users

- HR directors
- people analytics teams
- workforce planning teams
- compensation and benefits teams
- strategy leaders evaluating European labour markets

## User Value

After Phase 1, a user should be able to:
- open one command-centre style dashboard
- change country, geography, sector, and period
- see grounded labour-market metrics and interpreted signals
- inspect evidence and provenance for important insights
- export an evidence pack
- ask bounded questions against the current market snapshot

## In Scope

- Eurostat-powered external market intelligence
- ESCO reference ingestion
- modeled analytics layer
- curated API contract
- decision-support frontend
- evidence packs
- governance action logging
- honest handling of sparse market coverage

## Out Of Scope

- internal employer data
- pay-transparency simulation
- NUTS 2 live end-user experience
- company-specific turnover reasoning
- workflow automation
- full LLM copilot

## Product Requirements

### Core experience

- users can load a complete overview from one endpoint
- users can filter by country, geography, sector, and time period
- users can inspect evidence behind metrics, signals, and recommendations
- users can export an evidence pack for the current view
- users can log governance actions such as approved, overridden, and reversed

### Trust requirements

- metrics must be backed by named sources
- provenance must include source id, source version, metric id, and formula version
- missing data must not be silently shown as a real zero
- review-required signals must be visible to the user

### Technical requirements

- use DuckDB + Parquet + dbt as the Phase 1 analytics stack
- materialize canonical marts for the app-facing overview
- keep reference data versioned and reproducible
- expose a FastAPI overview contract
- keep frontend and backend loosely coupled through a stable API shape

## Data Requirements

- Eurostat employment rate
- Eurostat unemployment rate
- Eurostat job vacancy rate
- Eurostat gender pay gap
- Eurostat labour market flows
- Eurostat labour market slack
- ESCO occupations
- ESCO skills
- ESCO occupation-skill relations
- ESCO-NACE crosswalk

## Delivery Plan

1. Build the analytics project and metric registry.
2. Ingest the Phase 1 Eurostat and ESCO inputs.
3. Serve a curated overview API from modeled data.
4. Build a command-centre frontend with evidence and governance.
5. Stabilize sparse-coverage behavior and runtime reliability.

## Exit Criteria

- core market datasets are ingested and modeled
- ESCO reference assets are materialized
- `/api/overview` returns a stable, curated payload
- the frontend can load, filter, export, and inspect evidence
- sparse data states do not crash the app
- backend and frontend verification pass

## Delivered Artifacts

- analytics project and marts
- ESCO reference pipeline
- overview and ask endpoints
- decision brief, evidence drawer, governance actions
- regression tests for backend contracts

## Main Risks To Watch Even After Completion

- benchmark semantics can still be misunderstood if labels overstate statistical precision
- chart layout behavior needs ongoing observation in live use
- Phase 1 remains external-data only and must not be presented as employer-specific intelligence
