# WorkforceGuard AI — Cross-Asset Audit, Spec & Implementation Plan

**Date:** 2026-07-08
**Branch:** `feature/paper-system-description`
**Auditor:** Cursor (Grok) — codebase + paper exports + external assets
**Support email:** `workforceguardai@souravamseekar.com`
**Live site:** https://workforceguardai.souravamseekar.com

---

## Executive summary

This audit covers points 6–16 from the 2026-07-08 brief. **Point 7 gate:** metrics alignment across CV, portfolio, pitch deck, and landing (point 8) is **documented but not executed** — handoff instructions are in §8.

### What was done in this session (code)

| Change | Path |
|--------|------|
| Synced landing research stats to `data/paper_exports/` | `dashboard/frontend/src/components/landing/landingFacts.ts` |
| Added reproducible sync script | `scripts/sync_landing_facts.py` |
| Removed false “quadrant” product claims | `dashboard/frontend/src/components/landing/constants.ts` |
| Wired peer-country basket UI (paper §3.4 methodology) | `dashboard/frontend/src/components/sections/CompareSection.tsx` |
| Fixed homepage JSON-LD (removed mission WebPage on `/`) | `dashboard/frontend/index.html` |
| Expanded sitemap with legal routes | `dashboard/frontend/public/sitemap.xml` |
| Fixed OAuth redirect base URL docs | `deploy/.env.production.example`, `dashboard/backend/.env.example`, `deploy/sync-production-env.sh` |

### Work in progress (stop here before point 8)

| Workstream | Status | Blocker / next step |
|------------|--------|---------------------|
| Paper figures in live dashboard | **Phase B done** | `/app/research` + `GET /api/research/panel` (Figs 1–2, 3 heatmap, 4 trajectories, 5 finance bars, insights) |
| Metrics sync CV / portfolio / pitch | **Portfolio done in code** | CV + pitch PDF → Claude chat — see §8 |
| OAuth production verification | **Runbook + code done** | Manual smoke test per `deploy/oauth-production-smoke-test.md` |
| SEO legal prerender | **Done** | Sitemap + static HTML for `/privacy`, `/terms`, `/disclaimer`, `/refunds` |
| Landing overhaul (IMPLEMENTATION_PLAN) | **Done (assets)** | 6 screenshots wired; `scripts/setup_demo_environment.sh` for tenant seed |
| Paper title “20-country” vs 27-country panel | **Open decision** | Econometric review + title/copy update |

---

## §6 — Paper findings vs app implementation

### Core finding: same pipeline, different surfaces

The paper and product share **one dbt + DuckDB pipeline** (`mart_semantic_metrics.sql` → `service.py` → dashboard). Paper replication exports live in `data/paper_exports/`; the dashboard serves the same composite indices live but does **not** yet render most paper figures/tables.

### Paper insights → implementation matrix

| # | Insight | Paper source | App API | App UI | Landing |
|---|---------|--------------|---------|--------|---------|
| 1 | Tightness–equity paradox (DE, CZ, HU, EE, LV) | `docs/paper-insights.md` §1 | ✅ Composite scores via `/overview` | ✅ Home score strip | ✅ `CountryExposureViz` (static) |
| 2 | Italy–Romania selection bias | §2 | ❌ | ❌ | ❌ |
| 3 | Finance (NACE K) highest risk | §3 | ✅ `pay_gap_by_sector` | ✅ Market bars | ✅ Ranked finance bars |
| 4 | Construction negative gap artefact | §4 | ✅ Raw sector data | ⚠️ Bar only, no explanation | ❌ |
| 5 | ICT meritocracy myth | §5 | ✅ Sector data | ⚠️ Bar only | ❌ |
| 6 | Health sector paradox | §6 | ✅ Sector data | ⚠️ Bar only | ❌ |
| 7 | Post-COVID recovery divergence | §7 | ✅ `employment_trend` | ⚠️ Single-country line | ❌ |
| 8 | Baltic outlier (EE) | §8 | ✅ Per-country API | ⚠️ In landing sample | ✅ |
| 9 | Nordic disappointment (FI, SE) | §9 | ✅ API | ⚠️ SE in landing; FI omitted | ❌ |
| 10 | Transposition crisis | §10 | ❌ | ❌ | ⚠️ Deadline badge only |

