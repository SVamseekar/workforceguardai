# WorkforceGuard AI — Production Launch & Readiness Document

**Version:** 1.0
**Status:** Draft for sign-off
**Owner:** CTO
**Launch target:** v1.0 GA, six weeks from kickoff
**Last reviewed:** 2026-04-27
**Related:** `docs/01-technical-design.md`, `docs/technical-assessment.md`

---

## 1. Purpose

This document is the production-readiness contract for WorkforceGuard AI
v1.0. It captures what ships, what does not, how we ship it, what could
go wrong, who is on the hook, and how we know we succeeded.

A reviewer reading this document should be able to answer four questions:

1. What exactly are we putting in front of a paying customer?
2. What happens if something breaks at 03:00 on a Tuesday?
3. How do we know in 30 days whether this launch worked?
4. Who signs off, and on what?

If any of those four answers is unclear, the launch is not ready.

---

## 2. The decisions, formalised

The thirteen go/no-go decisions below were taken on 2026-04-27 by the CTO
and recorded here as the binding scope for v1.0. Any change requires an
explicit amendment to this document, signed by the owner.

| # | Decision | Outcome |
|---|---|---|
| D1 | Primary buyer | CPO / VP People at a 500–5,000 person EU employer with a Pay Transparency Directive filing obligation in 2027 (for 2026 data). |
| D2 | Launch scope | Phase 1 (EU market intelligence) + Phase 2 (comparative benchmarking) + Phase 3 partial (internal data visible behind the trust gate). |
| D3 | Real data sources | Eurostat (16 datasets) + ESCO + EU-SILC + EURES + EIGE, plus one design partner's payroll and job architecture under NDA. |
| D4 | Trust guardrail | On by default. Company-specific claims render only after `data_trust_level = customer_reconciled`. |
| D5 | Technical baseline | Medium. Backend split, SQLite-backed governance, CSV validation with reporting, freshness signals, env-driven CORS allowlist. |
| D6 | Frontend capability | Comparative dashboard, evidence drawer, evidence-pack export. Data upload is a managed onboarding step, not self-serve. |
| D7 | Phase 4 (compliance workflows) | Deferred. The spec comes from observing the design partner's first real filing, not from imagination. |
| D8 | Governance infrastructure | SQLite, hash-chained, single-tenant. RBAC and tamper-proof storage are out of v1.0. |
| D9 | Customer capacity | One paying customer at GA. Hard cap at two before customer #3 forces the multi-tenant migration. |
| D10 | Go-to-market | One named design partner under a paid pilot agreement. Reference logo on close. |
| D11 | Trade-off A | Ship Phase 3 visible-but-gated rather than hide it. Pull from the customer to share real data; transparency about capability. |
| D12 | Trade-off B | Harden the backend over polishing the UI. Compliance buyers grade on defensibility, not aesthetics. |
| D13 | Trade-off C | Launch in six weeks with v1.0 scope; build Phase 4 against the design partner's 2026 filing-rehearsal cycle, ahead of the binding 2027 report. |

These decisions are mutually consistent. Together they define a product
that can be sold this quarter and defended in front of employment counsel.

---

## 3. Scope: in and out

### 3.1 In scope (v1.0 GA)

**Functional**

- 16 Eurostat datasets pulled daily, written into staging models with
  full provenance.
- ESCO occupation hierarchy and skills loaded as reference data.
- EU-SILC indicators (`TESSI162`, `TESSI164`, `TESSI166`, `ilc_di03`,
  `ilc_di12`, `ilc_peps01n`).
- EURES vacancy statistics (new in v1.0).
- EIGE Gender Equality Index (new in v1.0).
- One design partner's payroll snapshot and job architecture, ingested
  via SFTP, validated, reconciled, gated by trust level.
- Comparative dashboard with metric tiles, trend charts, and
  country/sector comparisons.
- Templated narrative answers via `/api/ask`.
- Evidence pack: JSON + PDF, signed with ed25519, regenerable
  byte-identically from the same warehouse vintage.
- Governance log: SQLite, hash-chained, append-only, with actor identity
  from OIDC.
- Freshness pill on every page, sourced from `/api/freshness`.
- Reconciliation tests for three Eurostat headline figures running on
  every dbt build.

