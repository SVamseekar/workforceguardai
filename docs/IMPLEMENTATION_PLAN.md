# WorkforceGuard AI — Landing, Demo Assets, Repo Cleanup & Synthetic Data

**Status:** Spec / plan (implementation in follow-up session)
**Date:** 2026-07-01
**Support email:** `workforceguardai@souravamseekar.com`

This document is the single source of truth for the next implementation pass. It covers four workstreams:

1. Landing page overhaul (MaSoVa-grade structure)
2. Demo screenshots and videos (captured from a running system)
3. Repository hygiene (industry-standard layout, no AI artifacts)
4. Production-grade synthetic data for upload & pay-analysis demos

---

## Executive summary

| Workstream | Current state | Target state |
|------------|---------------|--------------|
| **Landing** | Strong compliance copy; one hero video; text-only feature cards; modal-only demo form; no support email | Modular sections, tabbed product tour with screenshots, inline contact, workflow narrative, support email everywhere |
| **Demo assets** | `product_walkthrough.mp4` only; README GIFs not on landing | Six section PNGs + hero poster + optional AI-analyst clip |
| **Repo** | `projects/` portfolio committed; tracked DuckDB + `profiles.yml` | Clean monorepo; no dev-tooling artifacts; untrack generated files |
| **Synthetic data** | `generate_demo_company.py` → AeroTech FR only; tenants often lack `job_architecture`; DuckDB tenant schemas empty | Multi-scenario demo tenants (FR + CZ), full parquet + manifest + dbt rebuild, upload-ready CSVs |

**Branch convention:** `feature/landing-demo-overhaul` (or split into stacked PRs below).

---

## Workstream A — Landing page overhaul

### Reference

MaSoVa pattern: `MaSoVa-restaurant-management-system/frontend/src/apps/ProductSite/`
WorkforceGuard target: `dashboard/frontend/src/components/landing/`

### Constants (`site.ts` expansion)

```ts
export const SUPPORT_EMAIL = 'workforceguardai@souravamseekar.com'
export const SITE_URL = 'https://workforceguardai.souravamseekar.com'

export const NAV_LINKS = [
  { kind: 'hash', hash: '#product-tour', label: 'Product' },
  { kind: 'hash', hash: '#compliance', label: 'Compliance' },
  { kind: 'hash', hash: '#demo', label: 'See it live' },
  { kind: 'hash', hash: '#research', label: 'Research' },
  { kind: 'hash', hash: '#contact', label: 'Contact' },
  { kind: 'hash', hash: '#faq', label: 'FAQ' },
  { kind: 'route', to: '/mission', label: 'Mission' },
]

export const OPEN_CONTACT_EVENT = 'workforceguard:open-contact'
```

Wire `DEMO_REQUEST_TO` and 503 fallback messages to `SUPPORT_EMAIL` in `dashboard/frontend/api/request-demo.js`.

### New components (create under `landing/components/`)

| Component | Purpose | MaSoVa source |
|-----------|---------|---------------|
| `SupportEmailLink.tsx` | Reusable `mailto:` | Same |
| `SectionLabel.tsx` | Eyebrow labels | Same |
| `ScreenshotPanel.tsx` | 4:3 frame + browser chrome + placeholder fallback | Same |
| `ProductTour.tsx` | Tabbed tour for 6 dashboard views | `ProductTour.tsx` |
| `MarqueeStrip.tsx` | Scrolling proof points (EU27, Directive, audit log) | Same |
| `ProblemSection.tsx` | Spreadsheets/siloed HRIS vs unified workspace | Same |
| `AnalystDemoTheater.tsx` | Animated AI Q&A with provenance | `AgentDemoTheater.tsx` |
| `ComplianceWorkflowStory.tsx` | Timeline: upload → flag → review → export | `AgentScrollStory.tsx` |
| `ContactSection.tsx` | Inline demo form at `#contact` | `ContactSection.tsx` |
| `GettingStartedSection.tsx` | Demo → provision → payroll setup | `DeveloperSection.tsx` |
| `utils/scrollToSection.ts` | Hash nav with 80px offset | Same |
| `hooks/useLandingScrollRestore.ts` | Deep-link scroll restore | Same |

### Refactor

Split `LandingPage.tsx` (~400 lines) into composition + `constants.ts` (or expanded `site.ts`). Keep unique sections: compliance mapping, personas, trust, research.

### Target section order

