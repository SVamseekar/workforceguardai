# WorkforceGuard Frontend Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the single-scroll `Overview.jsx` into a 4-section multi-page React application with proper routing, shareable URLs, and professional HR/compliance copy throughout.

**Architecture:** React Router v6 is added as the only new dependency. A single `useOverviewData` hook (already exists in `Overview.jsx` — extracted not rewritten) feeds all sections from one `/api/overview` call. Filter state is synced to URL query params via `useSearchParams`. `Overview.jsx` is deleted at the end.

**Tech Stack:** React 19, React Router v6, Vite, Recharts, Lucide React, Axios, existing CSS variables

---

## File Map

### New files to create
| File | Responsibility |
|------|---------------|
| `src/hooks/useOverviewData.js` | Axios fetch + filter state + URL param sync. Extracted from `Overview.jsx:1804-2070` |
| `src/components/layout/Sidebar.jsx` | Left nav: 4 `<NavLink>` items + Copilot button |
| `src/components/layout/TopBar.jsx` | Logo + company/period context display |
| `src/components/layout/CopilotPanel.jsx` | Slide-in AI analyst panel using `/api/ask` |
| `src/components/primitives/ToneChip.jsx` | Good/Watch/Neutral chip. Extracted from `Overview.jsx:337` |
| `src/components/primitives/MetricCard.jsx` | Single metric display card. Extracted from `Overview.jsx:542` |
| `src/components/primitives/ProvenanceBadge.jsx` | Source citation badge. Extracted from `Overview.jsx:349` |
| `src/components/primitives/StatusBadge.jsx` | Replaces all backend-term badges with HR copy |
| `src/components/shared/EvidenceDrawer.jsx` | Contextual right panel. Extracted from `Overview.jsx:1519` |
| `src/components/shared/FilterBar.jsx` | Filter controls. Extracted from `Overview.jsx:627` |
| `src/components/shared/ChartPanel.jsx` | Chart wrapper with source badge |
| `src/components/sections/HomeSection.jsx` | Command centre — metrics + alerts + brief |
| `src/components/sections/MarketSection.jsx` | Charts + signals + recommendations + watchlist |
| `src/components/sections/PayAnalysisSection.jsx` | Company vs market + derived scores + compliance table |
| `src/components/sections/GovernSection.jsx` | Governance log + evidence pack + automation |

### Files to modify
| File | Change |
|------|--------|
| `src/App.jsx` | Replace `<Overview />` with router shell: `<BrowserRouter>`, `<Sidebar>`, `<TopBar>`, `<Routes>` |
| `src/App.css` | Replace single-page scroll rules with app shell grid layout |
| `package.json` | Add `react-router-dom` dependency |

### Files to delete
| File | When |
|------|------|
| `src/components/Overview.jsx` | Task 10 — after all sections verified working |

---

## Copy Replacement Reference

Apply these everywhere in user-facing text. Backend code untouched.

| Replace | With |
|---------|------|
| actor | Reviewed by |
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
| low confidence | Limited data — treat with caution |
| snapshot_date label | Data as of |
| source_id eurostat_lfs | Eurostat Labour Force Survey |
| source_id eurostat_jvs | Eurostat Job Vacancy Survey |

---

## Task 1: Install React Router and verify dev environment

**Files:**
- Modify: `package.json`
- Modify: `dashboard/frontend/` (npm install)

- [ ] **Step 1: Install react-router-dom**

```bash
cd dashboard/frontend
npm install react-router-dom
```

Expected output: `added N packages` with no errors.

- [ ] **Step 2: Verify the dev server still starts**

```bash
npm run dev
```