**Operational**

- Single-tenant deployment on a Linux VM in an EU region.
- Caddy reverse proxy, TLS, HSTS.
- OIDC authentication against the customer's IdP.
- `structlog` JSON logs with request IDs, 30-day retention.
- Daily borgbackup of warehouse + governance log to a sibling EU bucket;
  30-day retention; one quarterly restore drill.
- GitHub Actions CI: lint, dbt build, dbt test, backend pytest, frontend
  tsc + build + axe, dependency audit.
- One uptime monitor (`/health`); pages on 5xx for 5 minutes or warehouse
  staleness past SLA.
- Written runbook for cold-start onboarding, freshness alerts, evidence-pack
  regeneration, hash-chain breaks, and restore-from-backup.

### 3.2 Out of scope (v1.0)

- Multi-tenant isolation, schema-per-tenant, row-level security.
- LLM features. The LLM is designed in `01-technical-design.md` §6.4 and
  built in v1.1.
- Phase 4 (approval workflows, override-reason capture, formal compliance
  routing).
- Phase 5 (AI copilot, conversational analyst).
- Self-serve signup, freemium tier, public marketing site beyond a single
  landing page.
- Mobile app, responsive design under 1024px.
- HRIS partner integrations (Workday, SuccessFactors, BambooHR, Personio).
  These ship in v1.2 against real customer demand.
- Data sources outside the EU/EFTA scope.
- Consulting-report figures as warehouse rows. Cited in narrative only.
- Real-time anything. Daily refresh is the contract.

### 3.3 Out of scope reasoning, in one sentence each

| Excluded | Why |
|---|---|
| Multi-tenant | One customer cannot pay for the engineering required to isolate against ten. |
| LLM in v1.0 | The verification layer that prevents a wrong number reaching a regulator is non-trivial; build it once we have a real narrative corpus. |
| Phase 4 | A workflow built without watching a real filing happen will be the wrong workflow. |
| Phase 5 | The buyer is not asking for a copilot; they are asking for a defensible report. |
| HRIS integrations | The design partner ships a CSV in 30 minutes; building a Workday adapter takes a quarter. |
| Mobile | Compliance work is desktop work. Every hour spent on responsive layout is an hour not spent on provenance. |

---

## 4. Rollout plan

### 4.1 Calendar

The launch window is six weeks. Day 0 is the kickoff Monday after
Q&A sign-off on this document.

| Week | Theme | Engineering output | Customer-facing output |
|---|---|---|---|
| 1 | Data integrity foundation | Provenance columns through every model, `dim_date`, `data_trust_level`, three reconciliation tests | None |
| 2 | Backend split | `service.py` dissolved into `api/`, `domain/`, `repository/`, `policy/`; SQLite governance log with hash chain | None |
| 3 | Evidence pack | Provenance per claim, sha256 + ed25519 signing, WeasyPrint PDF, regeneration determinism test | None |
| 4 | Frontend refactor I | TypeScript migration, page split, TanStack Query, contract-derived types | Internal demo to design partner |
| 5 | Frontend refactor II + ingestion gaps | EURES + EIGE ingestions, Compare/Evidence/Governance pages, axe pass | Design partner CSV ingest, reconciliation, first evidence pack draft |
| 6 | Production posture | TLS, OIDC, EU deploy, backups, restore drill, runbooks, CI | GA: design partner is on the live deployment with their own data |

Each week ends with a Friday demo to the design partner. Slipping a week
is acceptable; skipping a Friday demo is not.

### 4.2 Acceptance gates per week

A week is "done" only when its gate passes on `main`.

**Week 1 gate.** `dbt build && dbt test` is green on a fresh pull from
all named sources. The reconciliation test fails the build if any of the
three headline Eurostat figures (EU-27 unemployment, gender pay gap
total, employment rate 20–64) differs from the publisher's published
value beyond the documented tolerance. Provenance test fails if any row
in `mart_semantic_metrics` is missing a provenance field.

**Week 2 gate.** No backend module exceeds 500 lines. `pytest` is green.
The end-to-end smoke test loads the fixture warehouse, calls overview →
ask → evidence → governance, and asserts hash-chain integrity. The
governance log refuses a write if the previous hash does not verify.

