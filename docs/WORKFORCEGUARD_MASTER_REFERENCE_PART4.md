# WorkforceGuard AI — Master Reference Document
## Part 4 of 4: Frontend Application, Data Assets, Operations, Security & Gap Summary

---

## 28. FRONTEND APPLICATION OVERVIEW

**Location:** `dashboard/frontend/`
**Framework:** React 19, Vite 7
**Language:** JavaScript (JSX) — TypeScript migration is a v1.0 GA requirement
**State management:** `useState` + `startTransition` only — no global store
**Data fetching:** `axios` (no base URL interceptor, no request ID propagation)
**Charts:** Recharts 3
**Icons:** Lucide React
**Styling:** Tailwind CSS 4 + custom CSS classes in `App.css` and `index.css`
**Port (dev):** `http://localhost:5173` (Vite default)

### Project Structure

```
dashboard/frontend/
├── src/
│   ├── App.jsx                     # Shell (12 lines — renders <Overview />)
│   ├── App.css                     # Dashboard shell, halo decorators, tonal classes
│   ├── index.css                   # Base resets, dark background, font
│   ├── main.jsx                    # React DOM mount
│   └── components/
│       └── Overview.jsx            # Entire product UI (2,187 lines)
├── package.json                    # Dependencies
├── vite.config.js                  # Proxy + manual chunk splitting
├── index.html
├── tailwind.config.js
└── postcss.config.js
```

### Frontend Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| react | 19.2.0 | UI framework |
| react-dom | 19.2.0 | DOM renderer |
| axios | 1.13.5 | HTTP client |
| recharts | 3.7.0 | Chart components |
| lucide-react | 0.574.0 | Icon library |
| clsx | 2.1.1 | Conditional className helper |
| tailwind-merge | 3.4.1 | Tailwind class deduplication |
| vite | 7.3.1 | Build tool |
| @vitejs/plugin-react | 5.1.1 | Vite React plugin |
| tailwindcss | 4.1.18 | Utility CSS |

### Vite Configuration

- **Dev proxy:** `/api/*` and `/health` proxied to `http://127.0.0.1:8001` (override via `VITE_API_PROXY_TARGET`)
- **Manual chunks:** `charts` (recharts), `icons` (lucide-react), `network` (axios)
- **API base:** `import.meta.env.VITE_API_BASE_URL ?? '/api'`

---

## 29. APP.JSX

12 lines. Renders a single `<div className="app-shell">` containing `<Overview />`. No routing. No providers. No state.

```jsx
import Overview from './components/Overview'
import './App.css'

function App() {
  return (
    <div className="app-shell">
      <Overview />
    </div>
  )
}
```

**Critical gap:** No router. The entire product is one page. The v1.0 target is a four-page SPA: Overview, Compare, Evidence, Governance.

---

## 30. OVERVIEW.JSX — COMPONENT MAP

**Location:** `dashboard/frontend/src/components/Overview.jsx`
**Lines:** 2,187 (single file — entire product UI)
**Mixed class + function components:** one `class PanelErrorBoundary extends Component`, all others are function components.

### Module-Level Helpers (lines 67–332)

| Function | Purpose |
|----------|---------|
| `buildQueryParams(filters)` | Builds `{country, geography, sector, period, benchmark_geography, benchmark_sector}` from filter state |
| `formatMetricValue(value, unit)` | Formats a metric value as `"2.4%"` or `"—"` |
| `formatDelta(delta, unit)` | Formats a comparison delta as `"+0.3 pts"` |
| `formatTooltipValue(value, unit)` | Recharts tooltip formatter |
| `formatComparisonValue(value, unit)` | Comparison section value formatter |
| `formatSignedDifference(delta, unit)` | Signed `+/-` delta |
| `toneFromConfidence(confidence)` | `"high"` → `"good"`, `"low"` → `"watch"`, etc. |
| `toneFromBenchmarkStatus(status)` | `"proxy"` → `"neutral"`, `"official"` → `"good"` |
| `toneFromCoverageStatus(status)` | `"full"` → `"good"`, `"partial"` → `"neutral"`, `"unavailable"` → `"watch"` |
| `toneFromEvidenceBasis(basis)` | `"company_aware"` → `"good"`, `"external"` → `"neutral"` |
| `buildActiveBenchmarkQuestion(overview)` | Derives the active benchmark question for the analyst console |
| `normalizeBenchmarkBasis(benchmarkMeta, overview)` | Resolves benchmark context from the overview payload |
| `buildInitialAnalystLimitations(overview, benchmarkBasis)` | Builds initial limitation bullets for the console |
| `buildConsoleFollowUps(overview)` | Returns 8 suggested follow-up questions |

