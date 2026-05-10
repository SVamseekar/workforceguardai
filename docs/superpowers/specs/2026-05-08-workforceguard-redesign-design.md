# WorkforceGuard Frontend Redesign — Design Spec
**Date:** 2026-05-08  
**Status:** Approved for implementation planning  
**Scope:** Frontend only — zero backend changes

---

## 1. Problem Statement

The current frontend is a single long-scroll page. Every section, chart, signal, and action is displayed simultaneously regardless of what the user needs. It reads like a document rather than operating like a tool. The three primary users — HR Director, Compensation & Benefits Manager, People Analytics Lead — have no distinct navigation paths and no sense of place within the product.

Secondary problem: backend technical terminology has leaked into user-facing copy throughout the UI. Terms like "actor", "internal mart active", "observed gap", and "proxy" are schema language, not HR language.

---

## 2. Design Goals

1. Transform the single-scroll page into a **4-section multi-page application** with proper routing
2. Each section has a **distinct purpose and audience** — users self-route based on what they need
3. All user-facing copy uses **professional HR and compliance language** — no backend terms visible
4. The visual design (navy/teal palette, glassmorphism) stays — the **information architecture changes**, not the aesthetic
5. Every feature that works today works after — this is a **reorganisation**, not a rewrite of logic

---

## 3. Users

| User | Primary need | Primary section |
|------|-------------|----------------|
| HR Director / CPO | Big picture — how are we doing, what needs attention | Home |
| Compensation & Benefits Manager | Pay analysis — gaps, compliance exposure, remediation | Pay Analysis |
| People Analytics Lead | Market intelligence — benchmarks, signals, evidence | Market Intelligence |
| Compliance Officer / Legal | Audit trail, evidence export, filed reports | Govern & Export |

All three HR users share the product. Navigation must serve each without forcing them to scroll past irrelevant content.

---

## 4. Navigation Architecture

### URL Structure

```
/                    → Home (command centre, default landing)
/market              → Market Intelligence
/pay-analysis        → Pay Analysis
/govern              → Govern & Export
```

### Query Parameters

Filter state is encoded in the URL on sections that need it. This makes views shareable — an HR director can send a URL to legal counsel and they land on the identical filtered context.

```
/market?country=FR&geography=EU27_AVG&sector=J&period=2025-Q3&benchmark=eu
/pay-analysis?country=FR&geography=EU27_AVG&sector=J&period=2025-Q3
```

Query params apply to: `country`, `geography`, `sector`, `period`, `benchmark_geography`, `benchmark_sector`

Query params do NOT apply to: evidence drawer open state, copilot panel open state — these are ephemeral UI state.

### App Shell

Every section shares a persistent shell:

```
┌─────────────────────────────────────────────────────────────┐
│  [Logo]  [AeroTech Europe SAS ▼]        [France · Q3 2025]  │  TopBar
├──────────┬──────────────────────────────────────────────────┤
│          │                                                   │
│  Home    │                                                   │
│          │                                                   │
│  Market  │         <ActiveSection />                        │
│  Intel   │                                                   │
│          │                                                   │
│  Pay     │                                                   │
│  Analysis│                                                   │
│          │                                                   │
│  Govern  │                                                   │
│  & Export│                                                   │
│          │                                                   │
│  ──────  │                                                   │
│  Copilot │                                                   │
│          │                                                   │
└──────────┴──────────────────────────────────────────────────┘
```

**Sidebar:** Persistent left navigation. Active section highlighted. Copilot button at the bottom opens a slide-in right panel — accessible from any section.

**TopBar:** Company selector (left) + current filter context display (right). Does not contain filter controls — those live inside the sections that need them.

**Copilot panel:** Slide-in from the right, overlays the main content. Uses `/api/ask`. Pre-seeded with current filter context. Closeable. Never a full page.

---

## 5. Section Designs

### 5.1 Home — Command Centre

**Purpose:** Orient and route. Answer "do I have anything urgent and where do we stand?" in 10 seconds.

**Does not contain:** Charts, full signals list, pay transparency detail, governance log. Those live in their respective sections.

**Layout:**