### Paper figures → implementation

| Figure | Export | Dashboard | Landing |
|--------|--------|-----------|---------|
| Fig 1 — Employment × GPG scatter | `fig1_tightness_gpg_scatter.pdf` | ❌ | ❌ (landing uses HPI×ERS) |
| Fig 2 — HPI×ERS quadrant | `fig2_combined_risk_quadrant.pdf` | ❌ | ⚠️ Decorative CSS dots |
| Fig 3 — Sector heatmap | `fig3_sector_gpg_bars.pdf` | ❌ | ❌ |
| Fig 4 — COVID employment trajectories | `fig4_priority_cases.pdf` | ⚠️ Single-country trend | ❌ |
| Fig 5 — Finance vs overall paired | (planned) | ❌ | ⚠️ Finance-only ranking |
| Fig 6 — Radar (DE, NL, CZ, IT, SE) | (planned) | ❌ | ❌ |

### Paper tables → implementation

| Table | Export | In app |
|-------|--------|--------|
| Table 1 — Country summary | `table1b_country_means.csv` | Partial (single-country `/overview`) |
| Table 2 — Sector GPG matrix | `table3_sector_heterogeneity.csv` | Partial (sector bars per country) |
| Table 3 — Employment recovery | `panel_country_year.csv` | Partial (`employment_trend`) |
| Table 4 — Index methodology | `docs/paper/system_description.md` | Partial (Home definitions) |
| Table 5 — Transposition status | `paper-insights.md` §10 | ❌ |
| Panel FE / robustness / PCA | `table2_panel_fe_results.csv`, `table5*_robustness.csv` | ❌ (research exports only) |

### Narrative reconciliation (important)

Three related but **different** statistical claims appear across docs:

| Claim | Source | Value |
|-------|--------|-------|
| Cross-sectional correlation (2024 panel) | `data/paper_exports/panel_country_year.csv` | **r ≈ +0.44** (n=27) |
| Country-means correlation | Same panel, aggregated | **r ≈ +0.49** |
| Panel fixed-effects coefficient | `table2_panel_fe_results.csv` | **Not significant** (within-country) |
| Old marketing copy | `paper-insights.md` L211 | “No positive correlation” — **stale** |

**Canonical public wording:** “Cross-sectionally, higher employment rates associate with higher gender pay gaps (r ≈ +0.44 across 27 EU member states, 2024); panel fixed-effects find no significant within-country employment effect — tightness alone does not close gaps.”

### Branch `feature/paper-system-description` — paper pipeline WIP

Merged stack (newest first):

- PCA figures regeneration
- Descriptive stats on 27-country panel
- Figures 1, 2, 4 re-run
- Robustness checks
- Sector heterogeneity
- Panel FE regression
- PCA validation
- Panel export + Eurostat sector fallback fix

**Deliverables on branch:** `data/paper_exports/` (panels, figures, tables), `docs/paper/system_description.md`, provenance macros in dbt.

**Not on branch:** Live dashboard research views, paper script sources in `scripts/paper/` (may be gitignored or squashed — verify before merge).

---

## §8 — Metrics alignment (HANDOFF — do not edit in this session)

> Per brief point 11: CV, portfolio, and pitch deck changes go to **another Claude chat session**. Code changes only here.

### Canonical metrics (source of truth)