### Primitive Components

| Component | Purpose |
|-----------|---------|
| `ToneChip({ tone, children })` | Coloured status chip — `good` (green), `neutral` (grey), `watch` (amber) |
| `ProvenanceBadge({ provenance, compact })` | Source attribution badge with formula version |
| `ChartTooltip({ active, payload, label, unit, labelKey })` | Shared Recharts tooltip |
| `ChartEmptyState({ message })` | Empty chart placeholder |
| `ChartFrame({ children })` | `ResponsiveContainer` wrapper |
| `SelectField({ label, value, options, onChange })` | Styled `<select>` field |
| `ScopeBadge({ label, value })` | Two-part label + value pill |
| `PanelErrorBoundary` (class) | Error boundary with `"Something went wrong in this panel"` fallback |

### Feature Sections

| Component | Lines | Description |
|-----------|-------|-------------|
| `BriefingBoard({ overview })` | 454–538 | Top briefing strip — headline, tone, key signals, notes, coverage warnings |
| `MetricCard({ metric, onOpenEvidence })` | 539–575 | Observed metric tile — value, unit, period, tone chip, provenance badge, evidence trigger |
| `SemanticMetricCard({ metric, onOpenEvidence })` | 576–601 | Modeled metric tile (hiring pressure, resilience, equity risk, transition readiness) |
| `InlineNotice({ notice, onDismiss })` | 602–619 | Dismissible inline notice banner |
| `FilterBar({ filters, options, comparisonTargets, onFilterChange, onExport, exporting })` | 624–716 | Country / geography / sector / period dropdowns + benchmark selectors + export button |
| `IntelligenceSection({ intelligence, semanticMetrics, onOpenEvidence })` | 717–837 | Four semantic metric cards + AI overview recommendations + trend charts |
| `ComparisonMetricCard({ metric, benchmarkId, onOpenEvidence })` | 838–903 | Single metric delta tile for comparative intelligence section |
| `ComparisonSection({ comparisons, filters, comparisonTargets, onOpenEvidence, ... })` | 904–1083 | Full five-benchmark comparative table — EU, peer, prior period, market, sector |
| `CompanyBenchmarkSection({ internalData, companyBenchmark })` | 1084–1190 | Phase 3 internal vs market section — trust gate, worker category summary, gap display |
| `ComplianceSimulationSection({ payTransparency, onOpenEvidence })` | 1211–1323 | Phase 4 pay-transparency review table — categories, states, priorities, governance buttons |
| `EvidenceDrawer({ ... })` | 1324–1416 | Slide-in evidence panel — metric provenance, sources, formula version, governance actions |
| `AnalystConsole({ filters, initialResponse })` | 1417–1607 | Q&A console — sends questions to `/api/ask`, renders confidence, evidence, follow-ups |

### Data Hook

| Hook | Lines | Description |
|------|-------|-------------|
| `useOverviewData()` | 1608–1805 | Core data hook — `axios.get('/api/overview')`, manages filters state, exports state, analyst response, evidence drawer state |

**`useOverviewData()` returns:**
```javascript
{
  overview,              // The full overview response object
  loading, error,        // Fetch state
  filters,               // Current {country, geography, sector, period, benchmark_geography, benchmark_sector}
  options,               // Filter options from overview.filters.options
  comparisonTargets,     // Benchmark selector options
  activeEvidence,        // Currently open evidence drawer payload
  handleFilterChange,    // (key, value) → update filter, re-fetch
  handleOpenEvidence,    // (metric) → open evidence drawer
  handleCloseEvidence,   // () → close evidence drawer
  handleExport,          // () → fetch /api/evidence-pack and download
  exporting              // boolean — export in progress
}
```

### Root Component

| Component | Lines | Description |
|-----------|-------|-------------|
| `Overview()` | 1806–2187 | Root component. Uses `useOverviewData()`. Renders loading spinner, error state, or full dashboard layout. |