```
COMMAND CENTRE
[Country · Sector · Period]

┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│ Vacancy  │ │Unemploy- │ │ Gender   │ │  Equity  │
│ Rate     │ │ment Rate │ │ Pay Gap  │ │   Risk   │
│  2.8%    │ │  6.1%    │ │  11.4%   │ │  62/100  │
│ Watch ▲  │ │ Good ▼   │ │ Watch ▲  │ │ Neutral  │
└──────────┘ └──────────┘ └──────────┘ └──────────┘

NEEDS ATTENTION
┌──────────────────────────────────────────────────┐
│ ⚠  Gender pay gap 3.2 pts above sector average   │
│ ⚠  2 pay transparency categories need review     │
│ ✓  Vacancy rate improving vs prior period        │
└──────────────────────────────────────────────────┘

EXECUTIVE BRIEF
[brief text from /api/brief — 3-5 sentences]
```

**Data sources:**
- 4 metric cards → `overview.metrics` array
- Needs Attention items → `overview.intelligence.signals` where tone is `watch` + `overview.pay_transparency.summary.unresolved_review_item_count`
- Executive Brief → `overview.brief`

**User actions:**
- Click any metric card → routes to `/market` with that metric in focus
- Click any attention item → routes to the relevant section
- No filter bar — context is set in the TopBar

---

### 5.2 Market Intelligence

**Purpose:** Understand the external European labour market. All data here is Eurostat — real, sourced, provenance-backed.

**Layout:**

```
MARKET INTELLIGENCE
[Country · Sector · Period]

FILTER BAR
[Country ▼]  [Sector ▼]  [Period ▼]  [Compare against: EU Average ▼]
                                                         [Run Analysis]

┌───────────────────────────┐  ┌───────────────────────────┐
│ Unemployment Trend        │  │ Vacancy Rate by Sector    │
│ [line chart]              │  │ [bar chart]               │
│ Source: Eurostat LFS      │  │ Source: Eurostat JVS      │
└───────────────────────────┘  └───────────────────────────┘

┌───────────────────────────┐  ┌───────────────────────────┐
│ Employment Trend          │  │ Gender Pay Gap by Sector  │
│ [line chart]              │  │ [bar chart]               │
│ Source: Eurostat LFS      │  │ Source: Eurostat SES      │
└───────────────────────────┘  └───────────────────────────┘

INTELLIGENCE SIGNALS
┌──────────────────────────────────────────────────────────┐
│ [Watch]  Vacancy pressure rising in software sector      │
│          Market tightness has increased 1.4 pts YoY      │
│                                          [View evidence] │
├──────────────────────────────────────────────────────────┤
│ [Good]   Unemployment stable below EU average            │
│          ...                                             │
└──────────────────────────────────────────────────────────┘

RECOMMENDATIONS          WATCHLIST
[rec items]              [watch items]
```

**Data sources:**
- Filter bar options → `overview.filters.options`
- 4 charts → `overview.charts.unemployment_trend`, `employment_trend`, `vacancy_by_sector`, `pay_gap_by_sector`
- Signals → `overview.intelligence.signals`
- Recommendations → `overview.intelligence.recommendations`
- Watchlist → `overview.intelligence.watchlist`
- Provenance on each chart → `source_id` mapped to full source name (see copy standards)

**View evidence button:** Opens evidence drawer as a right-side contextual panel scoped to that signal. Same drawer component as today, triggered per signal.

**Filter state:** Synced to URL query params. Changing a filter updates the URL and re-fetches data.

---

### 5.3 Pay Analysis

**Purpose:** Compare company pay position against the market and understand compliance exposure under the EU Pay Transparency Directive.

**Layout:**

```
PAY ANALYSIS
[AeroTech Europe SAS · Engineering IC · Q3 2025]

COMPANY vs MARKET
┌──────────────────────────────────────────────────────────┐
│  Internal pay gap          Market comparator             │
│  ████████████ 14.2%   vs   █████████ 11.4%               │
│                                                          │
│  +2.8 pts above market                         [Watch]   │
│  Worker category: Engineering IC                         │
│  124 employees · Partial market data                     │
│  Data as of: March 2025    Evidence source: Combined     │
└──────────────────────────────────────────────────────────┘

DERIVED SCORES
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│ Hiring   │ │ Labour   │ │ Equity   │ │Transition│
│ Pressure │ │Resilience│ │  Risk    │ │Readiness │
│  71/100  │ │  58/100  │ │  62/100  │ │  44/100  │
└──────────┘ └──────────┘ └──────────┘ └──────────┘

PAY TRANSPARENCY COMPLIANCE
EU Pay Transparency Directive · 3 worker categories · 2 need review

┌──────────────────────────────────────────────────────────┐
│ Worker Category      Pay Gap    Status                   │
│ ─────────────────────────────────────────────────────    │
│ Engineering IC       14.2%      Needs review      [→]   │
│ HR Generalist         4.1%      Documented        [→]   │
│ Senior Engineer      18.7%      Needs review      [→]   │
└──────────────────────────────────────────────────────────┘

[Approve]  [Override]  [Reverse]

⚠ Representative example · Based on 2025 public aggregates
  This is illustrative data showing what your analysis would look like.
  [Upload your company data →]
```

