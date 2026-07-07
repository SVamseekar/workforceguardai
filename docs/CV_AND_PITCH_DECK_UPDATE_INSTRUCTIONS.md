# CV & Pitch Deck Update Instructions — WorkforceGuard AI

**Date:** 2026-07-08
**Purpose:** Handoff for Claude Chat to update **CV .docx/.pdf and pitch deck PDF only**.
**Already updated in code (do not redo):** Portfolio website (`projects.ts`, `profile.ts`), WorkforceGuard landing/README/MissionPage.

**Source of truth for numbers:** Live product + `data/paper_exports/` (July 2026 panel). Canonical reference: `docs/METRICS_CANONICAL.md` (created in repo same date).

---

## Files to edit

| Asset | Path |
|-------|------|
| CV (Word) | `/Users/souravamseekarmarti/Documents/Marti_Soura_Vamseekar_CV.docx` |
| CV (PDF) | `/Users/souravamseekarmarti/Documents/Marti_Soura_Vamseekar_CV.pdf` (export after .docx) |
| Pitch deck | `/Users/souravamseekarmarti/Downloads/MSV_AI_Labs_Pitch_Deck.pdf` |

**Live product URL:** https://workforceguardai.souravamseekar.com
**Research preprint (canonical citation):** [MPRA Paper No. 129330](https://mpra.ub.uni-muenchen.de/129330/)

---

## Executive summary of required changes

1. **Remove unsubstantiated ML metrics** for WorkforceGuard (7 models, 94.7%, AUC 0.855, 912K test, 32,769 training, 99.5% recall) — not evidenced in the WG repo.
2. **Update panel geography:** “20-country” → **27 EU member states** (or qualify explicitly if keeping “20” in paper title).
3. **Update research statistics** to export-backed values (correlation, GPG means).
4. **Fix directive dates:** transposition **7 June 2026**; first reporting **June 2027** (250+ employees) — not “May 2026”.
5. **Soften dbt model count:** avoid hard “28-model” unless re-counted; use “multi-layer dbt pipeline” or **31 models** (per `docs/paper/system_description.md`).
6. **Add product capabilities** missing from deck: SHA-256 governance, live research dashboard, composite index names, compliance thresholds.
7. **Fix publication wording:** use “published working paper / MPRA preprint” — not “peer-reviewed” unless formally accepted by a journal.

---

## Canonical metrics (use these everywhere)

Copy this block verbatim where a WorkforceGuard metrics summary is needed:

> **WorkforceGuard AI** ingests **16 Eurostat datasets** (LFS, JVS, SES) across **27 EU member states** and **13 NACE sectors** in the live dashboard (**11-sector SES research panel** in the econometric paper). A **multi-layer dbt + DuckDB** pipeline computes **four composite indices** — Hiring Pressure Index (HPI), Labour Resilience (LR), Equity Risk Score (ERS), and Transition Readiness (TR) — with a **SHA-256 hash-chained governance log** for Directive (EU) 2023/970 workflows. Published research on a **2019–2024 Eurostat panel** finds employment rate and gender pay gap correlate **r ≈ +0.44** (n=27); EU27 finance-sector gap averages **~25%** vs **~10.9%** all-sector panel mean. **Directive transposition: 7 June 2026.** First employer reporting: **June 2027** (≥250 employees). Product flags **5% / 10% / 2% market-delta** review thresholds.

---

## CV — section-by-section changes

### A. WorkforceGuard AI project block (Independent / MSV AI Labs)

#### REMOVE entirely (no repo evidence)

- `7 models, 32,769 training samples, 912K-record test set`
- `Random Forest — 94.7% accuracy, AUC 0.855, 99.5% recall`
- Any bullet that ties ML accuracy numbers to WorkforceGuard specifically

**Keep** (if space allows, rephrase):

- Evidence-bounded analyst / copilot that refuses on insufficient coverage (product feature — not ML accuracy claims)

#### REPLACE — Data pipeline bullet

**Current (wrong/stale):**
> 28-model dbt pipeline … across EU27 and 11 NACE sectors

**Replace with:**
> End-to-end analytics platform ingesting **16 Eurostat datasets** (LFS, JVS, SES) across **27 EU member states**; **13 NACE sectors** in the live dashboard (**11-sector SES panel** in published research). **Multi-layer dbt + DuckDB** pipeline computing **4 composite indices (HPI, LR, ERS, TR)** with **SHA-256 hash-chained** governance log for EU Pay Transparency Directive **2023/970/EU** compliance workflows.

#### REPLACE — Research finding bullet

**Current:**
> r = +0.41 … across **20 EU** member states

**Replace with:**
> First quantitative evidence that labour market tightness and gender pay gaps are **positively correlated (r ≈ +0.44, n=27)** — contradicting competitive equalisation theory. Introduced **Combined Risk Quadrant (HPI × ERS)** typology. EU27 finance-sector gap **~25%** vs **~10.9%** all-sector panel mean.

#### ADD (if not present)

- Live URL: `workforceguardai.souravamseekar.com`
- Live **Research** module in dashboard (`/app/research`) — paper figures served from same warehouse as product
- Directive dates: transposition **7 June 2026**; reporting from **June 2027**

---

### B. Publications / research entry on CV

**Paper title** — two options (pick one consistently with MPRA):

| Option | Title |
|--------|-------|
| **A (keep title, fix subtitle)** | *Why Tight Labour Markets Do Not Close Gender Pay Gaps: Evidence from a 20-Country Eurostat Panel* — add footnote: “Panel extended to 27 member states in latest replication; see MPRA 129330.” |
| **B (update title)** | *Why Tight Labour Markets Do Not Close Gender Pay Gaps: Evidence from a 27-Country Eurostat Panel* |

**Methodology bullet — REPLACE:**

**Current:**
> r = +0.41 … 20-country … 20-country Eurostat dataset

**Replace with:**
> Panel econometrics on Eurostat data (**2019–2024**, **11 NACE sectors**, **27 member states**). Employment–GPG correlation **r ≈ +0.44**. Combined Risk Quadrant (**HPI × ERS**). Findings implemented in open-source **WorkforceGuard AI** system with reproducible `data/paper_exports/`.

**Venue line — REPLACE:**

**Current:** May 2026 / SSRN peer-reviewed framing

**Replace with:**
> **MPRA Paper No. 129330** (2026) · SSRN · Zenodo — *working paper / independent researcher*

**Do not say** “peer-reviewed” unless referring to a journal acceptance.

**Implementation bullet — keep but update:**
> 4 composite panel indices (HPI, LR, ERS, TR); SHA-256 hash-chained governance; live dashboard at workforceguardai.souravamseekar.com

---

### C. Skills / summary lines (if WG mentioned)

- If summary mentions “94.7%” or “912K” in context of WG → remove or move to a **different project** only if substantiated elsewhere.
- “28-model dbt” → “dbt + DuckDB multi-layer pipeline”

---

## Pitch deck — slide-by-slide changes

### Slide 2 — “At a Glance” / founder credentials

| Element | Current | Change to |
|---------|---------|-----------|
| “Published peer-reviewed paper” | Misleading | **“Published working paper (MPRA 129330)”** |
| “20-country Eurostat panel” | Stale | **“27-country Eurostat panel”** |
| “94.7% Best ML model accuracy (RF)” | Not WG-specific / unverified for WG | **Remove** or replace with **“27 EU states · r ≈ +0.44 employment–GPG correlation”** |
| “May 2026” (research date) | OK as publication month | Keep if accurate; do **not** conflate with Directive deadline |

---

### Slide 4 — WorkforceGuard AI (main product slide)

This slide needs the **largest rewrite**.

#### REMOVE

- `Random Forest + 6 other ML models`
- `94.7% Random Forest accuracy, AUC 0.855`
- `912K Records in ML test set`
- `28-model dbt` (unless updated to 31)

#### REPLACE body copy

**Current:**
> 28-model dbt pipeline … EU27 … four composite indices …

**Replace with:**

> EU workforce intelligence platform with a **published MPRA working paper** ([No. 129330](https://mpra.ub.uni-muenchen.de/129330)). A **dbt + DuckDB** warehouse ingests **16 Eurostat datasets** across **27 member states**, computing **HPI, LR, ERS, and TR** for Pay Transparency Directive **(EU) 2023/970** workflows — formula-versioned, provenance-tagged, and **SHA-256 hash-chained** audit trail. Live research views mirror paper figures from the same pipeline.

#### REPLACE “Key Metrics” row

| Old metric | New metric |
|------------|------------|
| 94.7% RF accuracy | **r ≈ +0.44** employment–GPG correlation (27 countries) |
| 912K ML test records | **~25%** EU27 finance-sector gender pay gap (Eurostat SES) |
| 16 Eurostat datasets | **16 Eurostat datasets** (keep) |
| (missing) | **~10.9%** all-sector panel mean GPG |
| (missing) | **4 composite indices** (HPI, LR, ERS, TR) |
| (missing) | **SHA-256** tamper-evident governance log |
| (missing) | **7 Jun 2026** Directive transposition deadline |

#### Tech stack line — REPLACE

**Current:**
> Random Forest + 6 other ML models · 16 Eurostat datasets

**Replace with:**
> FastAPI · React 19 · DuckDB · dbt · Eurostat LFS/JVS/SES · SHA-256 governance chain · Evidence-bounded AI Analyst

---

### Slide 8 — Shared Infrastructure & Research

#### REPLACE research paragraph

**Current:**
> 20-country … r ≈ +0.41 … SSRN peer-reviewed …

**Replace with:**
> *“Why Tight Labour Markets Do Not Close Gender Pay Gaps…”* — **MPRA 129330** (2026). **27-country** Eurostat panel (2019–2024, 11 NACE sectors): employment and gender pay gaps correlate **r ≈ +0.44**, contradicting competitive-equalisation theory. Introduces **Combined Risk Quadrant (HPI × ERS)**, implemented live at **workforceguardai.souravamseekar.com/app/research**.

#### REMOVE from this slide if duplicated

- “peer-reviewed” → **“working paper”**

---

### Slide 9 — Why NVIDIA Inception (optional WG mention)

**Current:** “WorkforceGuard's Eurostat corpus grows”

**OK to keep** — but do not reintroduce ML accuracy stats on this slide.

---

### Deck-wide consistency checks

After edits, every WorkforceGuard mention should align on:

| Topic | Canonical value |
|-------|-----------------|
| Countries | **27** (platform + research panel) |
| Eurostat datasets | **16** |
| Sectors | **13** (product) / **11** (research panel) |
| Correlation | **r ≈ +0.44** |
| Finance GPG | **~25%** |
| All-sector GPG mean | **~10.9%** |
| Indices | **HPI, LR, ERS, TR** |
| Governance | **SHA-256 hash chain** |
| Directive transposition | **7 June 2026** |
| First reporting | **June 2027** (250+) |
| Publication | **MPRA 129330** (working paper) |
| Live URL | **workforceguardai.souravamseekar.com** |

---

## Wording to avoid

| Avoid | Use instead |
|-------|-------------|
| “Peer-reviewed paper” (for MPRA/SSRN preprint) | “Published working paper (MPRA 129330)” |
| “28-model dbt pipeline” (stale count) | “Multi-layer dbt pipeline” or “31 dbt models” |
| “20 EU member states” (stale) | “27 EU member states” (+ footnote on paper title if unchanged) |
| “May 2026” as Directive deadline | **7 June 2026** transposition |
| ML accuracy / 912K / 94.7% for WorkforceGuard | Remove unless you attach a reproducible WG notebook path |
| “AI-written” without caveat | “Evidence-bounded analyst” / template + retrieval (honest product description) |

---

## Optional additions (recommended for pitch deck)

1. **Screenshot callout:** `/app/research` — live paper figures (scatter, quadrant, heatmap).
2. **Compliance thresholds:** 5% observed gap · 10% unresolved review · 2% market delta.
3. **Customer/problem line:** “Directive 2023/970 — most member states still transposing; employers need self-serve interpretation.”
4. **Differentiation:** Same warehouse for research + compliance — no separate “research copy” of data.

---

## What NOT to change in this pass

- Portfolio website (`martisouravamseekar-portfolio`) — separate task; use same canonical block when ready.
- WorkforceGuard landing page / `landingFacts.ts` — already synced in codebase (2026-07-08).
- Paper PDF/LaTeX title — author decision; CV can footnote 27-country replication.

---

## Verification checklist (for Claude after edits)

- [ ] No ML accuracy / 912K / 94.7% / 99.5% recall on WorkforceGuard bullets
- [ ] Correlation is **+0.44** (not +0.41) for WG/research claims
- [ ] Countries **27** (not 20) in body text; paper title footnoted if still “20-Country”
- [ ] Directive **7 June 2026** (not May 2026)
- [ ] MPRA 129330 linked; “working paper” not “peer-reviewed”
- [ ] SHA-256 governance mentioned on WG slide
- [ ] Finance GPG **~25%** and all-sector **~10.9%** appear at least once
- [ ] Live URL `workforceguardai.souravamseekar.com` on WG slide
- [ ] CV .docx and .pdf match; pitch deck exported as PDF

---

*End of handoff. Questions on code/product truth → see `docs/METRICS_CANONICAL.md` and `docs/CROSS_ASSET_AUDIT_AND_PLAN.md`.*