**Dashboard layout (when loaded):**
1. `FilterBar` — top filter controls
2. `BriefingBoard` — headline + key signals + notes
3. Observed metric cards (4 × `MetricCard`)
4. `IntelligenceSection` — semantic metrics + trend charts + recommendations
5. `ComparisonSection` — five benchmarks (conditionally shown)
6. `CompanyBenchmarkSection` — Phase 3 internal data (shown when `overview.internal_data.available`)
7. `ComplianceSimulationSection` — Phase 4 pay-transparency (shown when `overview.pay_transparency.available`)
8. `EvidenceDrawer` — slide-in overlay (conditionally rendered)
9. `AnalystConsole` — Q&A input + response panel

---

## 31. CSS DESIGN SYSTEM

**Files:** `App.css`, `index.css`
**Approach:** Custom CSS classes (BEM-like naming) + Tailwind utility classes

### Colour Palette (CSS vars in App.css)

| Token | Value | Used For |
|-------|-------|---------|
| `--surface` | `#0f172a` | Dashboard background |
| `--surface-2` | `#1e293b` | Card backgrounds |
| `--surface-3` | `#334155` | Elevated surfaces |
| `--text-primary` | `#f1f5f9` | Main text |
| `--text-secondary` | `#94a3b8` | Muted text, labels |
| `--tone-good` | `#34d399` (emerald) | Positive signal tone |
| `--tone-watch` | `#fbbf24` (amber) | Warning tone |
| `--tone-neutral` | `#94a3b8` (slate) | Neutral tone |

### Halo Decorators (App.css)

```css
.dashboard__halo--one {
  /* Top-right: teal radial gradient blur */
  background: radial-gradient(circle, rgba(127,244,234,0.26), rgba(127,244,234,0));
}
.dashboard__halo--two {
  /* Bottom-left: periwinkle radial gradient blur */
  background: radial-gradient(circle, rgba(141,177,255,0.24), rgba(141,177,255,0));
}
```

### Tone Classes

| Class | Colour | Used On |
|-------|--------|---------|
| `.tone-chip--good` | emerald | `ToneChip` with `tone="good"` |
| `.tone-chip--watch` | amber | `ToneChip` with `tone="watch"` |
| `.tone-chip--neutral` | slate | `ToneChip` with `tone="neutral"` |

### Priority Badge Classes

| Class | Colour |
|-------|--------|
| `.priority-badge--high` | Red |
| `.priority-badge--medium` | Amber |
| `.priority-badge--low` | Slate |

### Governance Button Classes

| Class | Purpose |
|-------|---------|
| `.governance-button--approve` | Approve action |
| `.governance-button--override` | Override action |
| `.governance-button--reverse` | Reverse action |

### Review State Labels (in JavaScript, not CSS)

```javascript
const REVIEW_STATE_LABELS = {
  observed_gap:           'Observed gap',
  justified_difference:   'Monitored difference',
  unresolved_review_item: 'Unresolved review item',
}
```

### Formatters

- `Intl.NumberFormat('en-US', { maximumFractionDigits: 1 })` — used for metric values
- `Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' })` — governance event timestamps

**Known issue:** `'en-US'` locale used for an EU product. The v1.0 target is to default to user locale and pin to `'de-DE'` in evidence packs (EU compliance filing expectation).

---

## 32. FRONTEND STARTUP

```bash
# From repo root
cd dashboard/frontend
npm install
npm run dev        # Development server on :5173

npm run build      # Production build to dist/
npm run preview    # Preview production build
npm run lint       # ESLint
```

**Environment variables (`.env` or `.env.local`):**

| Variable | Default | Purpose |
|----------|---------|---------|
| `VITE_API_BASE_URL` | `'/api'` | Backend base path (used in Overview.jsx) |
| `VITE_API_PROXY_TARGET` | `'http://127.0.0.1:8001'` | Vite dev proxy target |

---

## 33. DATA ASSETS

### `data/eu_raw/` — Eurostat Raw Parquet

16 Parquet files, one per configured dataset. Each file follows the Eurostat JSON-stat column schema (dim codes + values).

| File | Approx rows | Primary grain |
|------|------------|--------------|
| `employment_rate.parquet` | ~10,000 | country × year |
| `unemployment_rate.parquet` | ~10,000 | country × year |
| `job_vacancy_rate.parquet` | ~30,000 | country × sector × quarter |
| `gender_pay_gap_sector.parquet` | ~15,000 | country × sector × year |
| `labour_market_flows.parquet` | ~20,000 | country × flow type × quarter |
| `labour_market_slack.parquet` | ~25,000 | country × status × quarter |
| `at_risk_of_poverty_or_exclusion.parquet` | ~5,000 | country × year |
| `median_equivalised_income.parquet` | ~5,000 | country × year |
| `gini_coefficient.parquet` | ~5,000 | country × year |
| `housing_overburden_*.parquet` (3 files) | ~5,000 each | country × year |
| `gdp_per_capita.parquet` | ~5,000 | country × year |
| `commuting_time.parquet` | ~3,000 | country × year |
| `long_term_unemployment.parquet` | ~5,000 | country × year |
| `gender_pay_gap_age.parquet` | ~8,000 | country × age group × year |