**Data sources:**
- Company vs Market panel → `overview.company_benchmark` (internal_value, market_value, delta_label, worker_category, headcount, coverage_status, confidence, snapshot_date, evidence_basis)
- Derived scores → `overview.semantic_metrics`
- Pay transparency table → `overview.pay_transparency`
- Governance buttons → POST `/api/governance-events`

**Copy standards applied:**
- `partial coverage` → "Partial market data"
- `snapshot_date` → "Data as of"
- `evidence_basis: blended` → "Evidence source: Combined"
- `unresolved_review_item` → "Needs review"
- `justified_difference` → "Documented"
- `internal mart inactive` → show demo data notice

**Demo data notice:** Always visible when `overview.internal_data.status !== 'active'`. Non-apologetic. One line + call to action. Does not disable any features — the demo company is always shown.

---

### 5.4 Govern & Export

**Purpose:** Audit trail, evidence download, workflow automation. The section a compliance officer or legal counsel uses.

**No filter bar.** Scoped to whatever company and period is set in the TopBar.

**Layout:**

```
GOVERN & EXPORT

GOVERNANCE LOG
┌────────────────────────────────────────────────────────┐
│ Action      Category           Reviewed by    Date     │
│ ──────────────────────────────────────────────────     │
│ Approved    Engineering IC     S. Amarasekara  May 7   │
│ Overridden  Senior Engineer    S. Amarasekara  May 6   │
│ Reversed    HR Generalist      S. Amarasekara  May 5   │
└────────────────────────────────────────────────────────┘

EVIDENCE PACK
┌────────────────────────────────────────────────────────┐
│ What is included:                                      │
│ ✓ Market metrics with source citations                 │
│ ✓ Benchmark comparisons with methodology notes        │
│ ✓ Pay transparency review items and decisions          │
│ ✓ Governance decision log with timestamps             │
│ ✓ Data vintage and methodology versions               │
│                                                        │
│ [Download Evidence Pack]                               │
└────────────────────────────────────────────────────────┘

WORKFLOW AUTOMATION
┌────────────────────────────────────────────────────────┐
│ SCHEDULED WORKFLOWS                                    │
│ Monthly Pay Review      Active    [Run now]            │
│ Quarterly Gap Report    Pending   [Configure]          │
│                                                        │
│ PENDING HANDOFFS                                       │
│ Senior Engineer gap → Legal review    Due: May 15      │
└────────────────────────────────────────────────────────┘
```

**Data sources:**
- Governance log → `overview.governance.logged_events` + GET `/api/governance-events`
- Evidence pack → GET `/api/evidence-pack` triggered on button click
- Workflow automation → `overview.automation`

**Copy standards applied:**
- "actor" → "Reviewed by"
- "action_code" → human label (Approved, Overridden, Reversed)
- "target_id" → actual category name
- "formula_version" → omitted from UI, included in downloaded pack only

---

## 6. Copilot Panel

Accessible from all sections via the sidebar Copilot button. Slides in from the right, overlays the current section without navigating away.

```
┌─────────────────────────────┐
│ AI Analyst          [✕]     │
│ ─────────────────────────── │
│ Ask about the current view  │
│                             │
│ [text input          ] [→]  │
│                             │
│ Suggested:                  │
│ How does this compare       │
│ to the EU benchmark?        │
│                             │
│ Which signal is worsening   │
│ fastest?                    │
└─────────────────────────────┘
```

**Data source:** POST `/api/ask` with current filter context pre-populated from URL query params.

**Suggested questions** → `CONSOLE_FOLLOW_UPS` list, already in the frontend.

---

## 7. File Structure