```
Hero (+ video + poster)
→ MarqueeStrip
→ ProblemSection
→ ProductTour (#product-tour)        ← 6 tabs + screenshots
→ Compliance mapping (#compliance)   ← keep existing
→ AnalystDemoTheater (#demo)
→ ComplianceWorkflowStory
→ Personas (existing)
→ Trust (existing)
→ Research (#research)
→ GettingStartedSection
→ ContactSection (#contact)          ← inline DemoRequestForm
→ FAQ (#faq)
→ Footer CTA
```

### Support email integration points

| Location | Change |
|----------|--------|
| `site.ts` | `SUPPORT_EMAIL` constant |
| `SupportEmailLink.tsx` | New component |
| `ContactSection` | “Reply within one business day at …” |
| `LandingShell` footer | Email under brand blurb |
| `DemoRequestModal` | “Prefer email? …” |
| FAQ | New item: “How do I reach support?” |
| `api/request-demo.js` | `DEMO_REQUEST_TO`, 503 message |
| `DataState.tsx` | Align dashboard error mailto to `SUPPORT_EMAIL` |

### Skip (for now)

- Public pricing tiers (enterprise demo-led GTM)
- Self-serve signup

---

## Workstream B — Demo screenshots & videos

### Prerequisites

1. Backend running with DuckDB + dbt `main` layer built
2. Demo tenant provisioned with synthetic data (Workstream D)
3. Auth session for admin user on demo tenant
4. Browser at 1440×900 (or 1200×900 @2x export)

### Recommended demo scenario for captures

| Setting | Value | Why |
|---------|-------|-----|
| Geography | **Czechia (CZ)** or **France (FR)** | CZ matches existing walkthrough aria-label; FR matches AeroTech demo company |
| Sector | **NACE K** (Financial & insurance) | Strong pay-gap story; aligns with video |
| Tenant | Dedicated `demo` tenant with full internal marts | Pay Analysis + Govern populated |

### Asset manifest

```
dashboard/frontend/public/
├── screenshots/
│   ├── command-centre.png      # /app — signals, brief, KPIs
│   ├── market-intelligence.png # /app/market — trend charts
│   ├── compare.png             # /app/compare — delta table + narrative
│   ├── pay-analysis.png        # /app/pay-analysis — gaps + review queue
│   ├── govern-export.png       # /app/govern — hash chain + export
│   └── ai-analyst.png          # Copilot open — Q&A + provenance
├── demos/
│   ├── product_walkthrough.mp4   # EXISTS — refresh if UI changed
│   └── ai-analyst-preview.mp4    # OPTIONAL 15–30s clip
```

| File | Size | Placement |
|------|------|-----------|
| All PNGs | 1440×900 | `ProductTour` tabs; `command-centre.png` as video `poster` |
| `product_walkthrough.mp4` | 1440×900, ~60s | Hero `ProductShowcase` |
| `ai-analyst-preview.mp4` | 1280×720+ | `#demo` theater (optional) |

### Capture procedure

```bash
# 1. Build data layer
cd analytics && dbt seed && dbt run

# 2. Seed demo tenant (see Workstream D)
python scripts/seed_demo_tenant.py --tenant-slug demo --scenario cz-financial

# 3. Start stack
cd dashboard/backend && uvicorn main:app --reload --port 8000
cd dashboard/frontend && npm run dev

# 4. Capture (Playwright script — add scripts/capture_landing_assets.mjs)
#    - Login as demo admin
#    - Navigate each route; wait for data-loaded state
#    - Screenshot to public/screenshots/
#    - Record walkthrough → public/demos/product_walkthrough.mp4
```

### `ScreenshotPanel` fallback

Until assets exist, show icon + “Gallery update in progress” (never broken `<img>`).

### Video production notes

- Muted, looped hero video (existing pattern)
- Walkthrough flow: Home → Market → Compare → Pay Analysis → Govern → AI Analyst
- Use synthetic tenant data so pay gaps and review items are visible
- No cursor thrashing; 3–5s per section in full walkthrough

### Landing wiring

- `ProductTour.tsx`: `PRODUCT_TOUR_TABS` in constants — each tab maps `screenshot`, `bullets`, `headline`
- `LandingPage.tsx` hero `<video poster="/screenshots/command-centre.png">`
- Consider using `docs/demos/*.gif` in README only; landing uses PNG + MP4 (smaller, sharper)

---

## Workstream C — Repository cleanup

### Delete from repo (high priority)

| Path | Action | Reason |
|------|--------|--------|
| `projects/` | `git rm -r` | Unrelated ML portfolio (~84 MB) |
| `analytics/profiles.yml` | Untrack; keep `.example` | Machine-specific paths |
| `data/workforceguard_analytics.duckdb` | Untrack | Generated; rebuild via dbt |
| `dashboard/frontend/public/vite.svg` | Delete if unused | Vite default |

