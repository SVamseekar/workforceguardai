# WorkforceGuard AI

**Pay-transparency intelligence for European employers**

A product and technical brief for design partners and investors.
Spring 2026. Version 1.0.

---

## In one paragraph

WorkforceGuard AI is a single-tenant analytics application that helps
European employers prepare for the EU Pay Transparency Directive. It
ingests a customer's payroll and job architecture, compares them
against official EU labour-market data (Eurostat, Eurofound, EIGE,
EURES), and produces a signed evidence pack the customer attaches to
their compliance filing. Every number on screen is traceable to a public
source. Every export is hash-signed and reproducible. The product is
built for one buyer with a hard 2027 filing deadline and the
defensibility requirements of regulated reporting.

---

## 1. The problem

The EU Pay Transparency Directive (2023/970) requires every employer
with 100 or more workers to publish their gender pay gap by worker
category and to justify any unadjusted gap above 5% with objective,
gender-neutral criteria. Member states must transpose the directive
into national law by **7 June 2026**. The first reports cover **2026
data** and are due in **2027**.

The implication for an EU employer is that 2026 is the year you have to
be measuring, not the year you start. By the time you sit down to file,
the data window has closed.

The buyers we serve are CPOs and Heads of Compensation at companies
with 500–5,000 employees. They are advised by employment counsel and
their works council. Their problem statement, in their words:

> "I need to publish a number, defend it line by line, and prove the
> decisions behind it followed a documented process. Spreadsheets aren't
> going to survive an audit."

The market for this is concrete. There are roughly **40,000 EU employers
with 250+ employees** subject to the directive's reporting cadence,
plus another 130,000 in the 100–249 band. The first cohort needs the
product live in their environment by summer 2026 to capture a clean year
of data.

---

## 2. Why now

Three forcing functions converge in 2026:

**The directive is binding.** Member states have transposed or are
transposing. Penalties are local and material. France, Spain, Germany,
Belgium, Ireland, and the Netherlands have additional national pay-gap
reporting that overlaps but does not replace the EU regime.

**Public data quality has caught up.** Eurostat now publishes vacancy
statistics by occupation and region (experimental statistics, online
job advertisement integration), EU-SILC indicators are annual, and
Eurofound's EWCS 2024 first findings landed in September 2025 with a
full overview report due March 2026. The supply of citable EU
labour-market data is the best it has ever been.

**The buyer is consolidating.** HR-tech tools were sold for a decade as
"engagement platforms" and "people analytics suites" with vague
returns. Pay transparency is the first compliance-driven HR purchase
with a board-level deadline. CPOs are picking the small number of
vendors they will trust with this filing.

A product that lands a credible reference customer in summer 2026 is
positioned to be that vendor for the 2027 filing season.

---

## 3. What we built

A workforce-intelligence dashboard and evidence-pack generator that
runs on the customer's own deployment, pulls public EU data, and emits
the artefacts that survive an audit.

### 3.1 The capability

**Comparative dashboard.** The customer's metrics rendered side by side
with EU-27 averages, peer countries, and peer sectors. Every metric
carries the full chain of provenance: who published it, which dataset
code, what vintage, when we pulled it, under what licence.

**Evidence pack.** A signed JSON + PDF report bundling the numeric
claims, their provenance, the warehouse vintage, and the actor identity
of the export. Hash-chained. Regenerable byte-identically from the same
warehouse vintage. Designed to be the single attachment a customer
hands to their employment counsel and to a regulator.

**Governance log.** Every approval, override, reversal, and export is
written to a tamper-evident log with the actor's identity from the
customer's IdP. A break in the hash chain is detected and surfaces.

**Templated narratives.** Every sentence on screen is generated from
typed objects whose numbers come straight from the warehouse. There is
no language model rewriting numbers, and there is no place a number can
appear in narrative that did not come from a public source. We will
introduce a language-model rewrite layer in v1.1 with a verifier that
fails closed on any hallucinated number.

### 3.2 The data

We use only public, citable, free EU sources:

