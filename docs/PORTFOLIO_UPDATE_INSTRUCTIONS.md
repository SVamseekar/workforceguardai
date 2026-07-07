# Portfolio Website Update Instructions — WorkforceGuard AI

**Date:** 2026-07-08
**Purpose:** Handoff reference — **applied in code 2026-07-08** (`projects.ts`, `profile.ts`). Re-open if metrics change after paper re-export.
**Canonical numbers:** `docs/METRICS_CANONICAL.md` (in WorkforceGuard-AI repo)

---

## Portfolio location

| Item | Path / URL |
|------|------------|
| **Live site** | https://souravamseekar.com |
| **Local repo** | `/Users/souravamseekarmarti/Projects/Portfolio/martisouravamseekar-portfolio/` |
| **WorkforceGuard product** | https://workforceguardai.souravamseekar.com |

This is a **separate Next.js repo** from WorkforceGuard-AI. Changes are in `src/data/*.ts` (and any components that hardcode research text).

---

## Files to edit

| File | What it controls |
|------|------------------|
| `src/data/projects.ts` | WorkforceGuard project card — metrics[], tagline, stack |
| `src/data/profile.ts` | Research section — title, summary, methodology, publications |
| `src/lib/seo.ts` | Site meta description (WG mention only — usually fine) |
| `src/components/Hero.tsx` | Hero blurb (WG name only — usually fine) |

After edits: `npm run build` in portfolio repo, deploy via Vercel.

---

## Canonical copy block (WorkforceGuard)

Use for `projects.ts` metrics and `profile.ts` research summary:

> **16 Eurostat datasets** (LFS, JVS, SES) · **27 EU member states** · **13 NACE sectors** (live dashboard) / **11-sector SES research panel** · **dbt + DuckDB** · **4 composite indices** (HPI, LR, ERS, TR) · **SHA-256 hash-chained** governance · Research panel **r ≈ +0.44** employment–GPG correlation · Finance gap **~25%** vs all-sector **~10.9%** · Directive transposition **7 June 2026** · Live research views at **workforceguardai.souravamseekar.com/app/research**

---

## 1. `src/data/projects.ts` — WorkforceGuard entry

### REMOVE this metrics line entirely

```ts
"7 ML models · Random Forest 94.7% accuracy · AUC 0.855 on 912K-record test set",
```

*No evidence in WorkforceGuard repo. Do not move to another bullet unless substantiated.*

### REPLACE metrics array

**Current:**
```ts
metrics: [
  "16 Eurostat datasets (LFS, JVS, SES) across EU27 and 11 NACE sectors",
  "28-model dbt pipeline computing HPI, LR, ERS, TR composite indices",
  "SHA-256 hash-chained audit log for compliance evidence packs",
  "7 ML models · Random Forest 94.7% accuracy · AUC 0.855 on 912K-record test set",
  "Published research: r = +0.41 tightness–pay-gap correlation across 20 EU states",
],
```

**Replace with:**
```ts
metrics: [
  "16 Eurostat datasets (LFS, JVS, SES) across 27 EU member states; 13 NACE sectors in live dashboard (11-sector SES research panel)",
  "Multi-layer dbt + DuckDB pipeline: HPI, LR, ERS, TR composite indices with formula versioning",
  "SHA-256 hash-chained governance log and Directive 2023/970 review thresholds (5% / 10% / 2% market delta)",
  "Published research: r ≈ +0.44 employment–GPG correlation (27-country panel); EU27 finance gap ~25%",
  "Live paper figures in /app/research — same warehouse as compliance workflows",
],
```

### Optional tagline tweak

**Current:** `EU pay transparency and workforce intelligence platform — dbt + DuckDB + FastAPI + React 19.`

**Optional:** add “published MPRA working paper” if space:
`EU pay transparency & workforce intelligence — dbt + DuckDB + FastAPI + React 19 · MPRA 129330`

`liveUrl`, `githubUrl`, `stack`, `period` — **keep as-is**.

---

## 2. `src/data/profile.ts` — `research` object

### Title

**Current:**
`Evidence from a 20-Country Eurostat Panel`

**Option A (footnote in summary):** keep title, fix summary/countries.
**Option B:** change to `27-Country Eurostat Panel`.

### REPLACE `summary`

**Current:**
```ts
"Panel data econometrics and ML across a 20-country Eurostat dataset (2019–2024, 11 NACE sectors). Labour market tightness correlates positively with gender pay gaps (r = +0.41), contradicting competitive equalisation theory. Four composite panel indices (HPI, LR, ERS, TR) via PCA-informed weighting. Implemented in WorkforceGuard with SHA-256 hash-chained governance log.",
```

**Replace with:**
```ts
"Panel econometrics on a 27-country Eurostat dataset (2019–2024, 11 NACE sectors). Employment rate and gender pay gap correlate positively (r ≈ +0.44), contradicting competitive equalisation theory. Four composite indices (HPI, LR, ERS, TR) and Combined Risk Quadrant (HPI × ERS). Implemented in WorkforceGuard AI with SHA-256 hash-chained governance; live figures at workforceguardai.souravamseekar.com/app/research.",
```

### `venue`

**Current:** `"May 2026"`
**Replace with:** `"MPRA 129330 · 2026"` or keep May 2026 as publication month — do **not** use as Directive deadline.

### `methodology` — keep structure, optional detail add

```ts
methodology: {
  name: "Combined Risk Quadrant",
  detail: "HPI × ERS — integrated tightness-equity typology; finance-sector gap ~25% vs ~10.9% all-sector panel mean.",
},
```

### `publications` — keep links; ensure MPRA is primary

Order suggestion: MPRA first, then SSRN, Zenodo, ORCID.

---

## 3. What is already correct on portfolio

- `liveUrl`: https://workforceguardai.souravamseekar.com ✅
- EU27 mention in first metrics line (but conflated with 11 sectors only — needs clarification) ⚠️
- SHA-256 governance ✅
- HPI, LR, ERS, TR named ✅
- Stack (React 19, dbt, DuckDB, etc.) ✅

---

## 4. Cross-asset alignment checklist

After portfolio deploy, these should match CV, pitch deck, and WorkforceGuard landing:

| Metric | Canonical |
|--------|-----------|
| Countries | **27** |
| Correlation | **r ≈ +0.44** |
| Finance GPG | **~25%** |
| All-sector GPG | **~10.9%** |
| Sectors | **13** product / **11** research |
| dbt | Multi-layer (not “28-model”) |
| ML 94.7% / 912K | **Removed** |
| Directive | **7 Jun 2026** transposition |
| Paper | **MPRA 129330** working paper |

---

## 5. Verification

```bash
cd /Users/souravamseekarmarti/Projects/Portfolio/martisouravamseekar-portfolio
npm run lint && npm run build
```

- [ ] Project card shows no ML accuracy line
- [ ] Research summary says 27 countries and r ≈ +0.44
- [ ] No “28-model” unless re-counted
- [ ] MPRA link works on Research section
- [ ] Live WG link opens workforceguardai.souravamseekar.com

---

## Related docs (WorkforceGuard-AI repo)

- `docs/CV_AND_PITCH_DECK_UPDATE_INSTRUCTIONS.md` — same metrics, CV + deck
- `docs/METRICS_CANONICAL.md` — single source of truth
- `docs/CROSS_ASSET_AUDIT_AND_PLAN.md` — full phased plan

---

*Portfolio is the 4th asset in the metrics-alignment set: CV · Pitch deck · Portfolio · WorkforceGuard landing (landing already synced in code).*