```
src/
├── index.css                   — CSS variables, base styles (unchanged)
├── App.css                     — app shell layout rules only
├── App.jsx                     — shell: TopBar + Sidebar + <Routes>
├── main.jsx                    — unchanged
│
├── hooks/
│   └── useOverviewData.js      — axios fetch + filter state + URL sync
│
├── components/
│   ├── layout/
│   │   ├── Sidebar.jsx         — left nav, 4 links + Copilot button
│   │   ├── TopBar.jsx          — logo + company selector + period display
│   │   └── CopilotPanel.jsx    — slide-in AI panel
│   │
│   ├── primitives/
│   │   ├── ToneChip.jsx        — Good / Watch / Neutral chip
│   │   ├── StatusBadge.jsx     — replaces all backend-term status badges
│   │   ├── ProvenanceBadge.jsx — source citation badges
│   │   └── MetricCard.jsx      — reusable metric display card
│   │
│   ├── sections/
│   │   ├── HomeSection.jsx
│   │   ├── MarketSection.jsx
│   │   ├── PayAnalysisSection.jsx
│   │   └── GovernSection.jsx
│   │
│   └── shared/
│       ├── EvidenceDrawer.jsx  — contextual right panel
│       ├── FilterBar.jsx       — reusable filter controls
│       └── ChartPanel.jsx      — chart wrapper with source badge
```

---

## 8. Technical Approach

**Router:** React Router v6. Install as new dependency. Each section is a `<Route>`. The app shell (`App.jsx`) wraps all routes with `<BrowserRouter>`.

**Filter state:** `useSearchParams` from React Router. Filter changes update the URL. On mount, filter state is read from URL params — makes views bookmarkable and shareable.

**Data fetching:** Single `useOverviewData` hook. Accepts filter state as input, calls `/api/overview` with those params, returns the full overview payload. All sections consume this hook — no duplicate fetching.

**Navigation:** `<NavLink>` from React Router for sidebar links. Active state styling is automatic via `NavLink`'s `isActive` prop.

**No new UI component libraries.** The existing CSS variables, custom classes, and Recharts setup stays. Tailwind is available for utility classes where it reduces verbosity but is not required.

**Overview.jsx:** Deleted at the end of implementation. Its logic is distributed into the new file structure. Nothing is lost — only reorganised.

---

## 9. Copy Standards — Full Replacement Table

All occurrences of the following terms must be replaced everywhere in user-facing text, labels, tooltips, and copy. Backend code and API responses are not affected.

| Backend / current term | User-facing replacement |
|----------------------|------------------------|
| actor | Reviewed by |
| target_type | Category |
| target_id | [use the actual name] |
| action_code | [use the label: Approved / Overridden / Reversed] |
| evidence_basis | Evidence source |
| coverage_status | Data coverage |
| formula_version | [omit from UI, include in evidence pack download only] |
| source_id | [use full name: e.g. "Eurostat Labour Force Survey"] |
| tone | [never show; show the label: Good / Watch / Neutral] |
| benchmark_geography | Compare against |
| snapshot_date | Data as of |
| internal mart active | Company data connected |
| internal mart inactive | No company data loaded |
| external-only answers | Market data only |
| observed gap | Pay gap identified |
| unresolved review item | Needs review |
| justified difference | Documented difference |
| evidence_basis: blended | Evidence source: Combined |
| evidence_basis: internal | Evidence source: Company data |
| evidence_basis: external | Evidence source: Market data |
| partial coverage | Partial market data |
| full coverage | Full market data |
| proxy (benchmark status) | Estimated benchmark |
| official (benchmark status) | Verified benchmark |
| high confidence | High confidence |
| low confidence | Limited data — treat with caution |
| peer | Peer countries |
| eu | EU average |
| prior_period | Prior period |

---

## 10. What Does Not Change

- The backend — zero changes
- All API endpoints and contracts — zero changes
- Data fetching logic — moved to a hook, not rewritten
- The visual palette — navy (#07111f), teal (#7ff4ea), glassmorphism
- Charts — Recharts stays, styled to match palette
- All existing features — every feature works after the redesign

---

## 11. Success Criteria

- The app has 4 distinct navigable sections with working URLs
- Each section URL is shareable and loads the correct filtered state
- `Overview.jsx` no longer exists
- No single component file exceeds 300 lines
- Zero backend terminology appears in any user-facing text
- The demo company (synthetic data) is clearly labelled on Pay Analysis
- All existing functionality (evidence drawer, governance actions, copilot, evidence pack download, charts, signals) works identically to today
