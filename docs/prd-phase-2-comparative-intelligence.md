# Phase 2 PRD: Comparative Intelligence

## Phase Goal

Make WorkforceGuard genuinely useful for comparative analysis across Europe by adding benchmark-driven reasoning, confidence-aware coverage handling, and live regional intelligence expansion.

## Status

Complete.

Implementation note:
- country-level EU, peer-country, direct market, sector, and prior-period comparison flows are live
- benchmark-aware analyst responses, confidence states, and coverage-aware UI panels are live
- NUTS 2 remains blocked because the current active marts do not yet expose supported NUTS 2 coverage

## Problem Statement

Phase 1 provides a trustworthy market snapshot, but users still need stronger answers to comparison questions:
- compared to what?
- what changed?
- which region or sector is better or worse?
- how much confidence should I place in this comparison?

Without Phase 2, the app remains informative but not yet deeply analytical.

## Primary Users

- people analytics leads
- workforce planning teams
- regional HR leaders
- strategic talent teams comparing labour markets

## User Value

After Phase 2, a user should be able to:
- compare a country against an EU benchmark
- compare one country against peer countries
- compare sectors within the same geography
- compare current period vs prior period
- understand when a comparison is strong vs coverage-limited
- explore the first live regional intelligence layer

## In Scope

- comparative metrics and deltas
- benchmark-aware analyst responses
- coverage and confidence states
- first live NUTS 2 rollout where data supports it
- stronger explanation layer in the UI

## Out Of Scope

- internal HR, payroll, or ATS integrations
- pay-transparency simulation
- employer-specific diagnostic claims
- workflow automation
- unrestricted natural-language copilot

## Product Requirements

### Comparison experience

- users can compare:
  - country vs EU benchmark
  - country vs peer countries
  - sector vs sector
  - current period vs prior period
- comparison states must show whether the benchmark is:
  - official
  - proxy
  - unavailable

### Trust and coverage experience

- every panel should communicate coverage quality
- partial coverage must be visible as partial, not inferred as complete
- comparison confidence should drop when the source grain is sparse

### Analyst console

- the ask flow should support:
  - why changed
  - compared to what
  - what is worsening fastest
  - how one market compares with another
- answers should cite the comparison basis explicitly

### Regional rollout

- NUTS 2 becomes live where the source and marts support it
- NUTS 3 remains optional and clearly marked where supported

## Data Requirements

- live NUTS 2-compatible datasets for the chosen signals
- benchmark logic definitions for EU, peer-country, and prior-period comparisons
- coverage metadata per metric and per geography

## Technical Requirements

- extend marts to include benchmark slices and comparison deltas
- add comparison-aware overview payload fields
- extend API contracts with comparison and confidence metadata
- ensure benchmark semantics are defined in the metric layer, not in UI-only logic

## Delivery Plan

1. Define benchmark semantics and comparison contracts.
2. Extend marts for country, sector, and time comparisons.
3. Add coverage and confidence metadata to overview responses.
4. Upgrade the frontend with comparison controls and confidence cues.
5. Extend the analyst console to answer comparison-led questions.

## Exit Criteria

- users can complete comparison flows without leaving the overview experience
- comparisons are coverage-aware and do not overstate certainty
- NUTS 2 is live in the product where supported
- analyst answers are comparison-capable and evidence-backed
- regression tests cover partial coverage and benchmark edge cases

## Success Signals

- users can answer “How does this compare?” in one interaction
- product language becomes more analytical and less descriptive
- support/debugging time drops because coverage state is explicit
