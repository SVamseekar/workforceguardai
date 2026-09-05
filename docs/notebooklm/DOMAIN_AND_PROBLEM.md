# Domain and Problem

## The regulatory trigger

The EU Pay Transparency Directive (2023/970/EU) requires member states to transpose it into national law by **7 June 2026**. Under the Directive:

- Employers with **≥100 workers** must publish pay gaps by worker category.
- Any **unadjusted gap ≥5%** that cannot be justified by objective, gender-neutral criteria must be corrected via a joint pay assessment.
- First employer reports are due in **2027** (for 2026 data), starting with employers of **≥250 employees**; the **≥100** threshold phases in by **2031**.
- CSRD and Article 9 SFDR impose parallel, overlapping workforce-disclosure obligations on the same companies.

The practical consequence the project is built around: employers need to be **collecting and structuring 2026 pay data now**, not reconstructing it retroactively once the deadline arrives. That timing pressure — not generic "HR analytics" demand — is the commercial premise of WorkforceGuard.

## What WorkforceGuard AI is

WorkforceGuard AI is a workforce-intelligence and pay-transparency compliance platform for HR, people analytics, compensation, workforce planning, and compliance/legal teams at EU employers. It combines:

1. **Public EU labour-market data** (Eurostat) — employment, unemployment, job vacancies, gender pay gap, labour-market slack/flows, poverty/income/housing indicators — across all 27 EU member states.
2. **Internal company payroll/HRIS data** (uploaded CSV or generated for demos) — benchmarked against the public layer.
3. A **compliance and governance layer** — every metric carries source/version/provenance metadata, and every human decision (approve/override/reverse/export) is written to a SHA-256 hash-chained audit log.

It is simultaneously (a) a software product intended for EU employers navigating the Directive, and (b) the empirical basis for a research paper by the same author (see below) — the software implements the same composite indices the paper analyzes.

## Key domain concepts encoded in the system

- **Gender pay gap (GPG)** — the Eurostat definition: the difference between average gross hourly earnings of male and female employees, expressed as a percentage of male earnings. Distinct from an *adjusted* pay gap (controlling for job, seniority, etc.) — WorkforceGuard's `internal_gender_pay_gap` is an **unadjusted** gap computed per worker category, matching what the Directive actually requires employers to report and justify.
- **NACE** (Nomenclature statistique des Activités économiques dans la Communauté Européenne) — the EU standard industry/sector classification. Used throughout for sector-level benchmarking (e.g., Finance, ICT, Construction).
- **NUTS** (Nomenclature des Unités Territoriales Statistiques) — EU standard for sub-national geographic regions. The dimensional model (`dim_geography`) is built to support NUTS levels, though live marts currently expose country-level (NUTS 0) granularity only — NUTS 2 is a documented, blocked gap.
- **ESCO** (European Skills, Competences, Qualifications and Occupations taxonomy) — provides the occupation and skills backbone (occupation hierarchy, skills, digital/green skill indicators, ESCO↔NACE crosswalk), used to compute skill-coverage inputs to one of the composite indices.
- **Worker category** — the Directive's own unit of comparison ("workers performing the same work or work of equal value"). Modeled explicitly as `dim_worker_category`, derived from the internal job architecture — this is the grain at which pay-gap review actually has to happen under the law, not just at the company-wide level.
- **Composite workforce-intelligence indices** — four indices computed from the Eurostat signals: Hiring Pressure Index (HPI), Labour Resilience (LR), Equity Risk Score (ERS), and Transition Readiness (TR, explicitly "in development"/proxy status). These are the same indices analyzed empirically in the accompanying research paper.
- **Pay-transparency review states** — `justified_difference` / `observed_gap` / `unresolved_review_item`, assigned via fixed thresholds (5%, 10%, 2% market-delta) that mirror the Directive's own 5% justification trigger.

## Data sources

| Source | What it provides | Geographic scope |
|---|---|---|
| Eurostat Labour Force Survey (LFS) | Employment rate, unemployment rate, gender pay gap | EU27, 2019–2025 (configured) |
| Eurostat Job Vacancy Statistics (JVS) | Job vacancy rate by NACE sector | EU27, quarterly |
| Eurostat Structure of Earnings Survey (SES) | Pay gap by sector/age, the research panel's basis | EU27, 11 sectors in the research panel |
| Eurostat social/economic series (poverty, Gini, housing overburden, GDP per capita, commuting time) | Contextual socioeconomic indicators | EU27 |
| ESCO | Occupation hierarchy, skills, NACE crosswalk | EU-wide taxonomy |
| EGAPRO (France) | Company-level gender-equality index, ~138k French company scores 2018–2025 | French companies |
| UK Gender Pay Gap Service | Company GPG disclosures | UK-listed/reporting companies |
| Internal payroll/HRIS/ATS/job-architecture/learning data | Company-specific pay and workforce facts | Uploaded by tenant, currently sample/synthetic in the shipped repo |

## Why the builder judged existing tools insufficient

This is inferred from the project's own framing (README, master reference, security audit, canonical metrics doc) rather than asserted as an external market claim:

- **Generic HR analytics tools are not built for a specific legal audit surface.** The README states explicitly: "WorkforceGuard is designed specifically for this compliance surface — not generic HR analytics." The design principle "compliance first" (every recommendation traceable and reviewable) and "metadata is a product feature" (every number carries source, formula version, coverage state) are direct responses to a compliance requirement, not a UX nicety.
- **Metrics-before-LLMs, not LLM-as-analyst.** The system deliberately keeps the numeric layer deterministic — every displayed number is computed in SQL by dbt, not by a language model — because a legally defensible compliance product cannot have a hallucination-prone step between raw data and a number a regulator might scrutinize. The "AI copilot" is templated string composition over pre-computed SQL outputs, not a generative answer.
- **The regulatory literature/tooling gap the research paper targets.** The paper's own novelty argument (see `paper/novelty_implementation_spec.md`) is that no existing published work does a panel/fixed-effects test of whether labour-market tightness closes gender pay gaps across the EU27, framed explicitly against Directive 2023/970. The closest adjacent academic work (Kiss et al. 2022 on EU tightness/slack; a 2024 German administrative-data study on tightness→wage elasticities) does not combine cross-country panel identification, a gender-pay-gap outcome, and the Directive's compliance framing. WorkforceGuard-the-software is positioned as the empirical/operational counterpart to that gap: a system that computes the same indices live, continuously, with governance and provenance, rather than as a one-off academic exercise.

## Honest caveat

Some of this framing (e.g., "existing tools were insufficient") is the builder's own stated rationale in project documents, not independently verified against a market or literature survey beyond what's in `paper/novelty_implementation_spec.md`. Readers should treat it as the builder's stated motivation, not an audited market claim.