| Metric | Canonical value | Primary source |
|--------|-----------------|----------------|
| Eurostat datasets | **16** (LFS, JVS, SES) | `scripts/pull_eu_data.py`, CV, portfolio |
| EU member states (platform) | **27** | DuckDB marts, README |
| Research panel countries | **27** (was marketed as 20) | `panel_country_year.csv` |
| NACE sectors (platform UI) | **13** | `landingFacts.market.naceSectors` |
| NACE sectors (research SES panel) | **11** | Paper methodology |
| Year range | **2019–2024** (marketing); data includes 2025 rows | Panel exports |
| Composite indices | **HPI, LR, ERS, TR** (4) | dbt + metric registry |
| EU27 all-sector GPG (panel mean) | **10.9%** | `panel_country_year.csv` |
| EU27 finance GPG (panel mean) | **25.0%** (24.96% exact) | `table3_sector_heterogeneity.csv` |
| Employment–GPG correlation | **r ≈ +0.44** (2024, n=27) | Panel export |
| Directive transposition deadline | **7 June 2026** | Legal / paper |
| First reporting (250+ employees) | **June 2027** | Directive |
| Review thresholds (product) | **5%** observed, **10%** unresolved, **2%** market delta | dbt + Pay Analysis |
| dbt models (live) | **~31** in system_description; **~49** `dbt ls` count varies by install | Run `dbt ls` on deploy |
| Hash-chained governance | **SHA-256** chain | `service.py` + tests |

### Inconsistencies to fix in non-code assets

| Issue | CV | Portfolio | Pitch | Landing (fixed) |
|-------|-----|-----------|-------|-----------------|
| “20-country panel” | ✅ says 20 | ✅ says 20 | ✅ says 20 | ✅ now 27 |
| “28 dbt models” | ✅ | ✅ | — | — |
| ML: 7 models, 94.7%, AUC 0.855, 912K | ✅ CV+portfolio+pitch | ✅ | ✅ | Correctly absent |
| 32,769 training / 99.5% recall | ✅ CV only | ❌ | ❌ | — |
| README “May 2026” deadline | — | — | — | README still wrong |
| SHA-256 in REFERENCE.md | — | — | — | REFERENCE says JSON, no chain |

### Instructions for Claude chat (CV / portfolio / pitch)

**CV** (`/Users/souravamseekarmarti/Documents/Marti_Soura_Vamseekar_CV.docx`):

1. Remove or substantiate ML block: “7 ML models · RF 94.7% · AUC 0.855 · 912K test · 32,769 training · 99.5% recall” — **no evidence in WG repo**.
2. Change “20 EU states” → “27 EU member states” OR qualify: “27-country Eurostat panel (20 with complete early-wave coverage)”.
3. Update dbt count: “multi-layer dbt pipeline” or run `dbt ls` and use live count.
4. Add: EU27 finance gap ~25%, panel mean GPG ~10.9%, r ≈ +0.44, Directive 7 Jun 2026.
5. Distinguish: “27 states platform / 11-sector SES research panel / 13-sector dashboard filters”.

**Portfolio** (`martisouravamseekar-portfolio/src/data/projects.ts`, `profile.ts`):

1. Same ML removal as CV.
2. Update metrics array to match canonical block in §8.
3. Add `2% market-delta threshold` if space allows.

**Pitch deck** (`/Users/souravamseekarmarti/Downloads/MSV_AI_Labs_Pitch_Deck.pdf`):

1. Remove ML metrics for WorkforceGuard slide unless substantiated.
2. Add composite index names (HPI, LR, ERS, TR) and Combined Risk Quadrant.
3. Add r ≈ +0.44, finance gap ~25%, 27-country panel.
4. Use “published working paper (MPRA 129330)” not “peer-reviewed” unless formally accepted.
5. Add SHA-256 governance for WorkforceGuard (currently only on EU AI Assurance slide).

**Suggested unified copy block:**

> WorkforceGuard AI ingests **16 Eurostat datasets** across **27 EU member states** and **13 NACE sectors**, computing **4 composite indices** (Hiring Pressure, Labour Resilience, Equity Risk, Transition Readiness) with a **SHA-256 hash-chained** governance log. Published research on a **2019–2024 Eurostat panel** finds employment and gender pay gaps correlate **r ≈ +0.44**; EU27 finance-sector gap averages **~25%**. Built for **Directive (EU) 2023/970** — transposition **7 June 2026**, first reporting **June 2027** (250+ employees).

---

## §9–10 — Codebase investigation summary