**Week 3 gate.** A pack generated today regenerates byte-identically
tomorrow if no source vintage has changed. A pack generated against a
warehouse with a missing provenance field refuses to issue. The PDF
embeds the `claim_set_hash` and a verification QR code.

**Week 4 gate.** `tsc --noEmit` is clean. Storybook runs locally with the
primitives. Vite production bundle is smaller than today's. The four
pages (Overview, Compare, Evidence, Governance) render against a fixture
API.

**Week 5 gate.** EURES and EIGE data is visible in the UI with full
provenance. The design partner's payroll snapshot reconciles within
0.1% of their stated totals. Axe reports zero serious or critical
violations on the four pages.

**Week 6 gate.** A clean VM provisions and onboards in under one working
day from the runbook. The restore drill from yesterday's backup
succeeds. CI runs lint + dbt build + dbt test + pytest + tsc + vite +
axe + dependency audit, all green, in under 12 minutes wall-clock.

### 4.3 Pre-GA checklist (week 6, last 48 hours)

The launch does not proceed unless every box below is checked. Each is
owned and dated when complete.

```
[ ] Data
    [ ] All 16 Eurostat datasets pulled within last 24h
    [ ] EURES + EIGE pulled within last 7d
    [ ] Design partner payroll reconciled, trust level = customer_reconciled
    [ ] Three reconciliation tests passing
    [ ] dbt build + dbt test green on the deployment warehouse

[ ] Backend
    [ ] No module > 500 LOC
    [ ] OIDC verified end-to-end against design partner IdP
    [ ] CORS allowlist contains exactly the production frontend origin
    [ ] structlog enabled, request ID propagated, no PII in logs (sample reviewed)
    [ ] Governance hash chain verified on read
    [ ] Evidence pack regenerates byte-identically against last week's vintage

[ ] Frontend
    [ ] tsc --noEmit clean
    [ ] axe zero serious/critical on four pages
    [ ] Freshness pill present on every page
    [ ] Provenance visible from every metric tile in two clicks or fewer
    [ ] Bundle size < 500 KB gzipped

[ ] Infrastructure
    [ ] TLS active, A+ on SSL Labs, HSTS preload set
    [ ] EU region confirmed (Hetzner FSN by default; alternative documented)
    [ ] Caddy config in version control
    [ ] systemd unit files in version control
    [ ] Daily borgbackup running; last successful run < 24h
    [ ] Restore drill performed in last 7 days; documented timing

[ ] Compliance
    [ ] DPA template signed by both parties
    [ ] Data residency statement published in deployment README
    [ ] DSR (data subject request) procedure documented
    [ ] Customer's data owner has signed the trust-level reconciliation
    [ ] Privacy notice updated, dated, version-controlled

[ ] Observability
    [ ] Uptime monitor active, paging path tested
    [ ] Freshness alert active for each ingestion source
    [ ] Hash-chain integrity check scheduled (15-minute interval)

[ ] Documentation
    [ ] Onboarding runbook complete, dry-run executed by a second engineer
    [ ] Restore runbook complete
    [ ] Hash-chain break runbook complete
    [ ] Customer-facing user guide PDF, version-stamped
```

A box checked once is checked forever; if a state changes after the box
is checked (e.g., a new module pushes service.py over 500 LOC), the
launch reverts to "not ready" and we do not ship until the box is
re-checked.

---

## 5. Success metrics

Measured at 7, 30, and 90 days post-GA. Each metric has a threshold; a
metric below threshold triggers the response in §5.2.

### 5.1 Metrics and thresholds

| # | Metric | Source | 7-day | 30-day | 90-day |
|---|---|---|---|---|---|
| M1 | Days the deployment was available (5xx rate < 0.1%) | uptime monitor | 7/7 | 29/30 | 88/90 |
| M2 | Successful evidence-pack regenerations | governance log | ≥3 | ≥10 | ≥25 |
| M3 | Days with a Eurostat refresh (no SLA breach) | `/api/freshness` history | 7/7 | 28/30 | 85/90 |
| M4 | Hash-chain integrity verifications passing | scheduled job | 100% | 100% | 100% |
| M5 | Reconciliation tests passing on every dbt build | CI | 100% | 100% | 100% |
| M6 | Design partner active sessions per week | OIDC log | ≥1 | ≥3 | ≥3 |
| M7 | Evidence packs used in design partner's internal comp meeting | qualitative confirmation | 1 | 1 | 2 |
| M8 | Issues filed by design partner | GitHub issues | n/a | ≥3 | ≥5 |
| M9 | Critical/security CVEs unpatched after 7 days | dependency audit | 0 | 0 | 0 |
| M10 | Time from first design-partner data drop to first evidence pack | runbook timing | n/a | < 1 working day | < 1 working day |