### Delete locally / never commit

| Path | Reason |
|------|--------|
| `record_demo.mjs` (root) | Scratch; replace with `scripts/capture_landing_assets.mjs` |
| `image.png` (root) | Scratch |
| `node_modules/` (root) | Stray prettier cache |
| `.playwright-mcp/` | Tool logs |

### Extend `.gitignore`

```gitignore
record_demo.mjs
node_modules/
analytics/profiles.yml
**/*.duckdb
docs/paper-output.*
```

### Reorganize (optional, lower priority)

| From | To |
|------|-----|
| `docs/paper-*.md`, `docs/paper.tex`, `docs/figures/` | `docs/paper/` |
| `docs/SECURITY_AUDIT.md` | `docs/security/` (refresh for OAuth) |

### Dev-tooling hygiene

**Removed (files + full git history via `git filter-repo`):** `CLAUDE.md`, `.cursor/`, `WORKFORCEGUARD_AI_REFERENCE.md`, `docs/WORKFORCEGUARD_MASTER_REFERENCE_*`, superpowers/social-media drafts

**Untracked via `.gitignore`:** `docs/paper-*.md`, `docs/paper.tex`, `docs/figures/`, `docs/SECURITY_AUDIT.md`

**Keep (product features):** “AI Analyst”, `CopilotPanel`, copilot API

**Remote `main`:** branch protection blocks force-push — temporarily allow it in GitHub Rules, then:

```bash
git push --force --no-verify origin main
```

`chore/remove-dev-tooling-traces` is already on GitHub with the rewritten history.

### Industry-standard layout (target)

```
WorkforceGuard-AI/
├── analytics/          # dbt project
├── dashboard/
│   ├── backend/        # FastAPI
│   └── frontend/       # React/Vite
├── scripts/            # ETL, demo seed, asset capture
├── data/
│   ├── eu_raw/         # Eurostat parquet (committed)
│   ├── reference/      # ESCO (committed)
│   ├── internal_raw/   # Synthetic CSV templates (committed)
│   └── tenants/        # gitignored except .gitkeep
├── configs/
├── deploy/
├── docs/
│   ├── demos/          # README GIFs (consider Git LFS)
│   └── IMPLEMENTATION_PLAN.md
└── tests/
```

No `projects/`, no root scratch scripts, no tracked DuckDB.

### Git LFS (recommended)

Track `*.gif`, `*.mp4`, large `*.parquet` — `home.gif` / `market.gif` exceed 5 MB pre-commit hook.

---

## Workstream D — Synthetic demo data

### Architecture recap

```
PostgreSQL (auth only)
  tenants, users, memberships, sessions

DuckDB (data/workforceguard_analytics.duckdb)
  main          → EU Eurostat marts, public company benchmarks
  tenant_{id}   → per-tenant internal marts (dbt tag:internal)

data/tenants/{tenant_id}/
  internal/
    payroll_snapshot.parquet      ← upload API or prep script
    job_architecture.parquet      ← REQUIRED; no upload API today
    hris_*.parquet                  ← optional
  internal_meta/manifest.json     ← trust gate
  governance_events.sqlite
```

### Critical gating (`service.py`)

Company features require **all** of:

1. Shared `main` marts populated
2. Tenant schema with internal tables
3. `payroll_snapshot` + `job_architecture` record counts > 0
4. `mart_internal_market_pay_benchmark` has rows
5. Manifest: both assets `trusted_for_company_claims: true`

**Current gap:** Most tenants have payroll only; no `job_architecture.parquet`; tenant DuckDB schemas often empty after upload.

### Upload API contract (`POST /api/upload/payroll`)

| Column | Required | Notes |
|--------|----------|-------|
| `employee_id` | ✓ | |
| `job_code` | ✓ | Warn if missing from job_architecture |
| `country_code` | ✓ | ISO-2 |
| `worker_category_id` | ✓ | |
| `gender` | ✓ | `female`, `male`, `non_binary` |
| `base_salary` | ✓ | → `base_pay_amount` in parquet |
| `currency` | ✓ | → `pay_currency` |
| `snapshot_date` | ✓ | |
| `job_title` | opt | |
| `employment_status` | opt | default `active` |
| `version` | opt | default `uploaded-v1` |

**Gap:** No `/api/upload/job-architecture`. Demo must ship `job_architecture.parquet` via prep script or new endpoint.

