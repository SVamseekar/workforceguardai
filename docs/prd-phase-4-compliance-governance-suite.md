# Phase 4 PRD: Compliance And Governance Suite

## Phase Goal

Turn WorkforceGuard into a compliance-ready HR RegTech product by building formal pay-transparency and AI-governance workflows on top of the intelligence foundation.

## Status

Complete for the first production slice.

The live Phase 4 path supports a pay-transparency category-review workflow on top of the modeled internal pay
benchmark mart. The API classifies trusted internal worker-category pay gaps into observed gaps, monitored
low-risk differences, and unresolved review items; tracks per-category human review state; records approve,
override, reverse, review-required, and export events in a durable SQLite-backed, hash-chained governance log;
and includes compliance review metadata in the evidence pack. This remains a human-review workflow, not an
automated HR decision.

## Problem Statement

European HR teams face rising regulatory complexity around:
- pay transparency
- explainability
- reviewability
- human oversight in AI-supported employment decisions

Intelligence alone is not enough. Teams need structured compliance workflows and evidence packs they can review, challenge, and export.

## Primary Users

- compensation leaders
- compliance teams
- legal teams
- HR directors
- works council and employee representative stakeholders

## User Value

After Phase 4, a user should be able to:
- simulate pay-transparency exposure with internal worker-category inputs
- review findings with documented evidence
- log human oversight and override decisions
- export artifacts for legal, compliance, and works council review

## In Scope

- pay-transparency simulator
- category-of-worker analysis support
- formal approval and override workflows
- compliance-oriented exports
- governance console

## Out Of Scope

- autonomous execution of HR actions
- employer-wide policy rollout automation
- broad workflow integrations beyond core evidence export

## Product Requirements

### Pay transparency

- internal upload or connector-driven pay snapshot
- worker category grouping support
- gap identification at category level
- explicit distinction between:
  - observed gap
  - justified difference
  - unresolved review item

### Governance

- users can:
  - approve
  - override
  - reverse
  - export
- override and reversal paths require reason capture where appropriate
- event logs must be exportable and reviewable

### Audit and evidence

- every major compliance recommendation includes:
  - supporting evidence
  - data source references
  - formula version
  - human review state

## Technical Requirements

- durable governance-event storage
- export pack generation for compliance use
- formal role-based access expectations
- policy-safe audit trail design

## Delivery Plan

1. Finalize worker-category and pay-review models. Complete for the first category-level pay review slice.
2. Build compliance simulation marts and rules. Complete for `mart_pay_transparency_category_review` and API-level review rules.
3. Add governance console and approval flows. Complete for local approve, override, reverse, review-required, and export event capture with actor metadata.
4. Add exportable legal/compliance evidence packs. Complete for JSON evidence packs with compliance-review metadata and governance integrity.
5. Add policy and access-control hardening. Deferred to production launch hardening.

## Exit Criteria

- pay-transparency simulations run on modeled worker categories
- governance actions are durably recorded
- export packs support compliance review
- human oversight is explicit in the product flow
- the app can support legal/compliance walkthroughs without manual reconstruction

## Remaining Production Hardening

- Wire actor identity to OIDC claims once the deployment baseline is active; local/dashboard events already carry the actor field.
- Add role-based access controls before expanding beyond the first customer/design-partner environment.