M2, M6, and M7 are the leading indicators of product-market fit. M1, M3,
M4, M5, and M9 are the floor. M8 measures whether the customer is
engaged enough to file issues at all (the silent customer is the lost
customer).

### 5.2 What we do when a metric misses

| Tier | Definition | Response |
|---|---|---|
| Floor metric below threshold (M1, M3, M4, M5, M9) | Any miss | Stop new feature work; root-cause and fix before anything else |
| Engagement metric below threshold (M2, M6, M7, M8) | Two consecutive measurement windows | Schedule a customer-success call; review the buyer thesis (D1) |
| M10 above threshold | Two consecutive windows | Audit the onboarding runbook; rewrite the sections that cost time |

A metric miss is information, not failure. A metric miss that we ignore
is failure.

---

## 6. Definition of "launched"

The product is launched when all four of the following are true at the
same moment:

1. The pre-GA checklist (§4.3) is fully checked.
2. The design partner has logged in via OIDC and viewed their own data on
   the live deployment.
3. The first evidence pack has been generated against the design partner's
   reconciled data and verified to be byte-identical on regeneration.
4. The CTO has signed §11 of this document.

If any of those four fails on launch day, we abort and re-run §4.3.
There is no soft launch.

---

## 7. Risk register

Each risk is rated on a 1–5 scale for likelihood and impact. The product
of the two is the priority number. Anything scoring 12 or higher has a
named mitigation and a named owner; anything below 12 is documented and
revisited at the 30-day post-launch review.

### 7.1 Top risks (priority ≥ 12)

| ID | Risk | L | I | P | Mitigation | Owner |
|---|---|---|---|---|---|---|
| R1 | A customer-facing pay claim is wrong because internal data was not actually reconciled | 3 | 5 | 15 | Trust gate (D4); claims suppressed until `customer_reconciled`; reconciliation requires CTO + customer data owner double sign-off; logged in governance with hash | CTO |
| R2 | Eurostat changes a dataset dimension or code, ingestion silently produces a different population | 4 | 4 | 16 | Schema-baseline files in `configs/source_schemas/`; ingestion fails on diff; on-call paged | Data eng lead |
| R3 | Evidence pack regenerates differently after a code change, breaking customer trust in artefact stability | 2 | 5 | 10 | Determinism test in CI on every PR (regenerate against fixture warehouse, assert byte-identical); freezes vintages explicitly | Backend lead |
| R4 | Governance hash chain breaks and we don't notice for days | 2 | 5 | 10 | Verifier runs every 15 min and on every read; pages on break; daily off-site backup is the recovery path | CTO |
| R5 | Design partner cancels mid-pilot, leaving no reference customer | 3 | 4 | 12 | Weekly check-in with design partner CPO; second prospect in pipeline by week 4; written go/no-go review at week 4 | CEO/CTO |
| R6 | EU residency commitment violated by a transitive dependency that phones home to a US service | 2 | 5 | 10 | Outbound firewall on the VM; allowlist of EU endpoints only; quarterly review of `requirements.txt` and `package.json` for telemetry | CTO |
| R7 | OIDC integration fails on launch day because the IdP team is unavailable | 3 | 4 | 12 | Magic-link break-glass in code, documented but disabled by default; week-2 dry-run with the IdP team's sandbox tenant | Backend lead |
| R8 | The single backend engineer leaves or is unavailable for two weeks | 2 | 5 | 10 | Pair-author every weekly Friday demo; runbook is the source of truth, not anyone's head; second engineer reads and dry-runs the onboarding runbook in week 5 | CTO |

### 7.2 Watched risks (priority 6–11)