| Source | Publisher | Used for |
|---|---|---|
| Eurostat (16 datasets via JSON-stat API) | European Commission | Employment, unemployment, vacancy, gender pay gap, labour flows, slack, EU-SILC, GDP per capita, commuting |
| ESCO (occupations, skills, alternative titles) | EC / European Labour Authority | Occupation hierarchy, skill mapping |
| EU-SILC indicators | Eurostat | Housing cost overburden, income distribution, at-risk-of-poverty |
| EURES | EC / ELA | Vacancy statistics by occupation × region |
| EIGE Gender Equality Index | European Institute for Gender Equality | Country-level pay-equity context |
| Eurofound EWCS 2024 | Eurofound | Job-quality framework, citable narrative |
| ILOSTAT | International Labour Organization | Cross-check vs Eurostat |

We do not scrape job boards, do not use Glassdoor or Levels.fyi data,
do not republish consulting-report figures as warehouse rows, and do
not generate synthetic numbers behind customer-facing claims. This is a
contract, not a marketing line: the architecture refuses to render a
number that does not have all six provenance fields populated.

### 3.3 The deployment

One customer, one VM, one DuckDB file, one FastAPI process, one Caddy
reverse proxy. Hosted in an EU region (Hetzner FSN by default; OVH GRA
or Scaleway PAR on customer request). Authenticated via OIDC against
the customer's identity provider. Backed up daily to a sibling EU
bucket. No data leaves the customer's deployment. No US transfer.

The cost floor is under €60 per customer per month, fully loaded.

---

## 4. Why this is defensible

A pay-transparency product is a regulated artefact. The buyer is grading
us on four things, in this order:

**1. Can you trace the number?**
Every numeric row in our warehouse carries `source_publisher`,
`source_dataset_code`, `source_url`, `source_vintage`,
`source_pulled_at`, and `licence`. A row missing any of these fails the
build. The API exposes them on every metric. The UI surfaces them in
two clicks. The PDF embeds them on the last page.

**2. Can you reproduce the export?**
The evidence pack canonicalises its claim set, hashes it with sha256,
and signs it with ed25519. Regenerating against the same warehouse
vintage produces a byte-identical JSON pack. A customer holding a pack
from October can prove in February that we issued exactly that pack.

**3. Can you prove the process?**
The governance log is hash-chained. Every approval, override, reversal,
and export is written with actor identity from the customer's IdP. A
break in the chain is detected on read and on a 15-minute schedule. A
break blocks export and pages the operator.

**4. Can you keep the data inside the EU?**
The deployment is single-tenant on an EU-region VM with an outbound
firewall that allows only EU endpoints. Data residency is not a feature
flag; it is the deployment shape.

These four properties are not difficult to claim in a marketing
website. They are difficult to actually have. Our codebase enforces
them as build-time constraints, not as conventions. A future engineer
who tries to add a numeric column without provenance has the build
fail in CI.

---

## 5. What is special about how we built it

Three architectural choices distinguish the product from a typical
HR-analytics tool:

**Determinism over impressiveness.** The numeric layer is plain SQL in a
dbt project against DuckDB. There is no machine-learning model
inference between data and a number on screen. This is unfashionable
and correct: a buyer who has to defend a number to a regulator does not
want a model in the loop.

**Single-tenant by choice, not by limitation.** One customer, one
deployment. Cross-customer leakage is impossible because there is no
cross-customer code path. The migration to multi-tenant Postgres is
specced and waiting in the technical design document; we trigger it
when the third paying customer signs, not before.

**Provenance is a build constraint, not a UX flourish.** The warehouse
refuses to build if a numeric row is missing any of the six provenance
fields. This is the cheapest possible enforcement and the most
expensive feature to retrofit later. We shipped it before we shipped
the dashboard.

The combination produces a product that is honest about what it is.
Numbers come from named public sources. Process is logged. Exports are
reproducible. A buyer's employment counsel can read the data flow in
ten minutes and sign off.

---

## 6. What we are explicitly not doing

A small product is a defensible product. The decisions below are
deliberate. Each one is a thing we believe is the wrong shape for the
2026–2027 buyer, regardless of how attractive it sounds at a sales
meeting.

**We are not building a multi-tenant SaaS.** One customer, one
deployment. The migration to multi-tenant is specced; we will do it
when the third customer signs. Until then, isolation is by VM, which
is the strongest form available.

**We are not putting a language model on the path between data and a
number.** A model rewrite layer with verification ships in v1.1.
Verification fails closed: any number in model output that does not
appear in the tool-call results triggers a templated fallback. We are
not putting "AI" in the product name in technical documents, and we
will not let marketing claims outrun what the system actually does.

