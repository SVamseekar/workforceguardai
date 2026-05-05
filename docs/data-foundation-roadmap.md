# Data Foundation Roadmap

This document explains the first implementation step for WorkforceGuard in plain language.

## What we just added

We added an `analytics/` project to give WorkforceGuard a real data foundation.

That means the project now has a place to store:
- trusted business definitions
- reusable data models
- versioned metric definitions
- governance-friendly metadata

## Why this matters

Without this layer, the app would keep growing through ad-hoc backend queries.

That is risky because:
- numbers become hard to trust
- formulas get duplicated in application code
- compliance evidence becomes difficult to prove
- AI features become harder to ground safely

## What this foundation currently covers

Current modeled datasets:
- employment rate
- unemployment rate
- job vacancy rate
- labour market flows
- labour market slack
- gender pay gap by sector

Current marts:
- geography dimension
- sector dimension
- unified labour-market signal fact table
- command-centre-ready mart
- metric registry

## What is still intentionally missing

These are the next data foundation priorities:
- ESCO taxonomy
- ESCO-NACE crosswalk
- company worker category model
- internal pay and workforce facts

## Recommended next implementation order

1. Add ESCO and crosswalk seeds or loaders.
2. Expand the semantic registry with approved formulas.
3. Repoint backend API queries to the modeled marts.
4. Then add deeper product UX and grounded AI.
5. After that, add employer-side data connectors for compliance workflows.