| ID | Risk | L | I | P | Note |
|---|---|---|---|---|---|
| R9 | DuckDB file corruption | 2 | 4 | 8 | Daily backup; recovery tested |
| R10 | WeasyPrint OOM on a large pack | 3 | 3 | 9 | Process limit; JSON pack fallback |
| R11 | dbt model output schema drifts from API contract | 3 | 3 | 9 | Contract tests in CI |
| R12 | Customer's CSV contains PII beyond the documented schema | 3 | 3 | 9 | Validator strips unknown columns; runbook for data minimisation |
| R13 | Cron job for ingestion runs concurrently with itself after a slow night | 2 | 3 | 6 | `flock` on script entrypoints |
| R14 | Storage on the VM fills up over months of borgbackup | 3 | 2 | 6 | Disk-usage alert at 70%; pruning policy |

### 7.3 Risks we are choosing to accept

| ID | Risk | Why we accept |
|---|---|---|
| R15 | A second customer signs before multi-tenant migration is ready | Mitigation is to stand up a second VM (1 day of work); we accept the operational duplication |
| R16 | A future LLM hallucination if v1.1 ships before the verifier is fully tested | We accept by deferring v1.1 LLM until verifier passes a documented harness; not a v1.0 risk |
| R17 | Eurostat publishes corrected historical data that invalidates a previous evidence pack | Inherent to working with public statistics; documented in the customer-facing user guide |

---

## 8. On-call and incident response

### 8.1 On-call structure

For v1.0, on-call is one engineer (CTO by default). The customer-facing
SLA is 8×5 (08:00–18:00 CET, Mon–Fri) with a 4-hour response window.
There is no 24×7 commitment for v1.0; this is documented in the contract.

When a second engineer joins, on-call moves to a 1-week rotation between
the two, primary and secondary. Until then, the secondary is "the
runbook plus a phone call to the design partner explaining the delay".

### 8.2 Paging policy

A page fires for, and only for:

1. `/health` returns non-200 for 5 consecutive minutes.
2. Any reconciliation test fails on the production warehouse.
3. The governance hash chain fails verification.
4. Any source's `pulled_at` is older than its SLA window.
5. A 5xx rate above 1% over a 10-minute window.

Anything else is an issue, not a page.

### 8.3 Incident severity

| Sev | Definition | Response time | Examples |
|---|---|---|---|
| 1 | Customer cannot use the product, or a wrong number was published | Immediate | Hash chain broken; reconciliation regression in production; OIDC down |
| 2 | Customer can use the product but a critical capability is degraded | 4 working hours | Evidence pack PDF render fails; one source stale past SLA |
| 3 | Cosmetic or non-blocking issue | Next working day | UI spacing bug; non-critical CVE; flaky test |

### 8.4 Sev-1 procedure

1. Acknowledge the page in the on-call channel.
2. Open an incident in the issue tracker tagged `sev-1`.
3. If a wrong number may have been published: emit a halt-export
   notice, suspend `/api/evidence-pack`, and notify the customer's
   data owner within 60 minutes with a written holding statement.
4. Identify root cause. Do not deploy a fix until root cause is
   understood; a hot-fix on a hash-chain bug is how you compound the
   problem.
5. Apply fix on a branch, full test suite, deploy.
6. Verify with the customer that the issue is resolved.
7. Write a post-mortem within 5 working days. Post-mortem template at
   `docs/runbooks/post-mortem-template.md`. Blameless. Root cause +
   contributing factors + fixes (immediate, near-term, structural).

### 8.5 Rollback

Rollback is a `git checkout` of the previous tag and a `systemctl
restart` of the API. The dbt warehouse is **not** rolled back; we do not
mutate historical data on rollback. If a bad data ingestion is the
cause, the previous warehouse file is restored from backup.

A rollback is a decision, not an emergency reflex. The order is: stop
the bleeding (suspend the affected endpoint), diagnose, then either
rollback or roll forward. Rolling forward is preferred when the fix is
small and understood.

### 8.6 Customer communications

The customer is told about an incident. Always. Within 60 minutes for
sev-1, by end of working day for sev-2. Format:

```
Subject: WorkforceGuard incident — <one-line summary>
Status: investigating | identified | mitigated | resolved
Started: <iso>
Customer impact: <one paragraph>
What we are doing: <one paragraph>
Next update: <iso>
```