### Pay transparency thresholds (dbt + API)

| Condition | `review_state` |
|-----------|----------------|
| \|internal gap\| ≥ 10% OR \|gap_to_market\| ≥ 2% | `unresolved_review_item` |
| \|internal gap\| ≥ 5% | `observed_gap` |
| else | `justified_difference` |

### Existing generator

`scripts/generate_demo_company.py` → **AeroTech Europe SAS**

- 350 employees, FR, EUR, snapshot `2025-12-31`
- 6 worker categories with intentional gaps (`eng_ic`: 50F / 130M)
- Output: `data/internal_raw/payroll_snapshot.csv`, `job_architecture.csv`

### Target: production-grade demo scenarios

#### Scenario 1 — `aerotech-fr` (existing, enhance)

| Field | Value |
|-------|-------|
| Company | AeroTech Europe SAS |
| Country | FR |
| Sector | J62 / K64 mix |
| Headcount | 350 |
| Story | Engineering gap triggers joint pay assessment; HR + finance categories flagged |

**Enhancements:**
- Add `hris_workforce_snapshot.csv` (hire dates, employment types)
- Add second snapshot date `2024-12-31` for trend (optional phase 2)
- Governance seed events (approve/override on `eng_ic`)

#### Scenario 2 — `meridian-cz` (new — for landing screenshots)

| Field | Value |
|-------|-------|
| Company | Meridian Financial Services s.r.o. |
| Country | CZ |
| Sector | NACE K (Financial & insurance) |
| Headcount | 180 |
| Story | Matches walkthrough geography; 2 categories above 5% threshold, 1 unresolved |

**Category design (illustrative):**

| `worker_category_id` | Label | F | M | F median | M median | Expected gap |
|----------------------|-------|---|---|----------|----------|--------------|
| `risk_analyst` | Risk & Compliance | 28 | 42 | 1,100,000 CZK | 1,280,000 CZK | ~14% → unresolved |
| `client_advisor` | Client Advisory | 35 | 25 | 950,000 CZK | 980,000 CZK | ~3% → justified |
| `ops_support` | Operations | 22 | 8 | 720,000 CZK | 780,000 CZK | ~8% → observed |
| `tech_platform` | Technology | 15 | 35 | 1,350,000 CZK | 1,520,000 CZK | ~11% → unresolved |

Currency: CZK. NACE: `K64`. ESCO URIs from `data/reference/esco_occupations.parquet`.

#### Scenario 3 — `upload-csv-sample` (for live demo upload UI)

Small CSV (15–20 rows) that an admin can drag-drop during a sales demo:

- File: `data/demo_samples/meridian_payroll_upload.csv`
- Uses upload column names (`base_salary`, `currency`) not prep script names
- `job_code` values must exist in tenant's `job_architecture.parquet`
- Mix of genders; at least one category crossing 5%

### New script: `scripts/seed_demo_tenant.py`

**Responsibilities:**

1. Accept `--scenario aerotech-fr|meridian-cz` and `--tenant-slug demo`
2. Resolve or create Postgres tenant + admin user (or document manual OAuth step)
3. Run scenario generator → CSV in temp dir
4. Run `prepare_internal_company_data.py --trust-company-data` → tenant internal dir
5. Run `dbt run --select tag:internal` with `WORKFORCEGUARD_INTERNAL_PATH` + `tenant_schema`
6. Seed `governance_events.sqlite` with 3–5 realistic events (approve eng category, export evidence)
7. Print health summary (row counts, review states, benchmark availability)

**Pseudocode:**

```python
def seed_demo_tenant(scenario: str, tenant_id: str):
    generate_scenario_csv(scenario, out_dir)
    prepare_internal(out_dir, f"data/tenants/{tenant_id}/internal", manifest_path)
    run_dbt_internal(tenant_id)
    seed_governance_events(tenant_id, scenario)
    assert_health(tenant_id)  # raises if gating would fail
```

### New script: `scripts/generate_demo_company_cz.py`

Mirror `generate_demo_company.py` for Meridian CZ scenario. Share utilities (pay spread, job arch writer) in `scripts/demo_data/common.py`.

### Optional API improvement (PR 2)

`POST /api/upload/job-architecture` — same pattern as payroll:

- CSV columns: `job_code`, `job_family`, `job_level`, `worker_category_id`, `worker_category_label`, `esco_uri`, `nace_code`
- Triggers dbt rebuild
- Enables upload-only demos without prep script

### Data quality rules (synthetic)