**Manifest:** `data/eu_meta/manifest.json` — pull timestamp, datasets pulled, success/failure per dataset.

### `data/reference/` — ESCO Reference Parquet

| File | Content |
|------|---------|
| `esco_occupations.parquet` | ESCO v1.2.1 occupation hierarchy |
| `esco_skills.parquet` | ESCO skills with `digital_skill_indicator`, `green_skill_indicator` |
| `esco_occupation_skill_relations.parquet` | Many-to-many occupation → skill mappings |
| `esco_nace_crosswalk.parquet` | ESCO URI → NACE Rev.2 code bridge |
| `esco_api_manifest.json` | ESCO pull timestamp and version |
| `manifest.json` | General reference layer manifest |

### `data/internal/` — Internal Company Parquet (Sample)

| File | Current rows | Schema |
|------|-------------|--------|
| `payroll_snapshot.parquet` | 6 sample rows | employee_id, job_code, country_code, worker_category_id, gender, base_pay_amount, pay_currency, snapshot_date, employment_status, version |
| `job_architecture.parquet` | 4 sample rows | job_code, job_title, worker_category_id, job_family, job_level, nace_code, esco_uri |
| `hris_workforce_snapshot.parquet` | 6 sample rows | employee_id, country_code, worker_category_id, gender, employment_type, hire_date, termination_date, snapshot_date, employment_status |
| `ats_requisition_snapshot.parquet` | 3 sample rows | requisition_id, job_code, country_code, worker_category_id, open_date, snapshot_date |
| `learning_skill_snapshot.parquet` | 8 sample rows | employee_id, skill_uri, proficiency_level, snapshot_date |

**Note:** All internal data is sample / synthetic. Phase 3 trust gate (`trusted_for_company_claims: true`) must be confirmed in the manifest before company-specific claims render.

### `data/workforceguard_analytics.duckdb`

The compiled DuckDB warehouse. Built by `dbt run` against the raw Parquet files.

**Size:** ~9.7 MB (source: technical assessment)
**Tables (when fully built):** 28 models from the dbt project, plus 3 seed tables

### `data/governance_events.json`

Flat JSON array of governance events. Max 50 entries. Written by `AnalyticsRepository.record_governance_event()`.

```json
[
  {
    "event_id": "evt_0001",
    "action_code": "approved",
    "action_name": "Approved",
    "target_type": "pay_transparency_review",
    "target_id": "FR::tech_senior::2026-03-31",
    "reason": null,
    "context": {},
    "created_at": "2026-05-07T10:30:00+00:00"
  }
]
```

---

## 34. GIT BRANCH HISTORY

**Repository branches:**

| Branch | Status | Notes |
|--------|--------|-------|
| `main` | Active, up to date with origin | Current production HEAD after Phase 4 merge |
| `codex-phase-4-compliance-simulator` | Merged to main 2026-05-07 | Pay-transparency simulator — 574 lines added |
| `main-initial-backup` | Archive | Pre-development snapshot |

**Commit history (newest first):**

| Commit | Message |
|--------|---------|
| `6e27af4` | Start Phase 4 pay transparency simulator |
| `d918e65` | Add portfolio analytics projects |
| `b3f792d` | Add dashboard frontend application |
| `22d51c0` | Add dashboard backend service |
| `d2654fb` | Add generated workforce data assets |
| `bca07e1` | Add workforce data preparation pipelines |
| `34205c4` | Add analytics models and source configuration |
| `7a148a4` | Document product roadmap and architecture |
| `0a6f8e5` | Initialize repository structure |

---

## 35. SECURITY POSTURE

**Current state (pre-GA):**