**We are not shipping the approval workflow yet.** Phase 4 (route an
evidence pack through a chain of internal approvers, capture override
reasons, generate the regulator-shaped output) is the highest-value
upcoming feature. Its specification will come from observing the
design partner's 2026 filing-rehearsal cycle, ahead of the binding
2027 report, not from imagination in spring 2026. A workflow built
without watching a real filing happen is the wrong workflow.

**We are not integrating with HRIS systems in v1.0.** Workday, SAP
SuccessFactors, BambooHR, and Personio adapters land in v1.2 against
real customer demand. The design partner ships a CSV via SFTP in 30
minutes; building a Workday adapter takes a quarter and benefits no one
in the first cohort.

**We are not building a mobile experience.** Compliance work is desktop
work. Every hour spent on responsive layout below 1024px is an hour not
spent on data integrity.

**We are not licensing third-party pay benchmarks.** Glassdoor,
Levels.fyi, payscale, and the consulting firms' compensation databases
are out. They are subscriptions the customer can layer on themselves if
they want; we will not republish them as primary data inside a paid
product.

**We are not pricing on seats.** The buyer is one CPO with a filing
obligation. Per-seat pricing on a compliance product converts an
internal champion into an internal procurement fight. We will price on
deployment-and-data, not on user count.

---

## 7. Roadmap

The roadmap is organised around the customer's calendar, not ours.

### 7.1 v1.0 GA — Q2 2026

Six weeks of focused work. Scope frozen in
`docs/02-launch-readiness.md`. One paying design partner live on their
own deployment with their own data, generating evidence packs against
a reconciled warehouse. Reference logo on close.

### 7.2 v1.1 — Q3 2026

Three additions, in order:

1. **Phase 4: compliance approval workflow.** Specced from the design
   partner's 2026 filing-rehearsal cycle, ahead of the binding 2027
   report. Routes an evidence pack through a configurable approval
   chain, captures override reasons, produces the regulator-shaped
   output template per member state.
2. **Language-model narrative rewrite layer.** Anthropic Claude with a
   tool surface (the existing `domain/metrics.py` functions exposed as
   typed tools), prompt caching on the system prompt and metric
   registry, and a verifier that fails closed on hallucinations. The
   templated fallback stays as the safety net.
3. **Custom-branded evidence packs.** A per-customer template inheriting
   from the base, with logo and colour overrides. No code change in
   `domain/evidence.py`.

### 7.3 v1.1.5 — late Q3 2026

Multi-tenant migration to Postgres, triggered by the third paying
customer signing. Single deployment per region with schema-per-tenant
isolation. The DuckDB-on-disk shape stays as the staging warehouse on
each ingestion VM; only the serving warehouse moves to Postgres.

### 7.4 v1.2 — Q4 2026 / Q1 2027

HRIS partner integrations. One adapter at a time, in order of design-
partner demand: Workday, then SAP SuccessFactors, then Personio
(strong in DACH SMB), then BambooHR. Each adapter lands files into the
same `data/internal_raw/` directory the SFTP path uses today.

Local-language narratives at parity for FR, DE, ES, IT, EN, NL, PL.

### 7.5 v2.0 — 2027 filing season

The product running concurrent filings for every paying customer in the
2027 cohort. The 2027 filing season is the moment the product earns its
existence; everything in v1.0–v1.2 is shaped to make it boring rather
than dramatic.

---

## 8. Team and execution

Today's team is small and intentionally narrow:

- **CTO and founding engineer** — owns architecture, backend, evidence
  pack, governance, deployment. Has shipped the v1.0 baseline.
- **Data engineer (part-time, expanding to full-time on funding)** —
  owns Eurostat ingestion, dbt project, reconciliation tests.
- **Frontend engineer (contract through GA)** — owns the React SPA
  refactor, design system, accessibility pass.
- **Customer-success and partnerships (founder-led)** — owns design
  partner relationship, deal closure, contract administration.

The three engineering roles cover the v1.0 GA. The hiring sequence
post-funding is: a second backend engineer (for v1.1 LLM and Phase 4),
then a full-time data engineer, then a designer.

We are not hiring against a headcount target. We are hiring against the
work that the calendar in §7 actually requires.

---

## 9. Where the design partner fits

A design partner is not a customer in disguise. The relationship has
three concrete commitments.

