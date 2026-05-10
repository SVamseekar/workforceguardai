# Phase 5 PRD: AI Copilot And Workflow Automation

## Phase Goal

Add a grounded AI copilot and selected workflow automation on top of a trustworthy metric, benchmark, and compliance foundation.

## Status

Complete.

Delivered capabilities:
- retrieval-bounded copilot contract exposed in the API and dashboard
- evidence-backed executive brief payloads
- recurring brief templates and persistent schedule configuration for weekly executive updates and monthly compliance packs
- scheduled-run generation for executive briefs and compliance evidence packs
- threshold alerts over approved semantic and compliance signals
- human-approved workflow handoffs with governance targets

## Problem Statement

By Phase 4, WorkforceGuard can inform and document decisions well. The next opportunity is to reduce user effort by:
- summarizing complex evidence quickly
- answering deeper questions across multiple signals
- preparing recurring briefs
- automating low-risk follow-up workflows

This should only happen once trust, semantics, and governance are already strong.

## Primary Users

- HR directors
- people analytics leads
- workforce planning teams
- compliance and legal reviewers
- executives who need concise briefings

## User Value

After Phase 5, a user should be able to:
- ask richer natural-language questions
- receive evidence-grounded summaries and briefs
- generate recurring executive updates
- trigger selected workflow steps after human review

## In Scope

- grounded AI copilot
- richer question-answering
- briefing generation
- alerts and scheduled summaries
- selected human-approved workflow automation

## Out Of Scope

- unrestricted autonomous decision making
- black-box recommendations without evidence
- AI-generated employment decisions without human review

## Product Requirements

### AI copilot

- the copilot must query approved semantic metrics and evidence only
- every important answer must include:
  - evidence
  - provenance
  - confidence
  - review context

### Reporting and summaries

- generate executive summaries
- generate recurring regional or sector briefs
- summarize what changed and why it matters

### Workflow automation

- support alerts when thresholds are crossed
- support scheduled evidence packs and brief generation
- keep approval checkpoints for sensitive actions

## Technical Requirements

- LLM integration must be grounded by the semantic layer
- prompts must not define business formulas
- automation must respect governance events and review requirements
- logging and traceability must remain first-class

## Delivery Plan

1. Define grounded copilot contract and retrieval boundaries.
2. Build summary/report templates on top of evidence bundles.
3. Add scheduled brief generation.
4. Add low-risk alerting and workflow handoffs.
5. Expand with carefully approved workflow automations.

## Exit Criteria

- copilot answers are evidence-backed and non-hallucinatory in core flows
- users can generate and schedule trustworthy summaries
- automation only occurs within approved governance boundaries
- auditability remains intact despite AI assistance

## Implementation Notes

Phase 5 is implemented without unrestricted autonomous decisioning. The current implementation uses deterministic grounded retrieval and narrative composition over approved metrics, semantic metrics, comparison metadata, internal-data trust gates, pay-transparency simulation results, and governance events. Recurring schedules persist locally, require approval for compliance outputs, and generate the same governed brief/evidence-pack contracts used by the dashboard. Future LLM integration must keep the same contract: prompts may summarize and route evidence, but formulas and decision rules remain in the semantic/service layer.