| Area | Current | Required before first paying customer |
|------|---------|--------------------------------------|
| Authentication | None | OIDC via customer IdP (Azure AD / Okta) |
| Authorization | None | Single `analyst` role; evidence-pack export and governance writes gated |
| CORS | `allow_origins=["*"]` | Env-driven allowlist |
| Transport | HTTP | TLS terminated at a reverse proxy (Caddy / nginx), HSTS |
| Secrets | None in use | `.env` + secret manager when LLM keys land |
| GDPR — data residency | Developer laptop | EU-region hosted VM (Hetzner / OVH / Scaleway / AWS eu-central-1) |
| GDPR — DPA | None | DPA template prepared and signed at contract |
| GDPR — DSR support | None | Documented procedure to export / delete a single customer's dataset |
| Backups | None | Nightly DuckDB snapshot + governance log to S3-compatible EU bucket, 30-day retention |
| Logging | `print` / uvicorn default | Structured JSON logs, 30-day retention, no PII in logs |
| Monitoring | None | Healthcheck pings + uptime monitor + dbt freshness alert |
| CI/CD | Tests run locally | GitHub Actions: lint, dbt build + test, backend pytest, frontend build + axe, dependency audit |
| Dependency hygiene | Minimal requirements.txt | Pin all versions; run `pip-audit` and `npm audit` in CI |

---

## 36. OPERATIONS — STARTUP

### Full Stack Startup

**1. Build the analytics warehouse:**
```bash
cd analytics
dbt seed
dbt run
dbt test
```

**2. Start the backend:**
```bash
cd dashboard/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python main.py
# Listening on http://127.0.0.1:8001
```

**3. Start the frontend:**
```bash
cd dashboard/frontend
npm install
npm run dev
# Listening on http://localhost:5173
```

**4. Rebuild ingestion (when refreshing Eurostat data):**
```bash
python scripts/pull_eu_data.py
python scripts/pull_esco_api_data.py
cd analytics && dbt build
```

### Health Checks

```bash
curl http://127.0.0.1:8001/health
# → {"status": "ok", "service": "WorkforceGuard Analytics API", "generated_at": "..."}

curl "http://127.0.0.1:8001/api/overview?geography=EU27_AVG&sector=ALL&period=latest"
# → Full overview JSON
```

---

## 37. COMPLETE FILE SUMMARY

| Component | Language | Key Files | Lines (approx) |
|-----------|----------|-----------|---------------|
| Ingestion scripts | Python | `pull_eu_data.py`, `pull_esco_api_data.py`, `prepare_*.py` | ~1,200 |
| dbt project config | YAML | `dbt_project.yml`, `profiles.yml`, `eu_sources.yaml` | ~120 |
| dbt macros | SQL (Jinja) | 4 macro files | ~40 |
| dbt staging models | SQL | 11 files (6 Eurostat + 5 internal) | ~300 |
| dbt mart models | SQL | 15 files (5 core + 7 internal + 3 reference) | ~800 |
| dbt seed CSVs | CSV | 3 files | ~30 rows |
| FastAPI app | Python | `main.py` | 184 |
| Service layer | Python | `service.py` | 4,458 |
| Backend tests | Python | `test_service.py` | 722 |
| React app shell | JSX | `App.jsx` | 12 |
| React UI | JSX | `Overview.jsx` | 2,187 |
| CSS design system | CSS | `App.css`, `index.css` | ~400 |
| Documentation | Markdown | `docs/` (14 files) | ~4,000 |

---

## 38. DOCUMENTATION INDEX

All documentation lives in `docs/`. Key files:

| File | Purpose |
|------|---------|
| `solution-architecture.md` | Plain-English product architecture and data strategy |
| `prd-roadmap.md` | Phase-by-phase product roadmap index |
| `prd-phase-1-foundation.md` | Phase 1 PRD (complete) |
| `prd-phase-2-comparative-intelligence.md` | Phase 2 PRD (complete) |
| `prd-phase-3-company-decision-support.md` | Phase 3 PRD (first slice implemented) |
| `prd-phase-4-compliance-governance-suite.md` | Phase 4 PRD (started) |
| `prd-phase-5-ai-copilot-workflows.md` | Phase 5 PRD (complete) |
| `01-technical-design.md` | v1.0 engineering contract — 6-week build plan |
| `02-launch-readiness.md` | v1.0 go/no-go decisions and launch scope |
| `03-architecture-overview.md` | Component-level architecture for new engineers |
| `04-product-brief.md` | Stakeholder-facing product brief |
| `technical-assessment.md` | Pre-GA production-readiness review with gap analysis |
| `WORKFORCEGUARD_MASTER_REFERENCE_PART1.md` | This document series — Part 1 |
| `WORKFORCEGUARD_MASTER_REFERENCE_PART2.md` | This document series — Part 2 |
| `WORKFORCEGUARD_MASTER_REFERENCE_PART3.md` | This document series — Part 3 |
| `WORKFORCEGUARD_MASTER_REFERENCE_PART4.md` | This document series — Part 4 |