**From them.** Real payroll and job architecture data under NDA. A named
data owner who reconciles totals once. A named compliance lead who reads
an evidence pack and tells us where it falls short. A weekly 30-minute
call through GA. A reference quote at 30 days post-launch if the
product earned it.

**From us.** A pilot at a contractually low price. Managed onboarding —
we run the ingest, the reconciliation, the deployment. Daily updates
through the GA window. Direct access to engineering, no support tickets.
A documented exit if either side decides the fit is wrong.

**From the relationship.** The Phase 4 workflow specification, written
together against the partner's 2026 measurement-and-rehearsal cycle in
preparation for their binding 2027 report. This is the most valuable
artefact either side will produce, because it becomes the spine of v1.1
and the moat against generic competitors.

We are looking for one partner today. The criteria, in order: an EU
employer between 500 and 5,000 employees with a real 2027 filing
obligation; a CPO and a Head of Compensation who are personally on the
hook for the filing; an in-house data team that can produce a clean
payroll snapshot; legal counsel willing to engage with the artefact.

---

## 10. The ask

There are three asks, depending on who is reading this.

**A potential design partner.** A 30-minute call to walk through the
product against your specific reporting obligation. Bring your data
owner. We will leave with either a path to a paid pilot or a clear
reason this is the wrong fit. Either is a useful outcome.

**A potential first customer post-GA.** Same 30-minute call. We can
have you onboarded in one working day from contract signature, on your
own EU deployment, with managed support through your first filing.

**A seed investor.** This is a regulated EU SaaS sold to enterprise HR
buyers with a fixed 2027 filing deadline. The TAM is concrete (40,000
EU employers in the directive's reporting cadence), the buyer is named,
the product is built to the seriousness the buyer expects, and the
calendar is forced. We are raising a small seed to fund the second
engineer, the data engineer, and the design partner's pilot through
GA. The pitch deck and financials are available on request.

The right next step is a conversation with the founder. Contact details
are at the end of this document.

---

## 11. Appendix: source list

The full list of sources used by the product, with publisher, licence,
and refresh cadence.

| # | Source | Publisher | Licence | Refresh |
|---|---|---|---|---|
| 1 | Eurostat JSON-stat API (16 datasets) | European Commission | CC-BY 4.0 | Daily pull, publisher cadence varies (quarterly to annual) |
| 2 | ESCO API (occupations, skills) | EC / European Labour Authority | EUPL / CC-BY | Weekly pull |
| 3 | EU-SILC (`TESSI162`, `TESSI164`, `TESSI166`, `ilc_di03`, `ilc_di12`, `ilc_peps01n`) | Eurostat | CC-BY 4.0 | Daily pull, annual publisher cadence |
| 4 | EURES vacancy statistics | EURES / ELA | EU open data | Daily pull, quarterly publisher cadence |
| 5 | EIGE Gender Equality Index | European Institute for Gender Equality | CC-BY 4.0 | Weekly pull, annual publisher cadence |
| 6 | Eurofound EWCS 2024 first findings + overview report | Eurofound | CC-BY 4.0 | Manual extract per release |
| 7 | ILOSTAT (cross-check vs Eurostat headlines) | International Labour Organization | CC-BY 4.0 | Reconciliation only |
| 8 | NACE Rev. 2 reference codes | EC | EU public | Static, versioned |
| 9 | ISCO-08 reference codes | International Labour Organization | UNSD public | Static, versioned |

Sources listed in `eu_hr_analytics_sources.md` but **not** used as
warehouse rows in v1.0:

- Consulting reports (Deloitte HCT, McKinsey State of AI, BCG AI at
  Work, Bain Working Future, EY Work Reimagined, PwC Hopes & Fears,
  Mercer benefit reports). These are citable in narrative; not loaded
  as data.

Sources we will never use:

- LinkedIn, Glassdoor, Levels.fyi, payscale, or any scraped feed.
- Synthetic compensation data presented as real.

---

## 12. Change log

| Date | Version | Author | Note |
|---|---|---|---|
| 2026-04-27 | 1.0 | CTO | Initial brief for design partners and seed investors. |

---

## 13. Contact

Founder & CTO — direct line, no gatekeeping, two-business-day response.

WorkforceGuard AI is a Frankfurt-and-Dublin-registered EU vendor.
Customer deployments are in EU regions only. No data leaves the EU.

---

*End of Public Product/Technical Brief.*