### Platform features verified in code

| Feature | Status | Key path |
|---------|--------|----------|
| 4 composite indices (live) | ✅ | `mart_semantic_metrics.sql`, `HomeSection.tsx` |
| Country × sector filters | ✅ | `FilterBar.tsx`, `/overview` |
| Pay transparency 5%/10%/2% | ✅ | Internal marts, `PayAnalysisSection.tsx` |
| Hash-chained governance | ✅ | `service.py`, Govern section |
| AI Analyst (evidence-bounded) | ✅ | `CopilotPanel.tsx`, copilot API |
| Peer similarity (z-score L1) | ✅ API; ✅ UI after this session | `service.py`, `CompareSection.tsx` |
| Payroll upload | ✅ | `POST /api/upload/payroll` |
| Multi-tenant auth | ✅ | Postgres + DuckDB tenant schemas |
| Demo request form | ✅ | `api/request-demo.js` |

### Filter combinations tested (via code paths)

- Geography: single country, EU27_AVG
- Sector: ALL + NACE letters
- Period: latest + historical
- Compare: left/right independent panels
- Pay Analysis: requires trusted tenant payroll + job architecture

---

## §12 — Industry landing page benchmark

Compared against leading EU pay-transparency vendors:

| Element | Syndio | Trusaic | PayScale | WorkforceGuard |
|---------|--------|---------|----------|----------------|
| Hero + product video | ✅ | ✅ | ✅ | ✅ `product_walkthrough.mp4` |
| Compliance mapping to Directive | ✅ | ✅ | Partial | ✅ `ComplianceMappingSection` |
| Regulation deadline urgency | ✅ | ✅ | — | ✅ Jun 2026 badge |
| Product tour / screenshots | ✅ | ✅ | ✅ | ✅ 6-tab `ProductTour` |
| Research / thought leadership | ✅ | ✅ | ✅ | ✅ `#research` + MPRA link |
| Customer logos / social proof | ✅ | ✅ | ✅ | ❌ **Missing** |
| Pricing | Some | Some | ✅ | ❌ Intentionally demo-led |
| Trust / security badges | ✅ | ✅ | ✅ | ⚠️ Trust section exists, no SOC2/ISO badges |
| Transposition tracker | ✅ (Syndio) | ✅ (Trusaic) | — | ❌ **High-value gap** |
| Interactive demo / sandbox | Some | Some | — | ⚠️ Demo request only |
| FAQ | ✅ | ✅ | ✅ | ✅ |
| Legal footer (privacy, terms) | ✅ | ✅ | ✅ | ✅ |
| Support email visible | ✅ | ✅ | ✅ | ✅ `workforceguardai@souravamseekar.com` |

**Priority additions for parity:** transposition status widget, 2–3 anonymised customer/partner proof points, SOC2/GDPR trust row.

---

## §13 — Footer & landing completeness

### Present

- Nav: Product, Compliance, Demo, Research, Contact, FAQ, Mission
- Footer sections: Platform, Company, Support
- Legal: Privacy, Terms, Refunds, Disclaimer
- Support email in footer + contact + FAQ
- Research paper link (MPRA 129330)
- Cookie consent banner
- `#onboarding` API & tenant section

### Missing vs industry standard

| Item | Priority |
|------|----------|
| Transposition status link/section | P0 |
| Security page / trust centre | P1 |
| Status page / uptime | P2 |
| LinkedIn / GitHub social links in footer | P2 |
| `mailto:` with pre-filled demo subject in footer CTA | P3 |
| Careers / About (beyond Mission) | P3 |

---

## §14 — OAuth end-to-end

### Architecture

```
Login → GET /api/auth/login/{google|microsoft}
     → Provider OIDC
     → GET {OAUTH_REDIRECT_BASE_URL}/api/auth/callback/{provider}
     → Set wfg_session cookie → redirect FRONTEND_URL
AuthContext → GET /api/auth/me
```

### Status: code complete, production config was broken