---

## 39. KNOWN ISSUES AND TECHNICAL DEBT

| Issue | Severity | Detail |
|-------|----------|--------|
| `service.py` is a 4,458-line monolith | Critical | All repository I/O, metric computation, comparison logic, narrative generation, evidence packaging, and governance in one module. Single biggest velocity risk for Phase 4 |
| `Overview.jsx` is 2,187 lines | High | No router, no design system, no state management boundary, no UI tests. Mixed class and function components |
| No data provenance on staging models | High | Cannot trace a dashboard number back to a Eurostat dataset code and pull timestamp |
| No authentication or authorization | High | `allow_origins=["*"]`, no OIDC, no role-based access — production blocker |
| No CI/CD pipeline | High | Tests run locally only; no GitHub Actions |
| No backup or restore strategy | High | No DuckDB snapshots, no restore drill |
| Governance event store is a JSON file | Medium | 50-event hard cap, no hash chain, not tamper-evident. v1.0 target is SQLite with hash-chained append-only schema |
| Evidence pack has no hash signing | Medium | No ed25519 signature, no PDF rendering. Current output is raw JSON |
| No AI layer | Medium | Analyst responses are 100% templated string composition over SQL. Correct for a compliance product, but must be named honestly |
| `Intl.NumberFormat('en-US')` in EU product | Medium | Number formatting should default to user locale or `'de-DE'` for compliance evidence packs |
| Internal data is 6 sample rows | Medium | Phase 3 company-aware features are gated; real customer data required for full activation |
| No freshness signals | Medium | No `/api/freshness` endpoint; no UI indicator showing when Eurostat data was last pulled |
| `axios` unconfigured | Low | No base URL interceptor, no error normaliser, no request ID propagation |
| NUTS 2 geography blocked | Low | Active marts expose country-level only; NUTS 2 expansion requires wider signal coverage |
| `event_id` is not globally unique | Low | `evt_{n:04d}` resets on process restart; replace with UUID for audit-grade event IDs |

---

## 40. DEVELOPMENT RULES AND HARD CONSTRAINTS

### Data and Analytics Layer
- dbt staging models must not join across sources — one Parquet per staging model
- Mart primary keys must follow the `::` concatenation pattern (`geo_id::sector_id::metric_id`)
- All new mart primary keys must carry `unique` and `not_null` dbt tests
- The metric registry CSV is the single source of truth for approved metric formulas — no formula logic in the API
- Governance thresholds belong in mart SQL (not in `service.py` constants) — the mart output is the evidence record

### Backend
- `AnalyticsRepository` must remain the only class that touches DuckDB or file system I/O
- Public methods in `AnalyticsRepository` must not raise exceptions — they return structured `Dict` responses; the `guarded()` wrapper in `main.py` handles HTTP error mapping
- Never hardcode `governance_events.json` path in tests — use `AnalyticsRepository(root_dir, governance_events_path=...)` override
- Governance action validation (`requires_reason`) must match the seed CSV — not hardcoded
- Internal data gating: company-specific claims must not render unless `internal_data["available"] == True`

### Frontend
- `API_BASE` must use `import.meta.env.VITE_API_BASE_URL ?? '/api'` — never hardcode a port
- All metric rendering must go through `formatMetricValue()` — never inline `toFixed()` on raw values
- `ToneChip` must be the only mechanism for tone display — never inline colour classes
- Governance button clicks must POST to `/api/governance-events` before updating local state — never optimistic update on governance actions

### Git
- Commit format: imperative mood, sentence case — e.g. `"Add Phase 4 pay transparency mart"`
- Feature branches merge to `main` via fast-forward when possible
- Never commit `data/internal/*.parquet` or `data/workforceguard_analytics.duckdb` — both are gitignored
- Never commit `.env` or any file containing `VITE_API_PROXY_TARGET` pointing to a non-localhost address

---

*End of WorkforceGuard AI Master Reference Document (4 parts)*

*Generated: 2026-05-07*
*Based on: complete codebase analysis — analytics dbt project (28 models), FastAPI backend (4,458 lines), React frontend (2,187 lines), ingestion scripts, documentation, and data assets*
*Branch state: `main` (includes Phase 4 pay-transparency simulator merge)*