Updates posted at the cadence committed in the previous update.
Post-mortem shared with the customer once written; they decide whether
they want it written or verbal.

---

## 9. Backups, restore, and continuity

### 9.1 What we back up

- DuckDB warehouse file: `data/warehouse.duckdb`.
- Governance SQLite file.
- Raw ingest snapshots: `data/eu_raw/`, `data/internal_raw/`.
- The deployment's `.env` (encrypted), Caddy config, systemd units.
- The signing keypair (encrypted, with split key shares held by CTO and
  customer data owner).

### 9.2 Schedule

- Daily `borgbackup` to a sibling EU bucket. 30-day retention.
- Weekly snapshot retained for 12 weeks.
- Monthly snapshot retained for 12 months (compliance).

### 9.3 Restore SLOs

- Restore from yesterday's backup: under 30 minutes wall-clock.
- Restore from a 30-day-old backup: under 2 hours.
- Tested quarterly. The restore drill is recorded in
  `docs/runbooks/restore-drill-log.md`.

### 9.4 Business continuity

If the VM dies, we provision a fresh VM, restore from backup, repoint
DNS, and notify the customer. SLO from VM-dead to back-up: 4 hours.
This is achievable because the VM has no state that is not in the
backup bucket.

If Hetzner FSN goes down regionally, we provision in Hetzner Helsinki
or Scaleway PAR from the same backup. SLO: 8 hours.

If we as a company go away: the customer holds a copy of their data
(monthly export delivered as part of the contract), the evidence-pack
signing key shares can be reassembled, and the warehouse is portable
(DuckDB + dbt is open-source).

---

## 10. Post-launch plan

### 10.1 First 30 days

- Daily standup (10 min) covering metrics M1–M10.
- Weekly customer-success call with the design partner.
- One scheduled review at day 14 (`docs/reviews/day-14.md`).
- One scheduled review at day 30 (`docs/reviews/day-30.md`).

### 10.2 Day-30 decision

At day 30, the CTO and CEO answer three questions in writing and commit
the answer to the repo:

1. Did v1.0 succeed against §5 metrics? Yes / partially / no.
2. What is the build order for v1.1, given everything we learned?
3. Do we sign a second customer now, or focus on Phase 4 first?

A "no" answer to question 1 triggers a pause on all forward-looking work
until root cause is understood and a corrective plan is signed.

### 10.3 Day-90 decision

At day 90, the same three questions, plus:

4. Is the buyer thesis (D1) confirmed by what we have learned, or does
   it need adjusting?

If the answer to question 4 is "needs adjusting", v1.1 scope opens for
revision before any code is written.

### 10.4 v1.1 build order, provisional

The order is provisional and confirmed at day 30. Default sequence:

1. Phase 4 (compliance approval flow), specced from the design partner's
   2026 filing-rehearsal cycle ahead of the binding 2027 report.
2. LLM-with-tools narrative layer, behind a per-deployment flag.
3. Multi-tenant migration to Postgres (v1.1.5), triggered by customer #3.
4. Custom-branded evidence packs.

Each is its own design doc. Each requires a written go-decision before
work begins.

---

## 11. Sign-off

The launch does not proceed until every signatory below has signed the
current version of this document, and the pre-GA checklist (§4.3) is
fully checked.

| Role | Name | Date | Signature |
|---|---|---|---|
| CTO | | | |
| CEO | | | |
| Backend lead | | | |
| Data engineering lead | | | |
| Frontend lead (if separate) | | | |
| Customer data owner (design partner) | | | |
| Customer compliance lead (design partner) | | | |
| Customer IT / security (design partner) | | | |

A signature is a commitment that the signer has read this document, has
read `docs/01-technical-design.md`, and is on the hook for their
section. A signature on a stale version of either document is invalid.

---

## 12. Amendments

| Date | Amendment | Author | Approved by |
|---|---|---|---|
| 2026-04-27 | Initial draft. | CTO | pending |

Any change to the scope (§3), the success metrics (§5), the rollout (§4),
or the risk register (§7) is an amendment. Amendments require the same
signatures as the original document. Comments and clarifications that do
not change a binding statement do not require an amendment.

---

*End of Production Launch & Readiness Document.*