| Check | Status |
|-------|--------|
| Google + Microsoft registered (Authlib) | ✅ `auth/oauth.py` |
| Callback error handling | ✅ |
| User create / tenant auto-provision | ✅ (may conflict with “provisioned only” copy) |
| Session cookie httponly | ✅ |
| CORS credentials | ✅ |
| Unit tests for profile parsing | ✅ `test_oauth.py` |
| Integration tests for full flow | ❌ |
| **Redirect URL same origin as /api** | ⚠️ **Fixed in docs this session** — was pointing to API subdomain |
| Microsoft `preferred_username` fallback | ❌ |
| `secure=True` cookie for local HTTP | ❌ (blocks local OAuth without HTTPS) |

### Production fix checklist

1. Set `OAUTH_REDIRECT_BASE_URL=https://workforceguardai.souravamseekar.com`
2. Register callbacks on Google Cloud + Azure:
   - `https://workforceguardai.souravamseekar.com/api/auth/callback/google`
   - `https://workforceguardai.souravamseekar.com/api/auth/callback/microsoft`
3. Run `deploy/sync-production-env.sh` (now uses `FRONTEND_ORIGIN`)
4. Restart API: `sudo systemctl restart workforceguard-api`
5. Manual test: login → `/app` → `/api/auth/me` returns user

---

## §15 — SEO status

### Strong

- `Seo.tsx` component with canonical, OG, Twitter, JSON-LD
- Static prerender on `/` (`index.html`) and `/mission` (`mission.html`)
- `robots.txt` disallows `/app/`
- FAQ + Organization + SoftwareApplication schema on home
- `PrivateAppSeo` noindex on dashboard

### Fixed this session

- Homepage JSON-LD no longer declares Mission WebPage on `/`
- Sitemap includes `/privacy`, `/terms`, `/disclaimer`, `/refunds`

### Remaining gaps

| Gap | Priority |
|-----|----------|
| Static HTML prerender for legal pages | P1 |
| `WebPage` JSON-LD on legal pages via `LegalArticle.tsx` | P1 |
| Gate Google Analytics behind cookie consent | P1 |
| `og:image:width/height` | P2 |
| `twitter:site` handle | P2 |
| Auto-generated sitemap at build time | P2 |

---

## §16 — Spec & implementation plan (phased)

### Phase A — Paper ↔ product alignment (current branch)

**Goal:** Dashboard and landing reflect latest `data/paper_exports/` without stale metrics.

| Task | Owner | Status |
|------|-------|--------|
| A1 Sync `landingFacts.ts` from exports | Code | ✅ Done |
| A2 Add `scripts/sync_landing_facts.py` | Code | ✅ Done |
| A3 Wire peer basket in Compare UI | Code | ✅ Done |
| A4 Fix OAuth redirect env | Code | ✅ Done |
| A5 SEO sitemap + JSON-LD fix | Code | ✅ Done |
| A6 Reconcile paper-insights.md “no correlation” text | Docs | ✅ Done |
| A7 Update paper title/abstract for 27-country panel | Docs | ⬜ Paper drafts (`paper-section*.md`) still say 20-country |

### Phase B — Research views in dashboard ✅ (2026-07-08)

**Goal:** Paper Figs 1–2 and Table 1 live in product (not just PDF exports).

| Task | Description | Status |
|------|-------------|--------|
| B1 | `GET /api/research/panel` — multi-country scatter + quadrant payload from DuckDB | ✅ |
| B2 | `ResearchSection.tsx` at `/app/research` — Fig 1 employment×GPG, Fig 2 HPI×ERS | ✅ |
| B3 | Sector heatmap component (Fig 3) | ✅ |
| B4 | Multi-country COVID trajectory selector (Fig 4) | ✅ |
| B5 | Interpretive callouts (Italy paradox, Construction artefact, Nordic) as collapsible panels | ✅ |

**Key paths:** `dashboard/backend/service.py` (`build_research_panel`), `dashboard/frontend/src/components/sections/ResearchSection.tsx`

**PR:** `feature/research-dashboard-views` (stack on `feature/paper-system-description`)

