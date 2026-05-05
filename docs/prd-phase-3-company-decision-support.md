# Phase 3 PRD: Company-Aware Decision Support

## Phase Goal

Connect internal employer data so WorkforceGuard becomes a true company-aware workforce decision-support product rather than only an external market-intelligence tool.

## Status

Implemented for the first production slice.

The live Phase 3 path supports real local CSV ingestion for payroll, job architecture, HRIS workforce snapshots,
ATS requisition snapshots, and learning / skill snapshots. Company-specific claims remain disabled unless the
modeled internal marts contain real rows and the internal data manifest marks the payroll and job-architecture
assets as trusted real employer exports.

## Problem Statement

External labour-market data can explain what is happening in the market, but not what is happening inside an employer.

To support real workforce decisions, the product must connect market signals with:
- payroll
- HRIS
- ATS
- job architecture
- skills and training data

## Primary Users

- HR directors
- compensation and benefits teams
- people analytics teams
- talent acquisition leads
- workforce planning leaders

## User Value

After Phase 3, a user should be able to:
- benchmark internal pay and workforce conditions against the market
- identify where the employer differs materially from external conditions
- understand which roles or worker groups deserve closer review
- combine internal and market evidence in one decision flow

## In Scope

- internal data connectors
- internal vs market benchmarking
- worker category modeling
- internal role and skill normalization
- company-aware analyst answers

## Out Of Scope

- formal compliance simulator workflows
- automated HR decisions
- external workflow orchestration
- broad generative AI autonomy

## Product Requirements

### Data connectors

- support structured ingestion for:
  - payroll
  - HRIS
  - ATS
  - job architecture
  - learning / skills systems

### Internal vs market benchmarking

- users can compare:
  - internal compensation vs market pay signals
  - internal hiring demand vs market scarcity
  - internal workforce composition vs market structure

### Worker category modeling

- model employer-defined categories of workers / work of equal value
- support category definitions independent of job title alone

### Analyst experience

- answers may combine internal and external evidence
- the UI must clearly show whether a conclusion is based on:
  - external only
  - internal only
  - blended evidence

## Data Requirements

- employer-specific data contracts
- stable identity mapping between internal roles and ESCO / NACE / internal job architecture
- privacy and access controls for employer data

## Technical Requirements

- separate external and internal data domains
- build blended marts for benchmarking
- maintain source-level provenance through both domains
- add role/category mapping services

## Delivery Plan

1. Define employer connector contracts. Complete for the local-file Phase 3 slice.
2. Build internal reference and worker-category models. Complete.
3. Extend marts for internal vs market benchmarking. Complete for pay, workforce, hiring-demand, and skill-snapshot inputs.
4. Upgrade the frontend to show blended evidence states. Complete for the command-centre overview and analyst responses.
5. Expand analyst responses to internal-plus-market reasoning. Complete for company-aware pay benchmarking with strict no-data guardrails.

## Exit Criteria

- at least one internal data path can be ingested end to end
- internal vs market comparisons are visible in the app
- worker categories are modeled explicitly
- the product can explain whether an answer is external, internal, or blended
- no company-specific claim is produced without the supporting data path
- local sample rows are never enough to activate company-specific claims; real exports must be prepared with
  `--trust-company-data`