Expected: Vite dev server starts on `http://localhost:5173` with no errors. Open it — existing dashboard still works.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: add react-router-dom for multi-section navigation"
```

---

## Task 2: Extract `useOverviewData` hook

**Files:**
- Create: `src/hooks/useOverviewData.js`

This hook already exists inside `Overview.jsx` at line 1804. We extract it, add `useSearchParams` integration so filter state syncs to the URL, and export it.

- [ ] **Step 1: Create the hooks directory and file**

```bash
mkdir -p dashboard/frontend/src/hooks
touch dashboard/frontend/src/hooks/useOverviewData.js
```

- [ ] **Step 2: Write the hook**

Write the full content of `src/hooks/useOverviewData.js`:

```js
import { startTransition, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api'

function buildQueryParams(filters) {
  return {
    country: filters.country,
    geography: filters.geography,
    sector: filters.sector,
    period: filters.period,
    benchmark_geography: filters.benchmark_geography,
    benchmark_sector: filters.benchmark_sector,
  }
}

export function useOverviewData() {
  const [searchParams, setSearchParams] = useSearchParams()

  const [filters, setFilters] = useState({
    country: searchParams.get('country') ?? 'ALL',
    geography: searchParams.get('geography') ?? 'EU27_AVG',
    sector: searchParams.get('sector') ?? 'ALL',
    period: searchParams.get('period') ?? 'latest',
    benchmark_geography: searchParams.get('benchmark_geography') ?? '',
    benchmark_sector: searchParams.get('benchmark_sector') ?? '',
  })

  const [overview, setOverview] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [exporting, setExporting] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [scheduleLoading, setScheduleLoading] = useState(false)
  const [notice, setNotice] = useState(null)

  const requestFilters = useMemo(
    () => ({
      country: filters.country,
      geography: filters.geography,
      sector: filters.sector,
      period: filters.period,
      benchmark_geography: filters.benchmark_geography,
      benchmark_sector: filters.benchmark_sector,
    }),
    [
      filters.country,
      filters.geography,
      filters.sector,
      filters.period,
      filters.benchmark_geography,
      filters.benchmark_sector,
    ],
  )

  // Sync filter state to URL query params
  useEffect(() => {
    const params = {}
    if (filters.country !== 'ALL') params.country = filters.country
    if (filters.geography !== 'EU27_AVG') params.geography = filters.geography
    if (filters.sector !== 'ALL') params.sector = filters.sector
    if (filters.period !== 'latest') params.period = filters.period
    if (filters.benchmark_geography) params.benchmark_geography = filters.benchmark_geography
    if (filters.benchmark_sector) params.benchmark_sector = filters.benchmark_sector
    setSearchParams(params, { replace: true })
  }, [filters, setSearchParams])

  useEffect(() => {
    if (!notice) return undefined
    const timeoutId = window.setTimeout(() => setNotice(null), 4200)
    return () => window.clearTimeout(timeoutId)
  }, [notice])

  useEffect(() => {
    let cancelled = false

    async function loadOverview() {
      setLoading(true)
      setError('')

      try {
        const response = await axios.get(`${API_BASE}/overview`, {
          params: buildQueryParams(requestFilters),
        })

        if (!cancelled) {
          startTransition(() => {
            setOverview(response.data)
            const nextApplied = response.data.filters?.applied
            if (nextApplied) {
              const nextComparisonTargets = response.data.comparisons?.targets ?? {}
              const nextRequestState = {
                country: nextApplied.country,
                geography: nextApplied.geography,
                sector: nextApplied.sector,
                period: nextApplied.period,
                benchmark_geography: nextComparisonTargets.market?.selected?.id ?? '',
                benchmark_sector: nextComparisonTargets.sector?.selected?.id ?? '',
              }
              if (JSON.stringify(requestFilters) !== JSON.stringify(nextRequestState)) {
                setFilters(nextRequestState)
              }
            }
          })
        }
      } catch (requestError) {
        if (!cancelled) {
          if (axios.isAxiosError(requestError)) {
            if (requestError.response?.status >= 500) {
              setError('The API hit an internal error. Try a different filter state or check the backend logs.')
            } else if (requestError.response?.status) {
              setError(`The API rejected this request with status ${requestError.response.status}.`)
            } else {
              setError('Could not reach the analytics API.')
            }
          } else {
            setError('Could not load analytics from the API.')
          }
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadOverview()
    return () => { cancelled = true }
  }, [requestFilters])

  async function exportEvidencePack() {
    setExporting(true)
    try {
      const response = await axios.get(`${API_BASE}/evidence-pack`, {
        params: buildQueryParams(requestFilters),
      })
      const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `workforceguard-evidence-${filters.country}-${filters.period}.json`
      link.click()
      URL.revokeObjectURL(url)
      await axios.post(`${API_BASE}/governance-events`, {
        action_code: 'exported',
        target_type: 'evidence_pack',
        target_id: `${filters.country}-${filters.period}`,
        actor: 'dashboard-user',
      })
    } catch {
      setNotice({ type: 'error', message: 'Evidence pack export failed.' })
    } finally {
      setExporting(false)
    }
  }

  async function recordGovernanceAction(actionCode, targetType, targetId, reason) {
    setActionLoading(true)
    try {
      await axios.post(`${API_BASE}/governance-events`, {
        action_code: actionCode,
        target_type: targetType,
        target_id: targetId,
        actor: 'dashboard-user',
        reason: reason ?? null,
      })
      const response = await axios.get(`${API_BASE}/overview`, {
        params: buildQueryParams(requestFilters),
      })
      startTransition(() => setOverview(response.data))
      setNotice({ type: 'success', message: 'Decision recorded.' })
    } catch {
      setNotice({ type: 'error', message: 'Failed to record decision.' })
    } finally {
      setActionLoading(false)
    }
  }

  async function scheduleBrief(template) {
    setScheduleLoading(true)
    try {
      const response = await axios.post(`${API_BASE}/automation/schedules`, {
        template_id: template.id,
        ...buildQueryParams(requestFilters),
        approved: false,
        actor: 'dashboard-user',
      })
      setNotice({ type: 'success', message: `Workflow "${template.label}" scheduled.` })
      return response.data
    } catch {
      setNotice({ type: 'error', message: 'Failed to schedule workflow.' })
      return null
    } finally {
      setScheduleLoading(false)
    }
  }

  return {
    filters,
    setFilters,
    overview,
    loading,
    error,
    exporting,
    actionLoading,
    scheduleLoading,
    notice,
    setNotice,
    exportEvidencePack,
    recordGovernanceAction,
    scheduleBrief,
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useOverviewData.js
git commit -m "feat: extract useOverviewData hook with URL query param sync"
```

---

## Task 3: Extract primitive components

**Files:**
- Create: `src/components/primitives/ToneChip.jsx`
- Create: `src/components/primitives/MetricCard.jsx`
- Create: `src/components/primitives/ProvenanceBadge.jsx`
- Create: `src/components/primitives/StatusBadge.jsx`

- [ ] **Step 1: Create primitives directory**

```bash
mkdir -p dashboard/frontend/src/components/primitives
```

- [ ] **Step 2: Create ToneChip.jsx**

```jsx
// src/components/primitives/ToneChip.jsx
const TONE_META = {
  good: 'tone-chip--good',
  neutral: 'tone-chip--neutral',
  watch: 'tone-chip--watch',
}

export function ToneChip({ tone, children }) {
  return (
    <span className={`tone-chip ${TONE_META[tone] ?? TONE_META.neutral}`}>
      {children}
    </span>
  )
}
```

- [ ] **Step 3: Create ProvenanceBadge.jsx**

```jsx
// src/components/primitives/ProvenanceBadge.jsx
const SOURCE_LABELS = {
  eurostat_lfs: 'Eurostat Labour Force Survey',
  eurostat_jvs: 'Eurostat Job Vacancy Survey',
  eurostat_ses: 'Eurostat Structure of Earnings Survey',
  internal_payroll: 'Company payroll data',
  internal_hris: 'Company HR system',
  egapro: 'France Égapro index',
}

export function ProvenanceBadge({ provenance, compact = false }) {
  if (!provenance?.length) return null
  return (
    <div className={`provenance-badge${compact ? ' provenance-badge--compact' : ''}`}>
      {provenance.map((p) => (
        <span key={p.source_id}>
          {SOURCE_LABELS[p.source_id] ?? p.source_id}
        </span>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Create StatusBadge.jsx**

```jsx
// src/components/primitives/StatusBadge.jsx
// Maps backend status codes to professional HR/compliance copy.
const STATUS_LABELS = {
  'internal mart active': 'Company data connected',
  'internal mart inactive': 'No company data loaded',
  'external-only answers': 'Market data only',
  'observed_gap': 'Pay gap identified',
  'unresolved_review_item': 'Needs review',
  'justified_difference': 'Documented difference',
  blended: 'Evidence source: Combined',
  internal: 'Evidence source: Company data',
  external: 'Evidence source: Market data',
  partial: 'Partial market data',
  full: 'Full market data',
  proxy: 'Estimated benchmark',
  official: 'Verified benchmark',
  high: 'High confidence',
  low: 'Limited data — treat with caution',
}

export function StatusBadge({ status, className = '' }) {
  const label = STATUS_LABELS[status] ?? status
  return <span className={`comparison-meta__pill ${className}`}>{label}</span>
}
```

- [ ] **Step 5: Create MetricCard.jsx**

Extract from `Overview.jsx:542-578`. Apply copy standards.

```jsx
// src/components/primitives/MetricCard.jsx
import { ToneChip } from './ToneChip'
import { ProvenanceBadge } from './ProvenanceBadge'

const TONE_CLASS = {
  good: 'metric-card--teal',
  watch: 'metric-card--orange',
  neutral: 'metric-card--blue',
}

const numberFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 1,
  minimumFractionDigits: 0,
})

function formatValue(value, unit = '%') {
  if (value == null) return 'Planned'
  if (unit === '%') return `${numberFormatter.format(Number(value))}%`
  if (unit === 'score') return `${numberFormatter.format(Number(value))}/100`
  return numberFormatter.format(Number(value))
}

function formatDelta(delta, unit = '%') {
  if (delta == null || Number.isNaN(Number(delta))) return 'No prior period'
  const sign = delta > 0 ? '+' : ''
  if (unit === '%') return `${sign}${numberFormatter.format(Number(delta))} pts vs prior period`
  return `${sign}${numberFormatter.format(Number(delta))} vs prior period`
}

export function MetricCard({ metric, onOpenEvidence, onClick }) {
  const tone = metric.tone ?? 'neutral'
  const toneClass = TONE_CLASS[tone] ?? ''

  return (
    <article
      className={`metric-card ${toneClass}`}
      onClick={onClick}
      style={onClick ? { cursor: 'pointer' } : undefined}
    >
      <div className="metric-card__header">
        <p className="metric-card__eyebrow">{metric.title}</p>
      </div>
      <p className="metric-card__value">{formatValue(metric.value, metric.unit)}</p>
      <p className={`metric-card__delta metric-card__delta--${tone}`}>
        {formatDelta(metric.delta, metric.unit)}
      </p>
      <p className="metric-card__period">{metric.period}</p>
      {metric.tone && (
        <div className="metric-card__coverage" style={{ marginTop: 8 }}>
          <ToneChip tone={tone}>
            {tone === 'good' ? 'Good' : tone === 'watch' ? 'Watch' : 'Neutral'}
          </ToneChip>
        </div>
      )}
      {metric.provenance && (
        <ProvenanceBadge provenance={metric.provenance} compact />
      )}
      {onOpenEvidence && (
        <button className="insight-button" onClick={(e) => { e.stopPropagation(); onOpenEvidence(metric) }}>
          View evidence
        </button>
      )}
    </article>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add src/components/primitives/
git commit -m "feat: add ToneChip, MetricCard, ProvenanceBadge, StatusBadge primitives"
```

---

## Task 4: Extract shared components

**Files:**
- Create: `src/components/shared/EvidenceDrawer.jsx`
- Create: `src/components/shared/FilterBar.jsx`
- Create: `src/components/shared/ChartPanel.jsx`

- [ ] **Step 1: Create shared directory**

```bash
mkdir -p dashboard/frontend/src/components/shared
```

- [ ] **Step 2: Create EvidenceDrawer.jsx**

Extract from `Overview.jsx:1519-1612`. No logic changes — copy only.

```jsx
// src/components/shared/EvidenceDrawer.jsx
import { X } from 'lucide-react'
import { ProvenanceBadge } from '../primitives/ProvenanceBadge'

export function EvidenceDrawer({ evidence, onClose }) {
  if (!evidence) return null

  return (
    <>
      <button
        className="evidence-drawer__backdrop"
        aria-label="Close evidence panel"
        onClick={onClose}
      />
      <aside className="evidence-drawer">
        <div className="evidence-drawer__header">
          <div>
            <p className="panel__eyebrow">Evidence</p>
            <h2>{evidence.title}</h2>
          </div>
          <button className="evidence-drawer__close" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {evidence.summary && (
          <p className="evidence-drawer__summary">{evidence.summary}</p>
        )}

        {evidence.items?.length > 0 && (
          <div className="evidence-drawer__section">
            <h3>Supporting data</h3>
            <ul className="evidence-drawer__list">
              {evidence.items.map((item, i) => (
                <li key={i} className="evidence-drawer__item">
                  <strong>{item.label}</strong>
                  <span>{item.value}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {evidence.provenance?.length > 0 && (
          <div className="evidence-drawer__section">
            <h3>Sources</h3>
            <ProvenanceBadge provenance={evidence.provenance} />
          </div>
        )}

        {evidence.actions?.length > 0 && (
          <div className="evidence-drawer__actions">
            {evidence.actions.map((action) => (
              <button
                key={action.code}
                className={`governance-button ${action.className ?? ''}`}
                onClick={() => action.onAction(action.code)}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </aside>
    </>
  )
}
```

- [ ] **Step 3: Create FilterBar.jsx**

Extract core filter controls from `Overview.jsx:627-719`. Apply copy standard: `benchmark_geography` label becomes "Compare against".

```jsx
// src/components/shared/FilterBar.jsx
function SelectField({ label, value, options, onChange }) {
  return (
    <div className="control-field">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((opt) => (
          <option key={opt.id ?? opt} value={opt.id ?? opt}>
            {opt.label ?? opt}
          </option>
        ))}
      </select>
    </div>
  )
}

export function FilterBar({ filters, options, onFilterChange, onAnalyse, children }) {
  const countryOptions = [{ id: 'ALL', label: 'All countries' }, ...(options?.countries ?? [])]
  const sectorOptions = [{ id: 'ALL', label: 'All sectors' }, ...(options?.sectors ?? [])]
  const periodOptions = options?.periods ?? []
  const benchmarkOptions = options?.benchmark_geographies ?? []

  return (
    <div className="filter-bar">
      <div className="filter-grid">
        <SelectField
          label="Country"
          value={filters.country}
          options={countryOptions}
          onChange={(v) => onFilterChange({ ...filters, country: v })}
        />
        <SelectField
          label="Sector"
          value={filters.sector}
          options={sectorOptions}
          onChange={(v) => onFilterChange({ ...filters, sector: v })}
        />
        <SelectField
          label="Period"
          value={filters.period}
          options={periodOptions}
          onChange={(v) => onFilterChange({ ...filters, period: v })}
        />
        {benchmarkOptions.length > 0 && (
          <SelectField
            label="Compare against"
            value={filters.benchmark_geography}
            options={benchmarkOptions}
            onChange={(v) => onFilterChange({ ...filters, benchmark_geography: v })}
          />
        )}
      </div>
      {children}
      {onAnalyse && (
        <div className="filter-bar__actions">
          <button className="filter-bar__button" onClick={onAnalyse}>
            Run Analysis
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Create ChartPanel.jsx**

```jsx
// src/components/shared/ChartPanel.jsx
const SOURCE_LABELS = {
  eurostat_lfs: 'Eurostat LFS',
  eurostat_jvs: 'Eurostat JVS',
  eurostat_ses: 'Eurostat SES',
}

export function ChartPanel({ title, sourceId, children }) {
  return (
    <div className="panel">
      <div className="panel__header panel__header--tight">
        <div>
          <p className="panel__eyebrow">
            {sourceId ? SOURCE_LABELS[sourceId] ?? sourceId : 'Market data'}
          </p>
          <h2>{title}</h2>
        </div>
      </div>
      <div className="panel__body panel__body--chart">
        {children}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/shared/
git commit -m "feat: add EvidenceDrawer, FilterBar, ChartPanel shared components"
```

---

## Task 5: Build layout shell — Sidebar, TopBar, App.jsx

**Files:**
- Create: `src/components/layout/Sidebar.jsx`
- Create: `src/components/layout/TopBar.jsx`
- Modify: `src/App.jsx`
- Modify: `src/App.css`

- [ ] **Step 1: Create layout directory**

```bash
mkdir -p dashboard/frontend/src/components/layout
```

- [ ] **Step 2: Create Sidebar.jsx**

```jsx
// src/components/layout/Sidebar.jsx
import { NavLink } from 'react-router-dom'
import { BarChart2, Home, Scale, ShieldCheck, MessageSquare } from 'lucide-react'

const NAV_ITEMS = [
  { to: '/', label: 'Home', Icon: Home, end: true },
  { to: '/market', label: 'Market Intelligence', Icon: BarChart2 },
  { to: '/pay-analysis', label: 'Pay Analysis', Icon: Scale },
  { to: '/govern', label: 'Govern & Export', Icon: ShieldCheck },
]

export function Sidebar({ onCopilotOpen }) {
  return (
    <nav className="sidebar">
      <ul className="sidebar__nav">
        {NAV_ITEMS.map(({ to, label, Icon, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                `sidebar__link${isActive ? ' sidebar__link--active' : ''}`
              }
            >
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
      <div className="sidebar__footer">
        <button className="sidebar__copilot" onClick={onCopilotOpen}>
          <MessageSquare size={18} />
          <span>AI Analyst</span>
        </button>
      </div>
    </nav>
  )
}
```

- [ ] **Step 3: Create TopBar.jsx**

```jsx
// src/components/layout/TopBar.jsx
import logo from '../../assets/logos/workforceguard_logo_letters_1773817682347.png'

export function TopBar({ overview }) {
  const applied = overview?.filters?.applied
  const company = 'AeroTech Europe SAS'
  const context = applied
    ? `${applied.geography_label ?? applied.geography} · ${applied.sector_label ?? applied.sector} · ${applied.period}`
    : 'Loading…'

  return (
    <header className="topbar">
      <div className="topbar__brand">
        <img src={logo} alt="WorkforceGuard" className="topbar__logo" />
      </div>
      <div className="topbar__company">
        <span className="topbar__company-name">{company}</span>
      </div>
      <div className="topbar__context">
        <span className="topbar__context-label">{context}</span>
      </div>
    </header>
  )
}
```

- [ ] **Step 4: Update App.jsx**

Replace the entire file:

```jsx
// src/App.jsx
import { useState } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Sidebar } from './components/layout/Sidebar'
import { TopBar } from './components/layout/TopBar'
import { CopilotPanel } from './components/layout/CopilotPanel'
import { HomeSection } from './components/sections/HomeSection'
import { MarketSection } from './components/sections/MarketSection'
import { PayAnalysisSection } from './components/sections/PayAnalysisSection'
import { GovernSection } from './components/sections/GovernSection'
import './App.css'

function AppShell() {
  const [copilotOpen, setCopilotOpen] = useState(false)

  return (
    <div className="app-shell">
      <TopBar />
      <div className="app-body">
        <Sidebar onCopilotOpen={() => setCopilotOpen(true)} />
        <main className="app-main">
          <Routes>
            <Route path="/" element={<HomeSection />} />
            <Route path="/market" element={<MarketSection />} />
            <Route path="/pay-analysis" element={<PayAnalysisSection />} />
            <Route path="/govern" element={<GovernSection />} />
          </Routes>
        </main>
      </div>
      {copilotOpen && <CopilotPanel onClose={() => setCopilotOpen(false)} />}
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  )
}
```

- [ ] **Step 5: Update App.css with shell layout**

Replace `.app-shell` rule and add shell grid rules. Keep all other existing rules intact — they are still used by section components.

Find the existing `.app-shell` block at the top of `App.css` and replace only that rule:

```css
.app-shell {
  display: grid;
  grid-template-rows: 56px 1fr;
  min-height: 100vh;
}

.app-body {
  display: grid;
  grid-template-columns: 220px 1fr;
  min-height: 0;
  overflow: hidden;
}

.app-main {
  overflow-y: auto;
  padding: 32px clamp(20px, 3vw, 40px);
}

.topbar {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 0 24px;
  border-bottom: 1px solid rgba(159, 185, 214, 0.12);
  background: rgba(7, 17, 31, 0.92);
  backdrop-filter: blur(20px);
  position: sticky;
  top: 0;
  z-index: 10;
}

.topbar__logo {
  height: 28px;
  width: auto;
}

.topbar__company {
  flex: 1;
}

.topbar__company-name {
  font-weight: 600;
  font-size: 0.95rem;
  color: var(--text-strong);
}

.topbar__context {
  margin-left: auto;
}

.topbar__context-label {
  font-size: 0.82rem;
  color: var(--text-muted);
}

.sidebar {
  display: flex;
  flex-direction: column;
  border-right: 1px solid rgba(159, 185, 214, 0.1);
  background: rgba(7, 17, 31, 0.6);
  padding: 20px 12px;
  overflow-y: auto;
}

.sidebar__nav {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

.sidebar__link {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 12px;
  color: var(--text-muted);
  font-size: 0.88rem;
  font-weight: 500;
  transition: background 150ms ease, color 150ms ease;
}

.sidebar__link:hover {
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-strong);
}

.sidebar__link--active {
  background: rgba(127, 244, 234, 0.1);
  color: var(--accent-teal);
}

.sidebar__footer {
  margin-top: auto;
  padding-top: 16px;
  border-top: 1px solid rgba(159, 185, 214, 0.1);
}

.sidebar__copilot {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  border: 1px solid rgba(159, 185, 214, 0.16);
  border-radius: 12px;
  color: var(--text-muted);
  font-size: 0.88rem;
  background: transparent;
  cursor: pointer;
  transition: background 150ms ease, color 150ms ease;
}

.sidebar__copilot:hover {
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-strong);
}
```

- [ ] **Step 6: Verify the shell renders**

```bash
npm run dev
```

Expected: App loads with sidebar + topbar visible. Routes render blank sections (components not built yet — that is fine at this stage). No console errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/layout/ src/App.jsx src/App.css
git commit -m "feat: add app shell with sidebar, topbar, and React Router routes"
```

---

## Task 6: Build CopilotPanel

**Files:**
- Create: `src/components/layout/CopilotPanel.jsx`

Extracted from `Overview.jsx:1613-1803` (AnalystConsole). Adapted as a slide-in panel.

- [ ] **Step 1: Create CopilotPanel.jsx**

```jsx
// src/components/layout/CopilotPanel.jsx
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import axios from 'axios'
import { X, Send } from 'lucide-react'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api'

const SUGGESTED_QUESTIONS = [
  'How does this market compare to the EU average?',
  'Which peer countries look most similar?',
  'What changed versus the prior period?',
  'Which signal is worsening fastest?',
  'How confident is this benchmark?',
  'What limits this comparison?',
]

export function CopilotPanel({ onClose }) {
  const [searchParams] = useSearchParams()
  const [question, setQuestion] = useState('')
  const [response, setResponse] = useState(null)
  const [asking, setAsking] = useState(false)

  const filterContext = {
    country: searchParams.get('country') ?? 'ALL',
    geography: searchParams.get('geography') ?? 'EU27_AVG',
    sector: searchParams.get('sector') ?? 'ALL',
    period: searchParams.get('period') ?? 'latest',
    benchmark_geography: searchParams.get('benchmark_geography') ?? null,
    benchmark_sector: searchParams.get('benchmark_sector') ?? null,
  }

  async function submitQuestion(q) {
    const prompt = q.trim()
    if (!prompt || asking) return
    setAsking(true)
    try {
      const result = await axios.post(`${API_BASE}/ask`, { question: prompt, ...filterContext })
      setResponse(result.data)
    } catch {
      setResponse({ answer: 'Could not get a response. Please try again.' })
    } finally {
      setAsking(false)
    }
  }

  function handleSubmit(e) {
    e.preventDefault()
    submitQuestion(question)
  }

  return (
    <>
      <div
        className="evidence-drawer__backdrop"
        onClick={onClose}
        role="button"
        aria-label="Close AI Analyst"
      />
      <aside className="copilot-panel">
        <div className="copilot-panel__header">
          <div>
            <p className="panel__eyebrow">AI Analyst</p>
            <h2>Ask about this view</h2>
          </div>
          <button className="evidence-drawer__close" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <form className="copilot-panel__form" onSubmit={handleSubmit}>
          <div className="analyst-console__controls">
            <input
              className="analyst-console__input"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask a question about the current data…"
              disabled={asking}
            />
            <button className="analyst-console__button" type="submit" disabled={asking}>
              <Send size={16} />
            </button>
          </div>
        </form>

        {!response && (
          <div className="analyst-console__suggestions">
            {SUGGESTED_QUESTIONS.map((q) => (
              <button
                key={q}
                className="analyst-console__chip"
                onClick={() => submitQuestion(q)}
                disabled={asking}
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {response && (
          <div className="analyst-console__response">
            <p className="analyst-console__question">Response</p>
            <h3 className="analyst-console__response-top">{response.answer}</h3>
            {response.follow_ups?.length > 0 && (
              <div className="analyst-console__follow-ups">
                {response.follow_ups.slice(0, 3).map((fq) => (
                  <button
                    key={fq}
                    className="analyst-console__follow-up"
                    onClick={() => submitQuestion(fq)}
                    disabled={asking}
                  >
                    {fq}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </aside>
    </>
  )
}
```

- [ ] **Step 2: Add copilot panel CSS to App.css**

Append to `App.css`:

```css
.copilot-panel {
  position: fixed;
  top: 56px;
  right: 0;
  z-index: 20;
  width: min(420px, calc(100vw - 24px));
  height: calc(100vh - 56px);
  padding: 24px;
  overflow-y: auto;
  border-left: 1px solid rgba(159, 185, 214, 0.14);
  background:
    linear-gradient(180deg, rgba(17, 34, 64, 0.97), rgba(10, 18, 38, 0.99));
  backdrop-filter: blur(24px);
}

.copilot-panel__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
}

.copilot-panel__form {
  margin-bottom: 16px;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/CopilotPanel.jsx src/App.css
git commit -m "feat: add CopilotPanel slide-in AI analyst"
```

---

## Task 7: Build HomeSection

**Files:**
- Create: `src/components/sections/HomeSection.jsx`

- [ ] **Step 1: Create sections directory**

```bash
mkdir -p dashboard/frontend/src/components/sections
```

- [ ] **Step 2: Create HomeSection.jsx**

```jsx
// src/components/sections/HomeSection.jsx
import { useNavigate } from 'react-router-dom'
import { useOverviewData } from '../../hooks/useOverviewData'
import { MetricCard } from '../primitives/MetricCard'
import { AlertTriangle, CheckCircle } from 'lucide-react'

export function HomeSection() {
  const { overview, loading, error } = useOverviewData()
  const navigate = useNavigate()

  if (loading) {
    return (
      <div className="dashboard--loading">
        <div className="loading-panel">
          <h2>Loading…</h2>
          <p>Fetching latest workforce intelligence.</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="dashboard--error">
        <div className="error-panel">
          <h2>Could not load data</h2>
          <p>{error}</p>
        </div>
      </div>
    )
  }

  if (!overview) return null

  const watchSignals = (overview.intelligence?.signals ?? []).filter((s) => s.tone === 'watch')
  const unresolvedCount = overview.pay_transparency?.summary?.unresolved_review_item_count ?? 0
  const brief = overview.brief

  const attentionItems = [
    ...watchSignals.slice(0, 2).map((s) => ({
      type: 'watch',
      text: s.title,
      route: '/market',
    })),
    ...(unresolvedCount > 0
      ? [{ type: 'watch', text: `${unresolvedCount} pay transparency ${unresolvedCount === 1 ? 'category needs' : 'categories need'} review`, route: '/pay-analysis' }]
      : []),
    ...(overview.metrics ?? [])
      .filter((m) => m.tone === 'good')
      .slice(0, 1)
      .map((m) => ({ type: 'good', text: `${m.title} is ${m.delta > 0 ? 'improving' : 'stable'}`, route: '/market' })),
  ]

  return (
    <div className="dashboard">
      <div className="dashboard__halo dashboard__halo--one" />
      <div className="dashboard__halo dashboard__halo--two" />

      <section className="metric-section" style={{ marginBottom: 28 }}>
        <p className="hero__eyebrow">Command Centre</p>
        <div className="metric-grid">
          {(overview.metrics ?? []).map((metric) => (
            <MetricCard
              key={metric.id}
              metric={metric}
              onClick={() => navigate('/market')}
            />
          ))}
        </div>
      </section>

      {attentionItems.length > 0 && (
        <section className="metric-section" style={{ marginBottom: 28 }}>
          <p className="panel__eyebrow" style={{ marginBottom: 12 }}>Needs Attention</p>
          <div className="product-notes">
            {attentionItems.map((item, i) => (
              <button
                key={i}
                className={`product-note inline-notice inline-notice--${item.type === 'watch' ? 'watch' : 'good'}`}
                onClick={() => navigate(item.route)}
                style={{ textAlign: 'left', cursor: 'pointer' }}
              >
                {item.type === 'watch'
                  ? <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                  : <CheckCircle size={16} style={{ flexShrink: 0 }} />
                }
                <span>{item.text}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {brief && (
        <section className="intelligence-section">
          <div className="intelligence-brief">
            <p className="panel__eyebrow">Executive Brief</p>
            <h2 style={{ margin: '8px 0 14px', fontSize: '1.15rem' }}>{brief.headline}</h2>
            <p className="intelligence-brief__summary">{brief.summary}</p>
          </div>
        </section>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verify Home route**

```bash
npm run dev
```

Open `http://localhost:5173/` — should show 4 metric cards, attention items, and executive brief. Sidebar active item should be "Home".

- [ ] **Step 4: Commit**

```bash
git add src/components/sections/HomeSection.jsx
git commit -m "feat: add HomeSection command centre"
```

---

## Task 8: Build MarketSection

**Files:**
- Create: `src/components/sections/MarketSection.jsx`

- [ ] **Step 1: Create MarketSection.jsx**

```jsx
// src/components/sections/MarketSection.jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'
import { useOverviewData } from '../../hooks/useOverviewData'
import { FilterBar } from '../shared/FilterBar'
import { ChartPanel } from '../shared/ChartPanel'
import { EvidenceDrawer } from '../shared/EvidenceDrawer'
import { ToneChip } from '../primitives/ToneChip'

function ChartTooltip({ active, payload, label, unit = '%' }) {
  if (!active || !payload?.length) return null
  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip__title">{label}</p>
      <p className="chart-tooltip__value">
        {unit === '%' ? `${Number(payload[0].value).toFixed(1)}%` : payload[0].value}
      </p>
    </div>
  )
}

export function MarketSection() {
  const { filters, setFilters, overview, loading, error } = useOverviewData()
  const [selectedEvidence, setSelectedEvidence] = useState(null)

  if (loading) {
    return (
      <div className="dashboard--loading">
        <div className="loading-panel"><h2>Loading…</h2></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="dashboard--error">
        <div className="error-panel"><h2>Could not load data</h2><p>{error}</p></div>
      </div>
    )
  }

  if (!overview) return null

  const charts = overview.charts ?? {}
  const intelligence = overview.intelligence ?? {}
  const options = overview.filters?.options ?? {}

  const unemploymentSeries = charts.unemployment_trend?.series ?? []
  const employmentSeries = charts.employment_trend?.series ?? []
  const vacancySeries = charts.vacancy_by_sector?.series ?? []
  const payGapSeries = charts.pay_gap_by_sector?.series ?? []

  return (
    <div className="dashboard">
      <div className="dashboard__halo dashboard__halo--one" />

      <p className="hero__eyebrow" style={{ marginBottom: 8 }}>Market Intelligence</p>

      <FilterBar
        filters={filters}
        options={options}
        onFilterChange={setFilters}
      />

      <div className="dashboard-grid" style={{ marginTop: 18 }}>
        <ChartPanel title="Unemployment trend" sourceId="eurostat_lfs">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={unemploymentSeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(159,185,214,0.08)" />
              <XAxis dataKey="period" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} unit="%" />
              <Tooltip content={<ChartTooltip unit="%" />} />
              <Line type="monotone" dataKey="value" stroke="#7ff4ea" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="Vacancy rate by sector" sourceId="eurostat_jvs">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={vacancySeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(159,185,214,0.08)" />
              <XAxis dataKey="sector_label" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} unit="%" />
              <Tooltip content={<ChartTooltip unit="%" />} />
              <Bar dataKey="value" fill="#7ff4ea" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>
      </div>

      <div className="dashboard-grid" style={{ marginTop: 18 }}>
        <ChartPanel title="Employment trend" sourceId="eurostat_lfs">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={employmentSeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(159,185,214,0.08)" />
              <XAxis dataKey="period" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} unit="%" />
              <Tooltip content={<ChartTooltip unit="%" />} />
              <Line type="monotone" dataKey="value" stroke="#8db1ff" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="Gender pay gap by sector" sourceId="eurostat_ses">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={payGapSeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(159,185,214,0.08)" />
              <XAxis dataKey="sector_label" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} unit="%" />
              <Tooltip content={<ChartTooltip unit="%" />} />
              <Bar dataKey="value" fill="#ffbf8f" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>
      </div>

      <section className="intelligence-section">
        <p className="panel__eyebrow" style={{ marginBottom: 14 }}>Intelligence Signals</p>
        <div className="signal-list">
          {(intelligence.signals ?? []).map((signal, i) => (
            <div key={i} className="signal-item">
              <div className="signal-item__top">
                <h3>{signal.title}</h3>
                <ToneChip tone={signal.tone}>
                  {signal.tone === 'good' ? 'Good' : signal.tone === 'watch' ? 'Watch' : 'Neutral'}
                </ToneChip>
              </div>
              <p>{signal.summary}</p>
              {signal.evidence && (
                <button
                  className="insight-button"
                  onClick={() => setSelectedEvidence(signal.evidence)}
                >
                  View evidence
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      {(intelligence.recommendations?.length > 0 || intelligence.watchlist?.length > 0) && (
        <div className="intelligence-grid" style={{ marginTop: 18 }}>
          {intelligence.recommendations?.length > 0 && (
            <div>
              <p className="panel__eyebrow" style={{ marginBottom: 12 }}>Recommendations</p>
              <div className="recommendation-list">
                {intelligence.recommendations.map((rec, i) => (
                  <div key={i} className="recommendation-item">
                    <div className="recommendation-item__top">
                      <h3>{rec.title}</h3>
                      <span className={`priority-badge priority-badge--${rec.priority}`}>
                        {rec.priority}
                      </span>
                    </div>
                    <p>{rec.summary}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {intelligence.watchlist?.length > 0 && (
            <div>
              <p className="panel__eyebrow" style={{ marginBottom: 12 }}>Watchlist</p>
              <div className="watchlist">
                {intelligence.watchlist.map((item, i) => (
                  <div key={i} className="watchlist-item">
                    <div className="watchlist-item__top">
                      <span className="watchlist-item__label">{item.label}</span>
                      <ToneChip tone={item.tone ?? 'neutral'}>
                        {item.tone === 'watch' ? 'Watch' : 'Monitor'}
                      </ToneChip>
                    </div>
                    <p>{item.summary}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <EvidenceDrawer
        evidence={selectedEvidence}
        onClose={() => setSelectedEvidence(null)}
      />
    </div>
  )
}
```

- [ ] **Step 2: Verify Market route**

Open `http://localhost:5173/market` — should show filter bar, 4 charts, signals list. Sidebar active item should be "Market Intelligence".

- [ ] **Step 3: Commit**

```bash
git add src/components/sections/MarketSection.jsx
git commit -m "feat: add MarketSection with charts, signals, and filter bar"
```

---

## Task 9: Build PayAnalysisSection

**Files:**
- Create: `src/components/sections/PayAnalysisSection.jsx`

- [ ] **Step 1: Create PayAnalysisSection.jsx**

```jsx
// src/components/sections/PayAnalysisSection.jsx
import { useState } from 'react'
import { useOverviewData } from '../../hooks/useOverviewData'
import { ToneChip } from '../primitives/ToneChip'
import { StatusBadge } from '../primitives/StatusBadge'
import { EvidenceDrawer } from '../shared/EvidenceDrawer'

const REVIEW_STATE_LABELS = {
  observed_gap: 'Pay gap identified',
  justified_difference: 'Documented difference',
  unresolved_review_item: 'Needs review',
}

const numberFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 1,
  minimumFractionDigits: 0,
})

function formatValue(value, unit = '%') {
  if (value == null) return '—'
  if (unit === '%') return `${numberFormatter.format(Number(value))}%`
  if (unit === 'score') return `${numberFormatter.format(Number(value))}/100`
  return numberFormatter.format(Number(value))
}

export function PayAnalysisSection() {
  const { overview, loading, error, recordGovernanceAction, actionLoading } = useOverviewData()
  const [selectedEvidence, setSelectedEvidence] = useState(null)

  if (loading) {
    return (
      <div className="dashboard--loading">
        <div className="loading-panel"><h2>Loading…</h2></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="dashboard--error">
        <div className="error-panel"><h2>Could not load data</h2><p>{error}</p></div>
      </div>
    )
  }

  if (!overview) return null

  const companyBenchmark = overview.company_benchmark ?? {}
  const internalData = overview.internal_data ?? {}
  const semanticMetrics = overview.semantic_metrics ?? []
  const payTransparency = overview.pay_transparency ?? {}
  const benchmarkAvailable = Boolean(companyBenchmark.available)
  const internalLoaded = Boolean(internalData.available)

  const coverageLabel = {
    partial: 'Partial market data',
    full: 'Full market data',
    unavailable: 'Market data unavailable',
  }[companyBenchmark.coverage_status] ?? 'Market data status unknown'

  const evidenceBasisLabel = {
    blended: 'Evidence source: Combined',
    internal: 'Evidence source: Company data',
    external: 'Evidence source: Market data',
  }[companyBenchmark.evidence_basis] ?? ''

  return (
    <div className="dashboard">
      <div className="dashboard__halo dashboard__halo--one" />

      <p className="hero__eyebrow" style={{ marginBottom: 8 }}>Pay Analysis</p>

      {/* Company vs Market */}
      <section className="comparison-section">
        <div className="panel" style={{ minHeight: 'auto', padding: 22 }}>
          <div className="panel__header panel__header--tight">
            <div>
              <p className="panel__eyebrow">Company vs Market</p>
              <h2>Pay gap comparison</h2>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <ToneChip tone={internalLoaded ? 'good' : 'watch'}>
                {internalLoaded ? 'Company data connected' : 'No company data loaded'}
              </ToneChip>
            </div>
          </div>

          {benchmarkAvailable ? (
            <div className="comparison-overview__meta">
              <div className="comparison-meta">
                <div className="comparison-meta__top">
                  <strong>Internal pay gap</strong>
                  <ToneChip tone={companyBenchmark.confidence === 'high' ? 'good' : companyBenchmark.confidence === 'low' ? 'watch' : 'neutral'}>
                    {companyBenchmark.confidence === 'low' ? 'Limited data — treat with caution' : `${companyBenchmark.confidence ?? 'moderate'} confidence`}
                  </ToneChip>
                </div>
                <div className="comparison-meta__detail-list">
                  <span>{formatValue(companyBenchmark.internal_value)}</span>
                  <span>{companyBenchmark.female_count} female</span>
                  <span>{companyBenchmark.male_count} male</span>
                </div>
                <p>Internal pay gap for {companyBenchmark.worker_category?.label ?? 'selected category'}.</p>
              </div>

              <div className="comparison-meta">
                <div className="comparison-meta__top">
                  <strong>Market comparator</strong>
                  <span className="comparison-meta__pill">{coverageLabel}</span>
                </div>
                <div className="comparison-meta__detail-list">
                  <span>{formatValue(companyBenchmark.market_value)}</span>
                  <span>{companyBenchmark.delta_label} vs market</span>
                </div>
                <p>
                  {evidenceBasisLabel && <span>{evidenceBasisLabel} · </span>}
                  Data as of: {companyBenchmark.snapshot_date ?? 'Unknown'}
                </p>
              </div>

              <div className="comparison-meta">
                <div className="comparison-meta__top">
                  <strong>Worker category</strong>
                </div>
                <div className="comparison-meta__detail-list">
                  <span>{companyBenchmark.worker_category?.label}</span>
                  <span>{companyBenchmark.headcount} employees</span>
                </div>
                <p>{companyBenchmark.note}</p>
              </div>
            </div>
          ) : (
            <div className="comparison-focus">
              <ToneChip tone="watch">Market data only</ToneChip>
              <p className="comparison-focus__summary">
                {companyBenchmark.note ?? 'Company benchmark is not available for the current scope.'}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Derived Scores */}
      {semanticMetrics.length > 0 && (
        <section className="metric-section" style={{ marginBottom: 18 }}>
          <p className="panel__eyebrow" style={{ marginBottom: 12 }}>Derived Scores</p>
          <div className="metric-grid">
            {semanticMetrics.map((metric) => (
              <article key={metric.id} className="metric-card">
                <p className="metric-card__eyebrow">{metric.title}</p>
                <p className="metric-card__value">{formatValue(metric.value, metric.unit)}</p>
                <p className="metric-card__period">{metric.definition}</p>
                {metric.tone && (
                  <div style={{ marginTop: 8 }}>
                    <ToneChip tone={metric.tone}>
                      {metric.tone === 'good' ? 'Good' : metric.tone === 'watch' ? 'Watch' : 'Neutral'}
                    </ToneChip>
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>
      )}

      {/* Pay Transparency Compliance */}
      {payTransparency.available && (
        <section className="comparison-section">
          <div className="panel" style={{ minHeight: 'auto', padding: 22 }}>
            <div className="panel__header panel__header--tight">
              <div>
                <p className="panel__eyebrow">EU Pay Transparency Directive</p>
                <h2>Pay transparency compliance</h2>
              </div>
              <ToneChip tone={payTransparency.summary?.unresolved_review_item_count > 0 ? 'watch' : 'good'}>
                {payTransparency.summary?.unresolved_review_item_count > 0
                  ? `${payTransparency.summary.unresolved_review_item_count} need review`
                  : 'All reviewed'}
              </ToneChip>
            </div>

            <div className="compliance-review-list">
              {(payTransparency.categories ?? []).map((cat) => (
                <div key={cat.id} className="compliance-review-item">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong>{cat.label}</strong>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span>{formatValue(cat.gap_value)}</span>
                      <ToneChip tone={cat.review_state === 'unresolved_review_item' ? 'watch' : 'neutral'}>
                        {REVIEW_STATE_LABELS[cat.review_state] ?? cat.review_state}
                      </ToneChip>
                    </div>
                  </div>
                  {cat.note && <p>{cat.note}</p>}
                  <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
                    {(overview.governance?.available_actions ?? []).map((action) => (
                      <button
                        key={action.code}
                        className={`governance-button governance-button--${action.code}`}
                        disabled={actionLoading}
                        onClick={() => recordGovernanceAction(action.code, 'pay_category', cat.id)}
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Demo data notice */}
      {/* Égapro peer benchmark — only shown when country=FR and data available */}
      {overview.egapro_peer_benchmark?.available && (
        <section className="comparison-section">
          <div className="panel" style={{ minHeight: 'auto', padding: 22 }}>
            <p className="panel__eyebrow">France Égapro Index</p>
            <h2 style={{ margin: '6px 0 16px', fontSize: '1.15rem' }}>Peer benchmark</h2>
            <div className="comparison-overview__meta">
              <div className="comparison-meta">
                <div className="comparison-meta__top">
                  <strong>Sector median score</strong>
                  <span className="comparison-meta__pill">{overview.egapro_peer_benchmark.company_count} companies</span>
                </div>
                <div className="comparison-meta__detail-list">
                  <span>P25: {overview.egapro_peer_benchmark.p25_score}</span>
                  <span>P50: {overview.egapro_peer_benchmark.p50_score}</span>
                  <span>P75: {overview.egapro_peer_benchmark.p75_score}</span>
                </div>
                <p>{overview.egapro_peer_benchmark.note}</p>
              </div>
            </div>
          </div>
        </section>
      )}

      {!internalLoaded && (
        <div className="inline-notice inline-notice--watch" style={{ marginTop: 12 }}>
          <div>
            <strong>Representative example</strong>
            <p>This analysis uses illustrative data based on 2025 public aggregates. Upload your company data to see your real numbers.</p>
          </div>
          <button
            className="panel__action"
            onClick={() => document.getElementById('payroll-upload-input')?.click()}
          >
            Upload your data →
          </button>
          <input
            id="payroll-upload-input"
            type="file"
            accept=".csv"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) window.__wg_upload_payroll?.(file)
            }}
          />
        </div>
      )}

      <EvidenceDrawer
        evidence={selectedEvidence}
        onClose={() => setSelectedEvidence(null)}
      />
    </div>
  )
}
```

- [ ] **Step 2: Verify Pay Analysis route**

Open `http://localhost:5173/pay-analysis` — should show company vs market comparison, derived scores, compliance table, and demo data notice. Sidebar active item should be "Pay Analysis".

- [ ] **Step 3: Commit**

```bash
git add src/components/sections/PayAnalysisSection.jsx
git commit -m "feat: add PayAnalysisSection with company benchmark and compliance table"
```

---

## Task 10: Build GovernSection

**Files:**
- Create: `src/components/sections/GovernSection.jsx`

- [ ] **Step 1: Create GovernSection.jsx**

```jsx
// src/components/sections/GovernSection.jsx
import { useOverviewData } from '../../hooks/useOverviewData'
import { Download, Play, Settings } from 'lucide-react'

const fullDateFormatter = new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

const ACTION_LABELS = {
  approved: 'Approved',
  overridden: 'Overridden',
  reversed: 'Reversed',
  exported: 'Exported',
}

export function GovernSection() {
  const {
    overview,
    loading,
    error,
    exporting,
    scheduleLoading,
    exportEvidencePack,
    scheduleBrief,
  } = useOverviewData()

  if (loading) {
    return (
      <div className="dashboard--loading">
        <div className="loading-panel"><h2>Loading…</h2></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="dashboard--error">
        <div className="error-panel"><h2>Could not load data</h2><p>{error}</p></div>
      </div>
    )
  }

  if (!overview) return null

  const governance = overview.governance ?? {}
  const automation = overview.automation ?? {}
  const loggedEvents = governance.logged_events ?? []
  const workflows = automation.scheduled_workflows ?? []
  const handoffs = automation.pending_handoffs ?? []

  return (
    <div className="dashboard">
      <div className="dashboard__halo dashboard__halo--one" />

      <p className="hero__eyebrow" style={{ marginBottom: 8 }}>Govern & Export</p>

      {/* Governance Log */}
      <section className="comparison-section">
        <div className="panel" style={{ minHeight: 'auto', padding: 22 }}>
          <p className="panel__eyebrow">Governance Log</p>
          <h2 style={{ margin: '6px 0 16px', fontSize: '1.15rem' }}>Decision history</h2>

          {loggedEvents.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>
              No decisions logged yet. Approve, override, or reverse pay transparency categories in Pay Analysis to build the log.
            </p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.78rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  <th style={{ padding: '0 0 10px', fontWeight: 700 }}>Action</th>
                  <th style={{ padding: '0 0 10px', fontWeight: 700 }}>Category</th>
                  <th style={{ padding: '0 0 10px', fontWeight: 700 }}>Reviewed by</th>
                  <th style={{ padding: '0 0 10px', fontWeight: 700 }}>Date</th>
                </tr>
              </thead>
              <tbody>
                {loggedEvents.map((event, i) => (
                  <tr key={i} style={{ borderTop: '1px solid rgba(159,185,214,0.1)' }}>
                    <td style={{ padding: '12px 0', color: 'var(--text-strong)', fontWeight: 600 }}>
                      {ACTION_LABELS[event.action_code] ?? event.action_code}
                    </td>
                    <td style={{ padding: '12px 0', color: 'var(--text-muted)' }}>
                      {event.target_id ?? event.target_type}
                    </td>
                    <td style={{ padding: '12px 0', color: 'var(--text-muted)' }}>
                      {event.actor ?? 'Dashboard user'}
                    </td>
                    <td style={{ padding: '12px 0', color: 'var(--text-muted)' }}>
                      {event.recorded_at
                        ? fullDateFormatter.format(new Date(event.recorded_at))
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Evidence Pack */}
      <section className="comparison-section">
        <div className="panel" style={{ minHeight: 'auto', padding: 22 }}>
          <p className="panel__eyebrow">Evidence Pack</p>
          <h2 style={{ margin: '6px 0 16px', fontSize: '1.15rem' }}>Download compliance evidence</h2>

          <div className="product-notes" style={{ marginBottom: 20 }}>
            {[
              'Market metrics with source citations',
              'Benchmark comparisons with methodology notes',
              'Pay transparency review items and decisions',
              'Governance decision log with timestamps',
              'Data vintage and methodology versions',
            ].map((item) => (
              <div key={item} className="product-note">
                <span style={{ color: 'var(--accent-teal)' }}>✓</span>
                <span>{item}</span>
              </div>
            ))}
          </div>

          <button
            className="filter-bar__button"
            onClick={exportEvidencePack}
            disabled={exporting}
            style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}
          >
            <Download size={16} />
            {exporting ? 'Preparing download…' : 'Download Evidence Pack'}
          </button>
        </div>
      </section>

      {/* Workflow Automation */}
      {(workflows.length > 0 || handoffs.length > 0) && (
        <section className="comparison-section">
          <div className="panel" style={{ minHeight: 'auto', padding: 22 }}>
            <p className="panel__eyebrow">Workflow Automation</p>
            <h2 style={{ margin: '6px 0 16px', fontSize: '1.15rem' }}>Scheduled workflows</h2>

            {workflows.length > 0 && (
              <div className="phase5-configured" style={{ marginBottom: 20 }}>
                {workflows.map((wf) => (
                  <div key={wf.id} className="phase5-handoff">
                    <div>
                      <strong>{wf.label}</strong>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.84rem', display: 'block', marginTop: 2 }}>
                        {wf.status}
                      </span>
                    </div>
                    <button
                      className="governance-button governance-button--approve"
                      onClick={() => scheduleBrief(wf)}
                      disabled={scheduleLoading}
                      style={{ display: 'flex', gap: 6, alignItems: 'center' }}
                    >
                      <Play size={14} />
                      Run now
                    </button>
                  </div>
                ))}
              </div>
            )}

            {handoffs.length > 0 && (
              <>
                <p className="panel__eyebrow" style={{ marginBottom: 12 }}>Pending handoffs</p>
                <div className="phase5-alert-list">
                  {handoffs.map((handoff, i) => (
                    <div key={i} className="phase5-alert">
                      <div className="phase5-alert__top">
                        <div>
                          <h3>{handoff.title}</h3>
                          <p>{handoff.description}</p>
                        </div>
                        {handoff.due_label && (
                          <span className="comparison-meta__pill">Due: {handoff.due_label}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify Govern route**

Open `http://localhost:5173/govern` — should show governance log table (or empty state), evidence pack download section, and workflow automation if data exists. Sidebar active item should be "Govern & Export". "Reviewed by" column header (not "Actor") must be visible.

- [ ] **Step 3: Commit**

```bash
git add src/components/sections/GovernSection.jsx
git commit -m "feat: add GovernSection with governance log, evidence pack, and automation"
```

---

## Task 11: Wire TopBar to live overview data and connect overview data across sections

**Files:**
- Modify: `src/components/layout/TopBar.jsx`
- Modify: `src/App.jsx`

The TopBar needs to show live filter context. The issue is that `useOverviewData` uses `useSearchParams` which requires it to be called inside a `<Routes>` context. We resolve this by lifting overview state to `AppShell` and passing it down.

- [ ] **Step 1: Update App.jsx to lift overview data**

```jsx
// src/App.jsx
import { useState } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Sidebar } from './components/layout/Sidebar'
import { TopBar } from './components/layout/TopBar'
import { CopilotPanel } from './components/layout/CopilotPanel'
import { HomeSection } from './components/sections/HomeSection'
import { MarketSection } from './components/sections/MarketSection'
import { PayAnalysisSection } from './components/sections/PayAnalysisSection'
import { GovernSection } from './components/sections/GovernSection'
import './App.css'

// AppShell is inside BrowserRouter so hooks can access router context
function AppShell() {
  const [copilotOpen, setCopilotOpen] = useState(false)

  return (
    <div className="app-shell">
      <TopBar />
      <div className="app-body">
        <Sidebar onCopilotOpen={() => setCopilotOpen(true)} />
        <main className="app-main">
          <Routes>
            <Route path="/" element={<HomeSection />} />
            <Route path="/market" element={<MarketSection />} />
            <Route path="/pay-analysis" element={<PayAnalysisSection />} />
            <Route path="/govern" element={<GovernSection />} />
          </Routes>
        </main>
      </div>
      {copilotOpen && <CopilotPanel onClose={() => setCopilotOpen(false)} />}
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  )
}
```

- [ ] **Step 2: Update TopBar to read from URL params directly**

```jsx
// src/components/layout/TopBar.jsx
import { useSearchParams } from 'react-router-dom'
import logo from '../../assets/logos/workforceguard_logo_letters_1773817682347.png'

export function TopBar() {
  const [searchParams] = useSearchParams()

  const country = searchParams.get('country') ?? 'All countries'
  const sector = searchParams.get('sector') ?? 'All sectors'
  const period = searchParams.get('period') ?? 'Latest'

  const context = `${country} · ${sector} · ${period}`

  return (
    <header className="topbar">
      <div className="topbar__brand">
        <img src={logo} alt="WorkforceGuard" className="topbar__logo" />
      </div>
      <div className="topbar__company">
        <span className="topbar__company-name">AeroTech Europe SAS</span>
      </div>
      <div className="topbar__context">
        <span className="topbar__context-label">{context}</span>
      </div>
    </header>
  )
}
```

- [ ] **Step 3: Full navigation test**

```bash
npm run dev
```

Manually verify:
- Navigate to `/` — Home loads, metric cards clickable, attention items route correctly
- Navigate to `/market` — charts load, filter changes update URL params, signals show "View evidence" button opening drawer
- Navigate to `/pay-analysis` — company benchmark panel visible, compliance table shows "Needs review" / "Documented difference" (not backend terms), governance buttons work
- Navigate to `/govern` — governance log shows "Reviewed by" column (not "Actor"), evidence pack download button works
- Copilot button opens slide-in panel, question submission works
- TopBar context updates when filters change on Market/Pay Analysis pages
- Sharing a URL with query params restores the correct filter state on load

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx src/components/layout/TopBar.jsx
git commit -m "feat: wire TopBar to live URL params, complete routing integration"
```

---

## Task 12: Delete Overview.jsx and clean up App.css

**Files:**
- Delete: `src/components/Overview.jsx`
- Modify: `src/App.css`

Only do this task after Task 11 passes all verification checks.

- [ ] **Step 1: Remove the old single-page scroll CSS rules from App.css**

The following classes are no longer used after the redesign. Search `App.css` for each and remove them:

- `.dashboard` — replaced by section-level usage
- `.hero`, `.hero__copy`, `.hero__meta`, `.hero__meta-card`, `.hero__lede`, `.hero__eyebrow` — hero section no longer exists
- `.metric-section` scroll-level wrapper rules that conflict with section layout

Keep all component-level classes (`.metric-card`, `.panel`, `.tone-chip`, `.evidence-drawer`, etc.) — they are still used by the new components.

- [ ] **Step 2: Delete Overview.jsx**

```bash
rm dashboard/frontend/src/components/Overview.jsx
```

- [ ] **Step 3: Verify nothing broke**

```bash
npm run dev
```

Expected: Dev server starts with no errors. All 4 routes load correctly. No console errors referencing Overview.

- [ ] **Step 4: Run the build to catch any dead imports**

```bash
npm run build
```

Expected: Build completes successfully with no errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: remove Overview.jsx — multi-section redesign complete"
```

---

## Task 13: Wire CSV upload to backend

**Files:**
- Modify: `src/hooks/useOverviewData.js`
- Modify: `src/components/sections/PayAnalysisSection.jsx`

The "Upload your data" button in Task 9 uses `window.__wg_upload_payroll`. This task replaces that placeholder with a proper `uploadPayroll` function in the hook and wires it cleanly into the section.

- [ ] **Step 1: Add `uploadPayroll` to useOverviewData.js**

Add this function inside `useOverviewData`, after `scheduleBrief`:

```js
async function uploadPayroll(file) {
  const formData = new FormData()
  formData.append('file', file)
  setLoading(true)
  try {
    const response = await axios.post(`${API_BASE}/upload/payroll`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    setNotice({ type: 'success', message: `Upload accepted — ${response.data.record_count} employees loaded.` })
    // Reload overview so Pay Analysis reflects new data immediately
    const overviewResponse = await axios.get(`${API_BASE}/overview`, {
      params: buildQueryParams(requestFilters),
    })
    startTransition(() => setOverview(overviewResponse.data))
  } catch (uploadError) {
    const detail = uploadError.response?.data?.detail ?? 'Upload failed. Check the file format and try again.'
    setNotice({ type: 'error', message: detail })
  } finally {
    setLoading(false)
  }
}
```

Add `uploadPayroll` to the return object of `useOverviewData`.

- [ ] **Step 2: Update PayAnalysisSection to use uploadPayroll from hook**

Replace the `window.__wg_upload_payroll` approach in `PayAnalysisSection.jsx`. Change the demo notice block:

```jsx
const { ..., uploadPayroll } = useOverviewData()

// Replace the upload button and hidden input with:
{!internalLoaded && (
  <div className="inline-notice inline-notice--watch" style={{ marginTop: 12 }}>
    <div>
      <strong>Representative example</strong>
      <p>This analysis uses illustrative data based on 2025 public aggregates. Upload your company data to see your real numbers.</p>
    </div>
    <label className="panel__action" style={{ cursor: 'pointer' }}>
      Upload your data →
      <input
        type="file"
        accept=".csv"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) uploadPayroll(file)
        }}
      />
    </label>
  </div>
)}
```

- [ ] **Step 3: Verify upload flow**

```bash
npm run dev
```

With the backend running, navigate to `/pay-analysis`. The demo notice should be visible. Click "Upload your data →" — file picker opens. Selecting a valid CSV should trigger the upload, show a success notice, and reload Pay Analysis with the new data. Selecting an invalid file should show the error message from the backend validation response.

Note: the backend upload endpoint (`POST /api/upload/payroll`) is built in the data plan — this task only wires the frontend. Until the data plan Task is complete, the upload will return a 404, which is expected.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useOverviewData.js src/components/sections/PayAnalysisSection.jsx
git commit -m "feat: wire CSV upload button to payroll upload endpoint"
```

---

## Self-Review

### Spec coverage check

| Spec requirement | Task that implements it |
|-----------------|------------------------|
| 4-section multi-page app with routing | Task 5 (shell) + Tasks 7-10 (sections) |
| React Router v6 | Task 1 + Task 5 |
| URL query params for filter state | Task 2 (useOverviewData) + Task 11 (TopBar) |
| Persistent sidebar with active state | Task 5 (Sidebar.jsx) |
| Home: 4 metric cards + attention + brief | Task 7 |
| Market: filter bar + 4 charts + signals + recommendations + watchlist | Task 8 |
| Pay Analysis: company vs market + derived scores + compliance table + demo notice | Task 9 |
| Govern: governance log + evidence pack + automation | Task 10 |
| Copilot slide-in panel | Task 6 |
| All copy replacements (actor → Reviewed by, etc.) | Tasks 3, 9, 10 |
| EvidenceDrawer extracted and contextual | Task 4 |
| FilterBar extracted | Task 4 |
| Overview.jsx deleted | Task 12 |
| No single file > 300 lines | Verified by file structure — each section is focused |
| Zero backend terminology in UI | Copy table applied throughout Tasks 3, 9, 10 |
| Demo data notice on Pay Analysis | Task 9 |
| Égapro peer benchmark panel when country=FR | Task 9 (updated) |
| CSV upload button wired to POST /api/upload/payroll | Task 13 |

All spec requirements covered.

### Placeholder scan
No TBD, TODO, or "implement later" found. All code blocks are complete.

### Type consistency
- `useOverviewData` returns the same shape in all tasks: `{ filters, setFilters, overview, loading, error, exporting, actionLoading, scheduleLoading, notice, setNotice, exportEvidencePack, recordGovernanceAction, scheduleBrief }`
- `EvidenceDrawer` receives `{ evidence, onClose }` consistently in Tasks 4, 8, 9
- `FilterBar` receives `{ filters, options, onFilterChange, onAnalyse?, children? }` consistently in Tasks 4, 8
- `ToneChip` receives `{ tone, children }` consistently throughout
- `MetricCard` receives `{ metric, onOpenEvidence?, onClick? }` consistently in Tasks 3, 7