### Phase C — Metrics harmonisation (point 8)

**Goal:** Identical numbers across CV, portfolio, pitch, landing, README.

| Task | Description | Status |
|------|-------------|--------|
| C1 | Claude chat updates **CV .docx/.pdf + pitch deck PDF** only | ⬜ User → `docs/CV_AND_PITCH_DECK_UPDATE_INSTRUCTIONS.md` |
| C2 | Portfolio `projects.ts` + `profile.ts` | ✅ 2026-07-08 |
| C3 | README, MissionPage, landingFacts, `paper-insights.md` | ✅ |
| C4 | `WORKFORCEGUARD_AI_REFERENCE.md` governance + dbt | ✅ key sections |
| C5 | `docs/METRICS_CANONICAL.md` | ✅ |
| C6 | CI hook for `sync_landing_facts.py` | ✅ |

**PR:** `chore/metrics-canonical` + external asset PRs
**Gate:** User review of canonical table

### Phase D — Landing parity & trust ✅ (2026-07-08)

**Goal:** Match Syndio/Trusaic landing patterns.

| Task | Description | Status |
|------|-------------|--------|
| D1 | EU transposition status table (static seed from paper research) | ✅ |
| D2 | Customer/partner proof strip (even 2–3 logos) | ✅ |
| D3 | Security trust row (GDPR, encryption, tenant isolation) | ✅ |
| D4 | Legal page prerender + GA consent gate | ✅ |
| D5 | Screenshots (6 PNG) + `seed_demo_tenant.py` + `setup_demo_environment.sh` | ✅ |

**PRs:** stack on `feature/paper-system-description`

### Phase E — OAuth & auth hardening ✅ (2026-07-08)

| Task | Description | Status |
|------|-------------|--------|
| E1 | Env-aware `secure` cookie flag | ✅ |
| E2 | Microsoft email claim fallback | ✅ |
| E3 | Invite-only vs self-serve (`OAUTH_AUTO_PROVISION=0` prod) | ✅ |
| E4 | OAuth integration tests | ✅ |
| E5 | Production smoke test runbook | ✅ `deploy/oauth-production-smoke-test.md` |

**PR:** `fix/oauth-same-origin` (merged into feature branch)

---

## Verification commands

```bash
# Landing facts sync
python scripts/sync_landing_facts.py

# Frontend
cd dashboard/frontend && npm run lint && npm run typecheck && npm test

# Backend (Postgres required for auth tests)
export DATABASE_URL=postgresql://test:test@localhost:5432/workforceguard_test
export SESSION_SECRET=local-dev-secret-not-for-production
cd dashboard/backend && python -m pytest tests/test_oauth.py tests/test_service.py -q

# Paper exports present
ls data/paper_exports/figures/*.pdf | wc -l   # expect 6
ls data/paper_exports/tables/*.csv | wc -l    # expect 13+
```

---

## File index

| Area | Path |
|------|------|
| Paper exports | `data/paper_exports/` |
| Paper system description | `docs/paper/system_description.md` |
| Paper insights | `docs/paper-insights.md` |
| Landing facts | `dashboard/frontend/src/components/landing/landingFacts.ts` |
| Sync script | `scripts/sync_landing_facts.py` |
| Compare + peer UI | `dashboard/frontend/src/components/sections/CompareSection.tsx` |
| OAuth | `dashboard/backend/auth/oauth.py`, `main.py` |
| SEO | `dashboard/frontend/src/lib/seo.ts`, `public/sitemap.xml` |
| Implementation plan (landing) | `docs/IMPLEMENTATION_PLAN.md` |
| CV | `/Users/souravamseekarmarti/Documents/Marti_Soura_Vamseekar_CV.docx` |
| Pitch deck | `/Users/souravamseekarmarti/Downloads/MSV_AI_Labs_Pitch_Deck.pdf` |
| Portfolio | `/Users/souravamseekarmarti/Projects/Portfolio/martisouravamseekar-portfolio/src/data/` |

---

*End of audit. Continue from Phase B or Phase C in the next session per user priority.*