| Rule | Rationale |
|------|-----------|
| ≥10 rows per upload | API validation |
| Both genders per category with gap story | `internal_gender_pay_gap` computed |
| `employment_status` = `active` | dbt filter |
| `country_code` matches dashboard filter | Benchmark scoped to country |
| Consistent `worker_category_id` across payroll + job arch | Join keys |
| Pay amounts realistic for country (FR EUR, CZ CZK) | Credible demo |
| `non_binary` ≤2% of rows or exclude | dbt drops non-binary from gap calc |
| No real company names | Use fictitious entities only |
| `version` field set | Audit trail |

### Manifest template

```json
{
  "tenant_id": "<uuid>",
  "assets": {
    "internal_payroll_snapshot": {
      "path": "internal/payroll_snapshot.parquet",
      "record_count": 180,
      "trusted_for_company_claims": true,
      "version": "demo-v1"
    },
    "internal_job_architecture": {
      "path": "internal/job_architecture.parquet",
      "record_count": 8,
      "trusted_for_company_claims": true,
      "version": "demo-v1"
    }
  }
}
```

### dbt rebuild command (per tenant)

```bash
SANITIZED=$(echo "$TENANT_ID" | tr -cd '[:alnum:]' | sed 's/^/tenant_/')
WORKFORCEGUARD_INTERNAL_PATH="data/tenants/$TENANT_ID/internal" \
  dbt --project-dir analytics --profiles-dir analytics run \
  --select tag:internal \
  --vars "{\"tenant_schema\": \"$SANITIZED\"}"
```

---

## PR plan (recommended stack)

| PR | Branch | Scope | Depends on |
|----|--------|-------|------------|
| **PR1** | `chore/repo-cleanup` | gitignore, remove `projects/`, untrack duckdb/profiles | — |
| **PR2** | `feature/demo-synthetic-data` | CZ generator, `seed_demo_tenant.py`, sample upload CSV | PR1 |
| **PR3** | `feature/landing-assets` | Capture script, screenshots, video refresh | PR2 |
| **PR4** | `feature/landing-overhaul` | New components, refactor, support email | PR3 |
| **PR5** | `feature/upload-job-architecture` | Optional API endpoint | PR2 |

If time-constrained, merge PR2 + PR3 before PR4 (landing needs assets + working demo tenant).

---

## Verification checklist

### Landing

```bash
cd dashboard/frontend
npm run lint && npm run typecheck && npm test
# Manual: all 6 ProductTour tabs show screenshots
# Manual: #contact form submits; support email in footer
```

### Demo data

```bash
python scripts/seed_demo_tenant.py --scenario meridian-cz --tenant-slug demo
# GET /api/overview?geography=CZ&sector=K → company benchmark available
# Pay Analysis shows ≥2 review items
# Govern shows hash chain + export
```

### Repo

```bash
git status  # no untracked AI drafts staged
rg -i 'as an AI|ai-responses' docs/  # clean
test ! -d projects/
test ! -f data/workforceguard_analytics.duckdb  # or gitignored
```

### Assets

```bash
ls dashboard/frontend/public/screenshots/*.png | wc -l  # expect 6
ffprobe dashboard/frontend/public/demos/product_walkthrough.mp4
```

---

## Open decisions (resolve in implementation chat)

1. **Primary screenshot geography:** CZ (walkthrough consistency) vs FR (AeroTech data) — recommend **CZ for landing**, keep FR as second demo tenant.
2. **Job architecture upload API:** Include in PR5 or seed-only for now?
3. **Paper docs:** Move to `docs/paper/` and commit, or gitignore entire tree?
4. **Pricing section:** Add “Enterprise — contact us” stub or omit?

---

## File index (quick reference)

| Area | Key paths |
|------|-----------|
| Landing | `dashboard/frontend/src/components/landing/` |
| SEO | `dashboard/frontend/src/lib/seo.ts` |
| Demo API | `dashboard/frontend/api/request-demo.js` |
| Upload | `dashboard/backend/main.py`, `service.py` → `ingest_uploaded_payroll` |
| dbt internal | `analytics/models/marts/internal/` |
| Generators | `scripts/generate_demo_company.py`, `scripts/prepare_internal_company_data.py` |
| Tenant data | `data/tenants/{id}/internal/` |
| Auth schema | `dashboard/backend/auth/schema.sql` |
| MaSoVa reference | `MaSoVa-restaurant-management-system/frontend/src/apps/ProductSite/` |

---

*End of plan. Start implementation session with PR1 (repo cleanup) or PR2 (synthetic data) depending on whether landing capture is blocked on demo tenant.*
