# Informational Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface all rich backend data across every page so the dashboard feels insight-dense, human-crafted, and data-driven rather than sparse and generic.

**Architecture:** All data is already returned by `GET /api/overview`. Changes are purely frontend — wire up unused API fields in existing components, add annotations to charts, add dynamic narrative synthesis in Compare, and enrich the sidebar with live signals. No new API endpoints needed. `normalizeOverview.ts` is the single place where API→component field mapping lives.

**Tech Stack:** React 18, TypeScript, Recharts (already installed), Tailwind via CSS vars, React Query (TanStack), React Router v6.

---

## File Map

| File | What changes |
|---|---|
| `src/lib/normalizeOverview.ts` | Expose `comparisons` on metrics, expose `benchmark_context`, `scores`, pass-through `intelligence.signals` evidence scores, `automation.scheduled_briefs` |
| `src/components/primitives/MetricCard.tsx` | Add active benchmark annotation sub-line |
| `src/components/shared/FilterBar.tsx` | Use `geography_options` (full country names) instead of `country_options` (ISO codes) |
| `src/components/shared/MetricChart.tsx` | Accept optional `referenceValue` prop, render `ReferenceLine` for EU avg |
| `src/components/shared/ChartPanel.tsx` | Accept optional `period` prop, render it in title |
| `src/components/layout/Sidebar.tsx` | Add live Market Pulse strip + governance badge from shared context |
| `src/components/layout/SidebarContext.tsx` | New: tiny React context that holds the overview snapshot for sidebar |
| `src/App.tsx` | Wrap AppShell with SidebarContext provider |
| `src/components/sections/HomeSection.tsx` | Add score pulse strip above brief, wire watchlist into Needs Attention |
| `src/components/sections/MarketSection.tsx` | Pass period + EU ref value to charts, add benchmark context notice, show signal scores |
| `src/components/sections/CompareSection.tsx` | Add delta column, narrative synthesis sentence, fix country names |
| `src/components/sections/PayAnalysisSection.tsx` | Add empty-state onboarding, derived score context lines, pay gap article sentence |
| `src/components/sections/GovernSection.tsx` | Always-visible chain integrity row, always-visible automation templates, richer empty state |
| `src/App.css` | New CSS classes: `.score-pulse`, `.score-pulse__item`, `.score-pulse__bar`, `.benchmark-notice`, `.compare-row__delta`, `.chain-integrity`, `.sidebar__pulse` |

---

## Task 1: Expose missing fields in normalizeOverview

**Files:**
- Modify: `src/lib/normalizeOverview.ts`

- [ ] **Step 1: Add benchmark_context and scores pass-through**

In `normalizeOverview.ts`, update the `intelligence` block and add explicit pass-throughs so components can read these fields without casting:

```typescript
// existing code around line 73 — replace the intelligence block with:
const intelRaw = asObj(d.intelligence)
const signals = asArr(intelRaw.signals).map((s) => {
  const eb = asObj(s.evidence_bundle ?? s.evidence)
  const evidenceArr = asArr(eb.evidence)
  // score string is always evidence[0].value e.g. "64/100"
  const scoreLabel = evidenceArr[0]?.value as string | undefined
  return {
    ...s,
    summary: s.summary ?? s.detail,
    evidence: s.evidence ?? s.evidence_bundle,
    score_label: s.score_label ?? scoreLabel ?? null,
  }
})
const recommendations = asArr(intelRaw.recommendations).map((r) => ({
  ...r,
  summary: r.summary ?? r.detail,
}))
const watchlist = asArr(intelRaw.watchlist).map((w) => ({
  ...w,
  summary: w.summary ?? w.detail,
}))
const intelligence = {
  ...intelRaw,
  signals,
  recommendations,
  watchlist,
  benchmark_context: intelRaw.benchmark_context ?? null,
}
```

- [ ] **Step 2: Expose active benchmark comparison on each metric**

Still in `normalizeOverview.ts`, update the metrics mapping block to add `active_comparison` — the best available comparison basis (prior_period preferred, else eu):

```typescript
// replace the metrics block (currently around line 34):
const metrics = asArr(d.metrics).map((m) => {
  const comps = asObj(m.comparisons)
  const pp = asObj(comps.prior_period)
  const eu = asObj(comps.eu)
  // Pick active comparison: prior_period when available and country-scoped, else eu
  const activeComp = (pp.available && pp.benchmark_value != null) ? pp
    : (eu.available && eu.benchmark_value != null) ? eu
    : null
  return {
    ...m,
    tone: m.tone ?? metricTone(m),
    delta: m.delta ?? metricDelta(m),
    gap_label: m.gap_label ?? pp.gap_label,
    period_label: m.period_label ?? (() => {
      const p = m.period as string | undefined
      if (!p) return ''
      return p.replace(/^(\d{4})-Q(\d)$/, 'Q$2 $1')
    })(),
    active_comparison: activeComp
      ? {
          label: activeComp.label as string,
          gap_label: activeComp.gap_label as string,
          tone: activeComp.tone as string,
          benchmark_value: activeComp.benchmark_value as number,
          explanation: activeComp.explanation as string | undefined,
        }
      : null,
  }
})
```

- [ ] **Step 3: Expose automation.scheduled_briefs in normalized automation**

Still in `normalizeOverview.ts`, update the automation block (currently around line 130):

```typescript
const autoRaw = asObj(d.automation)
const scheduledWorkflows = asArr(autoRaw.scheduled_workflows ?? autoRaw.scheduled_briefs)
const scheduledBriefs = asArr(autoRaw.scheduled_briefs)
const configuredSchedules = asArr(autoRaw.configured_schedules)
const pendingHandoffs = asArr(autoRaw.pending_handoffs ?? autoRaw.handoffs).map((h) => ({
  ...h,
  due_label: h.due_label ?? h.approval_checkpoint,
}))
const automation = {
  ...autoRaw,
  scheduled_workflows: scheduledWorkflows,
  scheduled_briefs: scheduledBriefs,
  configured_schedules: configuredSchedules,
  pending_handoffs: pendingHandoffs,
}
```

- [ ] **Step 4: Verify normalizeOverview output with a quick sanity check**

Run in the browser console after this change (or via `curl` + `node -e`):

```bash
curl -s "http://localhost:8001/api/overview?country=FR&geography=FR&sector=ALL&period=latest" \
  | node -e "
const d = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
const m = d.metrics[0];
console.log('active_comparison will be:', m.comparisons?.prior_period?.available ? 'prior_period' : 'eu');
console.log('signal score_label will be:', d.intelligence.signals[0].evidence_bundle?.evidence?.[0]?.value);
console.log('benchmark_context label:', d.intelligence.benchmark_context?.label);
console.log('scheduled_briefs count:', d.automation.scheduled_briefs?.length);
"
```

Expected output:
```
active_comparison will be: prior_period
signal score_label will be: 64/100
benchmark_context label: EU27 proxy average   (or "Prior period" depending on filter)
scheduled_briefs count: 2
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/normalizeOverview.ts
git commit -m "feat(normalize): expose active_comparison, signal score_label, benchmark_context, scheduled_briefs"
```

---

## Task 2: Fix country dropdown — full names instead of ISO codes

**Files:**
- Modify: `src/components/shared/FilterBar.tsx`

- [ ] **Step 1: Switch from country_options to geography_options filtered to country level**

The API returns `geography_options` with full names and a `nuts_level` field. Country-level entries have `nuts_level: 0`. The EU27 aggregate has no `nuts_level` (it's `undefined`).

Replace the existing `rawCountries` line in `FilterBar.tsx`:

```typescript
// OLD (line 24):
const rawCountries = (options?.countries ?? options?.country_options) as SelectOption[] | undefined

// NEW — use geography_options, keep only country-level + EU27_AVG:
const geoOptions = (options?.geography_options ?? options?.benchmark_geographies) as Array<{id: string; label: string; nuts_level?: number; country_code?: string}> | undefined
const rawCountries: SelectOption[] = geoOptions
  ? geoOptions.filter(g => g.id === 'EU27_AVG' || g.nuts_level === 0).map(g => ({ id: g.id, label: g.label }))
  : [{ id: 'ALL', label: 'All countries' }]
```

Also update the `countryOptions` line right below it — since `rawCountries` is now always an array (never undefined), simplify:

```typescript
// OLD:
const countryOptions = rawCountries?.length ? rawCountries : [{ id: 'ALL', label: 'All countries' }]

// NEW:
const countryOptions = rawCountries.length ? rawCountries : [{ id: 'ALL', label: 'All countries' }]
```

- [ ] **Step 2: Verify in browser**

Open `http://localhost:5173`, click the Country dropdown. Should show "EU27 proxy market average", "Austria", "Belgium", "France", etc. — not "ALL", "AT", "BE", "FR".

- [ ] **Step 3: Commit**

```bash
git add src/components/shared/FilterBar.tsx
git commit -m "feat(filter): show full country names from geography_options instead of ISO codes"
```

---

## Task 3: MetricCard benchmark annotation

**Files:**
- Modify: `src/components/primitives/MetricCard.tsx`

- [ ] **Step 1: Add active_comparison annotation below the value**

Replace the entire `MetricCard` component body. The `active_comparison` field is now on every metric object from Task 1.

```typescript
import { ToneChip } from './ToneChip'
import { ProvenanceBadge } from './ProvenanceBadge'

type AnyObj = Record<string, unknown>

const TONE_CLASS: Record<string, string> = {
  good: 'metric-card--teal',
  watch: 'metric-card--orange',
  neutral: 'metric-card--blue',
}

const numberFormatter = new Intl.NumberFormat('en-IE', {
  maximumFractionDigits: 1,
  minimumFractionDigits: 0,
})

function formatValue(value: unknown, unit = '%') {
  if (value == null) return 'Planned'
  if (unit === '%') return `${numberFormatter.format(Number(value))}%`
  if (unit === 'score') return `${numberFormatter.format(Number(value))}/100`
  return numberFormatter.format(Number(value))
}

function formatDelta(delta: unknown, unit = '%') {
  if (delta == null || Number.isNaN(Number(delta))) return 'No prior period'
  const sign = (delta as number) > 0 ? '+' : ''
  if (unit === '%') return `${sign}${numberFormatter.format(Number(delta))} pts vs prior period`
  return `${sign}${numberFormatter.format(Number(delta))} vs prior period`
}

const TONE_DOT: Record<string, string> = {
  good: 'var(--tone-good)',
  watch: 'var(--tone-watch)',
  neutral: 'var(--text-muted)',
}

export function MetricCard({ metric, onOpenEvidence, onClick }: { metric: AnyObj; onOpenEvidence?: (m: unknown) => void; onClick?: () => void }) {
  const tone = (metric.tone as string) ?? 'neutral'
  const toneClass = TONE_CLASS[tone] ?? ''
  const activeComp = metric.active_comparison as { label: string; gap_label: string; tone: string } | null | undefined

  return (
    <article
      className={`metric-card ${toneClass}`}
      onClick={onClick}
      style={onClick ? { cursor: 'pointer' } : undefined}
    >
      <div className="metric-card__header">
        <p className="metric-card__eyebrow">{metric.title as string}</p>
      </div>
      <p className="metric-card__value">{formatValue(metric.value, metric.unit as string | undefined)}</p>

      {activeComp ? (
        <p className="metric-card__benchmark" style={{ color: TONE_DOT[activeComp.tone] ?? 'var(--text-muted)' }}>
          <span
            style={{
              display: 'inline-block',
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: TONE_DOT[activeComp.tone] ?? 'var(--text-muted)',
              marginRight: 5,
              verticalAlign: 'middle',
              flexShrink: 0,
            }}
          />
          {activeComp.gap_label} · {activeComp.label}
        </p>
      ) : (
        <p className={`metric-card__delta metric-card__delta--${tone}`}>
          {metric.gap_label
            ? (metric.gap_label as string) === 'In line'
              ? 'Stable vs prior period'
              : `${metric.gap_label as string} · prior period`
            : formatDelta(metric.delta, metric.unit as string | undefined)
          }
        </p>
      )}

      {Boolean(metric.tone) && (
        <div className="metric-card__coverage" style={{ marginTop: 8 }}>
          <ToneChip tone={tone}>
            {tone === 'good' ? 'Good' : tone === 'watch' ? 'Watch' : 'Neutral'}
          </ToneChip>
        </div>
      )}
      {Boolean(metric.provenance) && (
        <ProvenanceBadge provenance={metric.provenance as Array<{ source_id: string }>} compact />
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

- [ ] **Step 2: Add `.metric-card__benchmark` CSS class to App.css**

Add after the `.metric-card__delta--neutral` block (around line 289):

```css
.metric-card__benchmark {
  margin: 0 0 8px;
  font-size: 0.78rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0;
}
```

- [ ] **Step 3: Verify in browser**

Select France from the Country dropdown on Home. Each metric card should now show a coloured annotation like `● 1.6 pts above · Prior period` below the value.

- [ ] **Step 4: Commit**

```bash
git add src/components/primitives/MetricCard.tsx src/App.css
git commit -m "feat(metric-card): show active benchmark comparison annotation below value"
```

---

## Task 4: Score Pulse Strip on Home page

**Files:**
- Modify: `src/components/sections/HomeSection.tsx`
- Modify: `src/App.css`

- [ ] **Step 1: Add the score pulse strip above the executive brief**

In `HomeSection.tsx`, `semantic_metrics` is already available as `(ov.semantic_metrics as AnyObj[]) ?? []`. Add this section just before the `{headline && (` block (around line 154):

```typescript
{/* ════════════════════════════════════════════════════════════════
    § 0 — SCORE PULSE STRIP
    4 composite scores from semantic_metrics — hiring pressure,
    labour resilience, equity risk, transition readiness
════════════════════════════════════════════════════════════════ */}
{metrics.length > 0 && (
  <section className="score-pulse" style={{ marginBottom: 20 }}>
    {(ov.semantic_metrics as AnyObj[] ?? []).map((sm) => {
      const val = sm.value as number
      const pct = Math.min(100, Math.max(0, val))
      const tone = val >= 70 ? 'good' : val >= 45 ? 'neutral' : 'watch'
      const barColor = tone === 'good' ? 'var(--tone-good)' : tone === 'watch' ? 'var(--tone-watch)' : 'var(--text-muted)'
      return (
        <div key={sm.id as string} className="score-pulse__item">
          <div className="score-pulse__header">
            <span className="score-pulse__label">{sm.title as string}</span>
            <span className="score-pulse__value" style={{ color: barColor }}>{Math.round(val)}<span style={{ fontSize: '0.65em', color: 'var(--text-muted)', fontWeight: 500 }}>/100</span></span>
          </div>
          <div className="score-pulse__track">
            <div className="score-pulse__fill" style={{ width: `${pct}%`, background: barColor }} />
          </div>
          <p className="score-pulse__def">{sm.definition as string}</p>
        </div>
      )
    })}
  </section>
)}
```

- [ ] **Step 2: Add score pulse CSS to App.css**

Add after the `.metric-card__benchmark` block:

```css
/* ── Score Pulse Strip ─────────────────────────────────────────────────── */
.score-pulse {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1px;
  background: var(--border-light);
  border: 1px solid var(--border-light);
  border-radius: 14px;
  overflow: hidden;
}

.score-pulse__item {
  background: var(--bg-surface);
  padding: 14px 16px;
}

.score-pulse__header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 8px;
}

.score-pulse__label {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  line-height: 1.3;
  max-width: 14ch;
}

.score-pulse__value {
  font-size: 1.35rem;
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1;
  flex-shrink: 0;
}

.score-pulse__track {
  height: 3px;
  background: var(--bg-elevated);
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 8px;
}

.score-pulse__fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}

.score-pulse__def {
  margin: 0;
  font-size: 0.68rem;
  color: var(--text-muted);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

@media (max-width: 900px) {
  .score-pulse {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
```

- [ ] **Step 3: Wire watchlist items into Needs Attention**

In `HomeSection.tsx`, update the `urgentItems` block (currently around line 129):

```typescript
const urgentItems = [
  ...watchSignals.slice(0, 2).map(s => ({ text: s.title as string, route: '/market', type: 'signal' as const })),
  ...watchlist.slice(0, 2).map(w => ({ text: `${w.label as string}: ${w.detail as string}`, route: '/market', type: 'watch' as const })),
  ...(unresolvedCount > 0
    ? [{ text: `${unresolvedCount} pay transparency ${unresolvedCount === 1 ? 'category needs' : 'categories need'} review`, route: '/pay-analysis', type: 'signal' as const }]
    : []),
]
```

Then in the render, update the attention strip to show a slightly different left border for watchlist items:

```typescript
{urgentItems.map((item, i) => (
  <button
    key={i}
    className={`product-note inline-notice ${item.type === 'watch' ? 'inline-notice--neutral' : 'inline-notice--watch'}`}
    onClick={() => navigate(item.route)}
    style={{ textAlign: 'left', cursor: 'pointer', display: 'flex', width: '100%', gap: 10, alignItems: 'flex-start' }}
  >
    <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1, color: item.type === 'watch' ? 'var(--text-muted)' : 'var(--tone-watch)' }} />
    <span>{item.text}</span>
  </button>
))}
```

Add `inline-notice--neutral` CSS after `inline-notice--watch`:

```css
.inline-notice--neutral {
  border-color: var(--tone-neutral-border);
  background: var(--tone-neutral-bg);
  color: var(--text-strong);
}
```

- [ ] **Step 4: Verify in browser**

Home page should show 4 score bars at the top above the executive brief. Each bar fills proportionally (64% = 64/100 fill). Needs Attention should show watchlist items in muted grey vs amber for watch signals.

- [ ] **Step 5: Commit**

```bash
git add src/components/sections/HomeSection.tsx src/App.css
git commit -m "feat(home): score pulse strip above brief, watchlist in needs-attention"
```

---

## Task 5: Market Intelligence — chart annotations and signal scores

**Files:**
- Modify: `src/components/shared/MetricChart.tsx`
- Modify: `src/components/shared/ChartPanel.tsx`
- Modify: `src/components/sections/MarketSection.tsx`
- Modify: `src/App.css`

- [ ] **Step 1: Add referenceValue prop to MetricChart**

Replace `MetricChart.tsx` entirely:

```typescript
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
} from 'recharts'

type AnyObj = Record<string, unknown>

interface ChartTooltipProps {
  active?: boolean
  payload?: Array<{ value: unknown }>
  label?: string
  unit?: string
}

function ChartTooltip({ active, payload, label, unit = '%' }: ChartTooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip__title">{label}</p>
      <p className="chart-tooltip__value">
        {unit === '%' ? `${Number(payload[0].value).toFixed(1)}%` : String(payload[0].value)}
      </p>
    </div>
  )
}

interface MetricChartProps {
  chartType: 'line' | 'bar'
  data: AnyObj[]
  dataKey?: string
  xKey?: string
  unit?: string
  color?: string
  referenceValue?: number
  referenceLabel?: string
}

export function MetricChart({
  chartType,
  data,
  dataKey = 'value',
  xKey = 'period',
  unit = '%',
  color = '#7ff4ea',
  referenceValue,
  referenceLabel,
}: MetricChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      {chartType === 'line' ? (
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
          <XAxis dataKey={xKey} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
          <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} unit={unit} />
          <Tooltip content={<ChartTooltip unit={unit} />} />
          <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={false} />
          {referenceValue != null && (
            <ReferenceLine
              y={referenceValue}
              stroke="var(--text-muted)"
              strokeDasharray="4 4"
              strokeWidth={1}
              label={{ value: referenceLabel ?? `EU avg ${referenceValue.toFixed(1)}${unit}`, fill: 'var(--text-muted)', fontSize: 10, position: 'insideTopRight' }}
            />
          )}
        </LineChart>
      ) : (
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
          <XAxis dataKey={xKey} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
          <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} unit={unit} />
          <Tooltip content={<ChartTooltip unit={unit} />} />
          <Bar dataKey={dataKey} fill={color} radius={[4, 4, 0, 0]} />
          {referenceValue != null && (
            <ReferenceLine
              y={referenceValue}
              stroke="var(--text-muted)"
              strokeDasharray="4 4"
              strokeWidth={1}
              label={{ value: referenceLabel ?? `EU avg ${referenceValue.toFixed(1)}${unit}`, fill: 'var(--text-muted)', fontSize: 10, position: 'insideTopRight' }}
            />
          )}
        </BarChart>
      )}
    </ResponsiveContainer>
  )
}
```

- [ ] **Step 2: Add period prop to ChartPanel**

Replace `ChartPanel.tsx`:

```typescript
import type { ReactNode } from 'react'

const SOURCE_LABELS: Record<string, string> = {
  eurostat_lfs: 'Eurostat LFS',
  eurostat_jvs: 'Eurostat JVS',
  eurostat_ses: 'Eurostat SES',
}

export function ChartPanel({ title, sourceId, period, children }: { title: string; sourceId?: string; period?: string; children?: ReactNode }) {
  const titleWithPeriod = period ? `${title} · ${period}` : title
  return (
    <div className="panel">
      <div className="panel__header panel__header--tight">
        <div>
          <p className="panel__eyebrow">
            {sourceId ? SOURCE_LABELS[sourceId] ?? sourceId : 'Market data'}
          </p>
          <h2>{titleWithPeriod}</h2>
        </div>
      </div>
      <div className="panel__body panel__body--chart">
        {children}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Wire everything into MarketSection**

Replace `MarketSection.tsx` entirely:

```typescript
import { useState } from 'react'
import { useOverviewData } from '../../hooks/useOverviewData'
import { FreshnessPill } from '../primitives/FreshnessPill'
import { FilterBar } from '../shared/FilterBar'
import { ChartPanel } from '../shared/ChartPanel'
import { MetricChart } from '../shared/MetricChart'
import { EvidenceDrawer } from '../shared/EvidenceDrawer'
import { ToneChip } from '../primitives/ToneChip'
import { DataState } from '../shared/DataState'

type AnyObj = Record<string, unknown>

export function MarketSection() {
  const { filters, setFilters, overview, loading, error } = useOverviewData()
  const [selectedEvidence, setSelectedEvidence] = useState<unknown>(null)

  const ov = (overview ?? {}) as AnyObj
  const charts = (ov.charts as AnyObj) ?? {}
  const intelligence = (ov.intelligence as AnyObj) ?? {}
  const metrics = (ov.metrics as AnyObj[]) ?? []
  const ovFilters = (ov.filters as AnyObj) ?? {}
  const options = (ovFilters.options as Record<string, unknown>) ?? {}
  const benchmarkContext = (intelligence.benchmark_context as AnyObj | null) ?? null

  const unemploymentSeries = ((charts.unemployment_trend as AnyObj)?.series as AnyObj[]) ?? []
  const employmentSeries = ((charts.employment_trend as AnyObj)?.series as AnyObj[]) ?? []
  const vacancySeries = ((charts.vacancy_by_sector as AnyObj)?.series as AnyObj[]) ?? []
  const payGapSeries = ((charts.pay_gap_by_sector as AnyObj)?.series as AnyObj[]) ?? []

  // Get periods from first data point in each series
  const unemploymentPeriod = (unemploymentSeries[unemploymentSeries.length - 1]?.period as string | undefined)?.replace(/^(\d{4})-Q(\d)$/, 'Q$2 $1')
  const employmentPeriod = (employmentSeries[employmentSeries.length - 1]?.period as string | undefined)?.replace(/^(\d{4})-Q(\d)$/, 'Q$2 $1')
  const vacancyPeriod = (vacancySeries[0]?.period as string | undefined)?.replace(/^(\d{4})-Q(\d)$/, 'Q$2 $1')
  const payGapPeriod = (payGapSeries[0]?.period as string | undefined)?.replace(/^(\d{4})-Q(\d)$/, 'Q$2 $1')

  // EU reference values — always use the eu comparison (not active_comparison which may be prior_period)
  const metricById: Record<string, AnyObj> = {}
  metrics.forEach(m => { metricById[m.id as string] = m })
  function euRef(metricId: string): number | undefined {
    const comps = (metricById[metricId]?.comparisons as AnyObj | undefined) ?? {}
    const eu = (comps.eu as AnyObj | undefined) ?? {}
    return eu.available ? (eu.benchmark_value as number | undefined) : undefined
  }
  const unemploymentEURef = euRef('unemployment_rate')
  const employmentEURef = euRef('employment_rate')
  const vacancyEURef = euRef('vacancy_rate')
  const payGapEURef = euRef('gender_pay_gap')

  return (
    <div className="dashboard">
      <div className="dashboard__halo dashboard__halo--one" />
      <FreshnessPill />

      <DataState loading={loading} error={error} empty={!loading && !error && !overview}>
        <p className="hero__eyebrow" style={{ marginBottom: 8 }}>Market Intelligence</p>

        <FilterBar filters={filters} options={options} onFilterChange={setFilters} />

        {/* Benchmark context notice */}
        {benchmarkContext && (
          <div className="benchmark-notice" style={{ marginBottom: 16 }}>
            <span className="benchmark-notice__basis">{benchmarkContext.label as string}</span>
            <span className="benchmark-notice__summary">{benchmarkContext.coverage_note as string}</span>
          </div>
        )}

        <div className="dashboard-grid" style={{ marginTop: 16 }}>
          <ChartPanel title="Unemployment trend" sourceId="eurostat_lfs" period={unemploymentPeriod}>
            <MetricChart
              chartType="line"
              data={unemploymentSeries}
              xKey="period"
              color="var(--accent-teal)"
              referenceValue={unemploymentEURef}
              referenceLabel={unemploymentEURef ? `EU avg ${unemploymentEURef.toFixed(1)}%` : undefined}
            />
          </ChartPanel>

          <ChartPanel title="Vacancy rate by sector" sourceId="eurostat_jvs" period={vacancyPeriod}>
            <MetricChart
              chartType="bar"
              data={vacancySeries}
              xKey="sector_label"
              color="var(--accent-teal)"
              referenceValue={vacancyEURef}
              referenceLabel={vacancyEURef ? `EU avg ${vacancyEURef.toFixed(1)}%` : undefined}
            />
          </ChartPanel>
        </div>

        <div className="dashboard-grid" style={{ marginTop: 18 }}>
          <ChartPanel title="Employment trend" sourceId="eurostat_lfs" period={employmentPeriod}>
            <MetricChart
              chartType="line"
              data={employmentSeries}
              xKey="period"
              color="var(--accent-primary)"
              referenceValue={employmentEURef}
              referenceLabel={employmentEURef ? `EU avg ${employmentEURef.toFixed(1)}%` : undefined}
            />
          </ChartPanel>

          <ChartPanel title="Gender pay gap by sector" sourceId="eurostat_ses" period={payGapPeriod}>
            <MetricChart
              chartType="bar"
              data={payGapSeries}
              xKey="sector_label"
              color="var(--tone-watch)"
              referenceValue={payGapEURef}
              referenceLabel={payGapEURef ? `EU avg ${payGapEURef.toFixed(1)}%` : undefined}
            />
          </ChartPanel>
        </div>

        <section className="intelligence-section">
          <p className="panel__eyebrow" style={{ marginBottom: 14 }}>Intelligence Signals</p>
          <div className="signal-list">
            {((intelligence.signals as AnyObj[]) ?? []).map((signal, i) => (
              <div key={i} className="signal-item">
                <div className="signal-item__top">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <h3 style={{ margin: 0 }}>{signal.title as string}</h3>
                    {signal.score_label && (
                      <span style={{
                        fontFamily: 'monospace',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: 'var(--text-muted)',
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border-light)',
                        borderRadius: 6,
                        padding: '1px 7px',
                        letterSpacing: '0.02em',
                      }}>
                        {signal.score_label as string}
                      </span>
                    )}
                  </div>
                  <ToneChip tone={signal.tone as string}>
                    {signal.tone === 'good' ? 'Good' : signal.tone === 'watch' ? 'Watch' : 'Neutral'}
                  </ToneChip>
                </div>
                <p>{signal.summary as string}</p>
                {Boolean(signal.evidence) && (
                  <button className="insight-button" onClick={() => setSelectedEvidence(signal.evidence)}>
                    View evidence
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>

        {(((intelligence.recommendations as AnyObj[])?.length ?? 0) > 0 || ((intelligence.watchlist as AnyObj[])?.length ?? 0) > 0) && (
          <div className="intelligence-grid" style={{ marginTop: 18 }}>
            {((intelligence.recommendations as AnyObj[])?.length ?? 0) > 0 && (
              <div>
                <p className="panel__eyebrow" style={{ marginBottom: 12 }}>Recommendations</p>
                <div className="recommendation-list">
                  {(intelligence.recommendations as AnyObj[]).map((rec, i) => (
                    <div key={i} className="recommendation-item">
                      <div className="recommendation-item__top">
                        <h3>{rec.title as string}</h3>
                      </div>
                      <p>{rec.summary as string}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {((intelligence.watchlist as AnyObj[])?.length ?? 0) > 0 && (
              <div>
                <p className="panel__eyebrow" style={{ marginBottom: 12 }}>Watchlist</p>
                <div className="watchlist">
                  {(intelligence.watchlist as AnyObj[]).map((item, i) => (
                    <div key={i} className="watchlist-item">
                      <div className="watchlist-item__top">
                        <div>
                          <span className="watchlist-item__label">{item.label as string}</span>
                          {item.value && (
                            <span style={{ marginLeft: 8, fontSize: '0.82rem', color: 'var(--text-strong)', fontWeight: 600 }}>
                              {item.value as string}
                            </span>
                          )}
                        </div>
                        <ToneChip tone={(item.tone as string) ?? 'neutral'}>
                          {item.tone === 'watch' ? 'Watch' : item.tone === 'good' ? 'Good' : 'Neutral'}
                        </ToneChip>
                      </div>
                      <p>{item.detail as string ?? item.summary as string}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <EvidenceDrawer evidence={selectedEvidence} onClose={() => setSelectedEvidence(null)} />
      </DataState>
    </div>
  )
}
```

- [ ] **Step 4: Add benchmark-notice CSS to App.css**

Add after `.inline-notice--neutral`:

```css
/* ── Benchmark Context Notice ──────────────────────────────────────────── */
.benchmark-notice {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.78rem;
  color: var(--text-muted);
  padding: 0 2px;
}

.benchmark-notice__basis {
  font-weight: 700;
  color: var(--text-strong);
}

.benchmark-notice__summary {
  color: var(--text-muted);
}
```

- [ ] **Step 5: Verify in browser**

Market page charts should show dashed EU average reference lines. Chart titles should include period e.g. "Unemployment trend · 2024". Signal cards should show monospace score badges like "64/100".

- [ ] **Step 6: Commit**

```bash
git add src/components/shared/MetricChart.tsx src/components/shared/ChartPanel.tsx src/components/sections/MarketSection.tsx src/App.css
git commit -m "feat(market): chart EU reference lines, period labels, signal score badges, benchmark context notice"
```

---

## Task 6: Compare page — delta column, narrative synthesis, country names

**Files:**
- Modify: `src/components/sections/CompareSection.tsx`
- Modify: `src/App.css`

- [ ] **Step 1: Add delta computation helper and narrative synthesis**

At the top of `CompareSection.tsx` (after the imports), add these helpers:

```typescript
const DESIRED_DIRECTION: Record<string, 'up' | 'down'> = {
  employment_rate: 'up',
  unemployment_rate: 'down',
  vacancy_rate: 'down',
  gender_pay_gap: 'down',
}

function deltaTone(metricId: string, delta: number): 'good' | 'watch' | 'neutral' {
  if (Math.abs(delta) < 0.05) return 'neutral'
  const dir = DESIRED_DIRECTION[metricId] ?? 'up'
  if (dir === 'up') return delta > 0 ? 'good' : 'watch'
  return delta < 0 ? 'good' : 'watch'
}

function buildNarrative(rows: Array<{ id: string; leftValue: string; rightValue: string; leftTone?: string; rightTone?: string }>, leftLabel: string, rightLabel: string): string {
  if (!rows.length) return ''
  let leftWins = 0
  let rightWins = 0
  rows.forEach(r => {
    const dir = DESIRED_DIRECTION[r.id] ?? 'up'
    const lv = parseFloat(r.leftValue)
    const rv = parseFloat(r.rightValue)
    if (isNaN(lv) || isNaN(rv)) return
    if (dir === 'up') { lv > rv ? leftWins++ : rv > lv ? rightWins++ : null }
    else { lv < rv ? leftWins++ : rv < lv ? rightWins++ : null }
  })
  const total = rows.length
  if (leftWins > rightWins) return `${leftLabel} outperforms ${rightLabel} on ${leftWins} of ${total} indicators.`
  if (rightWins > leftWins) return `${rightLabel} outperforms ${leftLabel} on ${rightWins} of ${total} indicators.`
  return `${leftLabel} and ${rightLabel} are broadly comparable across all ${total} indicators.`
}
```

- [ ] **Step 2: Update MetricRow to include delta column**

Replace the `MetricRow` function in `CompareSection.tsx`:

```typescript
function MetricRow({ id, label, leftValue, rightValue, leftTone, rightTone }: {
  id: string
  label: string
  leftValue: string
  rightValue: string
  leftTone?: string
  rightTone?: string
}) {
  const lv = parseFloat(leftValue)
  const rv = parseFloat(rightValue)
  const delta = (!isNaN(lv) && !isNaN(rv)) ? lv - rv : null
  const tone = delta !== null ? deltaTone(id, delta) : 'neutral'
  const toneColor = tone === 'good' ? 'var(--tone-good)' : tone === 'watch' ? 'var(--tone-watch)' : 'var(--text-muted)'
  const deltaStr = delta !== null ? `${delta > 0 ? '+' : ''}${delta.toFixed(1)} pts` : '—'

  return (
    <div className="compare-row">
      <div className="compare-row__left">
        <span className="compare-row__value">{leftValue}</span>
        {leftTone && (
          <ToneChip tone={leftTone}>
            {leftTone === 'good' ? 'Good' : leftTone === 'watch' ? 'Watch' : 'Neutral'}
          </ToneChip>
        )}
      </div>
      <div className="compare-row__label">
        <span>{label}</span>
        <span className="compare-row__delta" style={{ color: toneColor }}>{deltaStr}</span>
      </div>
      <div className="compare-row__right">
        <span className="compare-row__value">{rightValue}</span>
        {rightTone && (
          <ToneChip tone={rightTone}>
            {rightTone === 'good' ? 'Good' : rightTone === 'watch' ? 'Watch' : 'Neutral'}
          </ToneChip>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Add narrative synthesis above the metric rows**

In `CompareSection.tsx`, update the `metricRows` section in the return JSX. Find the `{metricRows.length > 0 && (` block and replace it:

```typescript
{metricRows.length > 0 && (
  <section className="comparison-section" style={{ marginTop: 24 }}>
    <div className="panel" style={{ minHeight: 'auto', padding: 22 }}>
      {/* Narrative synthesis */}
      {(() => {
        const leftLabel = (((leftData ?? {}) as AnyObj).filters as AnyObj | undefined)
          ? String(((((leftData ?? {}) as AnyObj).filters as AnyObj).applied as AnyObj)?.geography_label ?? leftFilters.country)
          : leftFilters.country === 'ALL' ? 'EU27 Average' : leftFilters.country
        const rightLabel = (((rightData ?? {}) as AnyObj).filters as AnyObj | undefined)
          ? String(((((rightData ?? {}) as AnyObj).filters as AnyObj).applied as AnyObj)?.geography_label ?? rightFilters.country)
          : rightFilters.country === 'ALL' ? 'EU27 Average' : rightFilters.country
        const narrative = buildNarrative(metricRows, leftLabel, rightLabel)
        return narrative ? (
          <p style={{ margin: '0 0 18px', fontSize: '0.92rem', color: 'var(--text-strong)', fontWeight: 600, lineHeight: 1.5 }}>
            {narrative}
          </p>
        ) : null
      })()}
      <p className="panel__eyebrow" style={{ marginBottom: 16 }}>Side-by-side comparison</p>
      <div className="compare-rows">
        {metricRows.map((row) => (
          <MetricRow key={row.id} {...row} />
        ))}
      </div>
    </div>
  </section>
)}
```

- [ ] **Step 4: Add delta CSS to App.css**

Find `.compare-row__label` in `App.css` and update it to accommodate the delta:

```css
.compare-row__delta {
  display: block;
  font-size: 0.72rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  margin-top: 2px;
  letter-spacing: 0.01em;
}
```

- [ ] **Step 5: Verify in browser**

Open Compare page. The metric rows should show a delta column in the centre label area (e.g. "+1.6 pts" in amber when France unemployment is above Ireland). A narrative sentence should appear above the table.

- [ ] **Step 6: Commit**

```bash
git add src/components/sections/CompareSection.tsx src/App.css
git commit -m "feat(compare): delta column with tone, narrative synthesis sentence"
```

---

## Task 7: Pay Analysis — empty-state onboarding and richer cards

**Files:**
- Modify: `src/components/sections/PayAnalysisSection.tsx`

- [ ] **Step 1: Add 3-step onboarding for empty state**

In `PayAnalysisSection.tsx`, find the `{!internalLoaded && (` block at the bottom (around line 282). Replace it entirely with a richer version that appears at the top when both country = EU27 AND no data:

Add this section right after the `<FilterBar>` block (around line 84), before the `{/* Company vs Market */}` section:

```typescript
{/* ── Empty-state onboarding ── */}
{!loading && !internalLoaded && filters.country === 'ALL' && (
  <div className="panel" style={{ padding: 28, marginBottom: 20 }}>
    <p className="panel__eyebrow" style={{ marginBottom: 6 }}>Getting started</p>
    <h2 style={{ margin: '0 0 20px', fontSize: '1.1rem', color: 'var(--text-strong)' }}>
      Three steps to see your pay analysis
    </h2>
    <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {[
        {
          n: '1',
          title: 'Select a country',
          body: 'Use the Country filter above — France, Germany, and Ireland have full EU Pay Transparency Directive simulation available.',
        },
        {
          n: '2',
          title: 'Upload your payroll CSV',
          body: 'Go to Home and upload a payroll CSV (columns: gender, salary, department). Your data stays local — it powers the internal pay gap benchmark.',
        },
        {
          n: '3',
          title: 'Review your benchmark',
          body: 'Your internal pay gap is compared against the live Eurostat market benchmark for your country and sector. Categories with gaps above the Article 9 threshold are flagged for review.',
        },
      ].map(step => (
        <li key={step.n} style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          <span style={{
            flexShrink: 0,
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: 'var(--accent-primary-glow)',
            border: '1px solid var(--accent-primary)',
            color: 'var(--accent-primary)',
            fontWeight: 800,
            fontSize: '0.82rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>{step.n}</span>
          <div>
            <strong style={{ fontSize: '0.88rem', color: 'var(--text-strong)', display: 'block', marginBottom: 3 }}>{step.title}</strong>
            <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.55 }}>{step.body}</p>
          </div>
        </li>
      ))}
    </ol>
  </div>
)}
```

- [ ] **Step 2: Add evidence_summary sub-line to derived score cards**

In `PayAnalysisSection.tsx`, find the `semanticMetrics.map` block (around line 192). Update the article to show the evidence summary:

```typescript
{semanticMetrics.map((metric) => (
  <article key={metric.id as string} className="metric-card">
    <p className="metric-card__eyebrow">{metric.title as string}</p>
    <p className="metric-card__value">{formatValue(metric.value, metric.unit as string)}</p>
    {/* Evidence basis sub-line */}
    {Array.isArray(metric.evidence_summary) && (metric.evidence_summary as string[]).length > 2 && (
      <p style={{ margin: '0 0 6px', fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
        {(metric.evidence_summary as string[])[2]}
      </p>
    )}
    <p className="metric-card__period">{metric.definition as string}</p>
    {Boolean(metric.tone) && (
      <div style={{ marginTop: 8 }}>
        <ToneChip tone={metric.tone as string}>
          {metric.tone === 'good' ? 'Good' : metric.tone === 'watch' ? 'Watch' : 'Neutral'}
        </ToneChip>
      </div>
    )}
  </article>
))}
```

- [ ] **Step 3: Add Article 9 context sentence to pay transparency items**

In `PayAnalysisSection.tsx`, find the pay transparency categories map (around line 227). Add an Article 9 sentence below the note for unresolved items:

```typescript
{((payTransparency.categories as AnyObj[]) ?? []).map((cat) => {
  const internalGap = cat.gap_value as number | undefined
  const marketGap = cat.market_gap as number | undefined
  const diff = (internalGap != null && marketGap != null) ? (internalGap - marketGap) : null
  const needsArticle9 = cat.review_state === 'unresolved_review_item' && diff != null && Math.abs(diff) >= 1
  return (
    <div key={cat.id as string} className="compliance-review-item">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong>{cat.label as string}</strong>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span>{formatValue(cat.gap_value)}</span>
          <ToneChip tone={cat.review_state === 'unresolved_review_item' ? 'watch' : 'neutral'}>
            {REVIEW_STATE_LABELS[cat.review_state as string] ?? cat.review_state as string}
          </ToneChip>
        </div>
      </div>
      {Boolean(cat.note) && <p>{cat.note as string}</p>}
      {needsArticle9 && (
        <p style={{ margin: '6px 0 0', fontSize: '0.78rem', color: 'var(--tone-watch)', lineHeight: 1.5, fontWeight: 500 }}>
          Internal gap is {Math.abs(diff!).toFixed(1)} pts {diff! > 0 ? 'above' : 'below'} the market benchmark — justification required under Article 9 of the EU Pay Transparency Directive.
        </p>
      )}
      <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
        {availableActions.map((action) => (
          <button
            key={action.code as string}
            className={`governance-button governance-button--${action.code}`}
            disabled={actionLoading}
            onClick={() => recordGovernanceAction(action.code as string, 'pay_category', cat.id as string)}
          >
            {action.label as string}
          </button>
        ))}
      </div>
    </div>
  )
})}
```

- [ ] **Step 4: Verify in browser**

With country=ALL and no data loaded: onboarding 3-step guide should appear. With country=FR and internal data: derived score cards should show the evidence basis sub-line (e.g. "Vacancy 0.0%, unemployment 4.3%, slack 12.5"). Unresolved pay categories should show the Article 9 sentence.

- [ ] **Step 5: Commit**

```bash
git add src/components/sections/PayAnalysisSection.tsx
git commit -m "feat(pay-analysis): 3-step onboarding, derived score evidence lines, article 9 context"
```

---

## Task 8: Govern page — chain integrity, always-on automation, richer empty state

**Files:**
- Modify: `src/components/sections/GovernSection.tsx`
- Modify: `src/App.css`

- [ ] **Step 1: Replace GovernSection.tsx entirely**

```typescript
import { useOverviewData } from '../../hooks/useOverviewData'
import { FreshnessPill } from '../primitives/FreshnessPill'
import { Download, Play, CheckCircle, XCircle } from 'lucide-react'
import { DataState } from '../shared/DataState'

type AnyObj = Record<string, unknown>

const dateFormatter = new Intl.DateTimeFormat('en-IE', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

const CADENCE_LABELS: Record<string, string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  daily: 'Daily',
}

const AUDIENCE_LABELS: Record<string, string> = {
  executive_leadership: 'Executive leadership',
  people_analytics_compliance: 'People analytics & compliance',
  legal_compliance_review: 'Legal & compliance review',
}

function formatDate(val: unknown): string {
  if (!val) return '—'
  try { return dateFormatter.format(new Date(val as string)) }
  catch { return '—' }
}

export function GovernSection() {
  const { overview, loading, error, exporting, scheduleLoading, exportEvidencePack, scheduleBrief } = useOverviewData()

  const ov = (overview ?? {}) as AnyObj
  const governance = (ov.governance as AnyObj) ?? {}
  const automation = (ov.automation as AnyObj) ?? {}
  const integrity = (governance.integrity as AnyObj) ?? {}
  const loggedEvents = ((governance.logged_events ?? governance.events) as AnyObj[]) ?? []
  const workflows = (automation.scheduled_workflows as AnyObj[]) ?? []
  const scheduledBriefs = (automation.scheduled_briefs as AnyObj[]) ?? []
  const configuredSchedules = (automation.configured_schedules as AnyObj[]) ?? []
  const handoffs = (automation.pending_handoffs as AnyObj[]) ?? []

  const eventCount = (integrity.event_count as number) ?? loggedEvents.length
  const chainVerified = integrity.verified !== false
  const latestHash = (integrity.latest_hash as string | undefined)?.slice(0, 8) ?? null

  return (
    <div className="dashboard">
      <div className="dashboard__halo dashboard__halo--one" />
      <FreshnessPill />

      <DataState loading={loading} error={error} empty={!loading && !error && !overview}>
        <p className="hero__eyebrow" style={{ marginBottom: 8 }}>Govern & Export</p>

        {/* ── Chain Integrity Status ── */}
        <div className="chain-integrity" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {chainVerified
              ? <CheckCircle size={14} style={{ color: 'var(--tone-good)', flexShrink: 0 }} />
              : <XCircle size={14} style={{ color: 'var(--tone-watch)', flexShrink: 0 }} />
            }
            <span className="chain-integrity__status">
              {chainVerified ? 'Chain intact' : 'Chain break detected'}
            </span>
            <span className="chain-integrity__sep">·</span>
            <span className="chain-integrity__count">{eventCount} {eventCount === 1 ? 'event' : 'events'}</span>
            {latestHash && (
              <>
                <span className="chain-integrity__sep">·</span>
                <span className="chain-integrity__hash">SHA-256: {latestHash}…</span>
              </>
            )}
          </div>
        </div>

        {/* ── Governance Log ── */}
        <section className="comparison-section">
          <div className="panel" style={{ minHeight: 'auto', padding: 22 }}>
            <p className="panel__eyebrow">Governance Log</p>
            <h2 style={{ margin: '6px 0 16px', fontSize: '1.15rem' }}>Decision history</h2>

            {loggedEvents.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: 1.6 }}>
                  No decisions logged yet. The governance log is a tamper-evident, hash-chained record of every pay transparency decision made in this workspace.
                </p>
                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: 1.6 }}>
                  To create entries: go to <strong style={{ color: 'var(--text-strong)' }}>Pay Analysis</strong>, select a country, then approve, override, or reverse pay transparency categories using the action buttons.
                </p>
                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: 1.6 }}>
                  All decisions are included in the evidence pack and are legally defensible under Article 9 of the EU Pay Transparency Directive.
                </p>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.76rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    <th style={{ padding: '0 12px 10px 0', fontWeight: 700 }}>Action</th>
                    <th style={{ padding: '0 12px 10px 0', fontWeight: 700 }}>Category</th>
                    <th style={{ padding: '0 12px 10px 0', fontWeight: 700 }}>Reviewed by</th>
                    <th style={{ padding: '0 0 10px', fontWeight: 700 }}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {loggedEvents.map((event, i) => (
                    <tr key={i} style={{ borderTop: '1px solid rgba(159,185,214,0.1)' }}>
                      <td style={{ padding: '11px 12px 11px 0', color: 'var(--text-strong)', fontWeight: 600 }}>
                        {(event.action_label as string) ?? (event.action_name as string) ?? (event.action_code as string)}
                      </td>
                      <td style={{ padding: '11px 12px 11px 0', color: 'var(--text-muted)' }}>
                        {(event.target_label as string) ?? (event.target_id as string) ?? (event.target_type as string)}
                      </td>
                      <td style={{ padding: '11px 12px 11px 0', color: 'var(--text-muted)' }}>
                        {(event.actor as string) ?? 'Dashboard user'}
                      </td>
                      <td style={{ padding: '11px 0', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {formatDate(event.recorded_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* ── Evidence Pack ── */}
        <section className="comparison-section">
          <div className="panel" style={{ minHeight: 'auto', padding: 22 }}>
            <p className="panel__eyebrow">Evidence Pack</p>
            <h2 style={{ margin: '6px 0 4px', fontSize: '1.15rem' }}>Download compliance evidence</h2>
            <p style={{ margin: '0 0 16px', fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
              A cryptographically hash-chained JSON bundle containing all market data, pay simulation states, and {eventCount} governance {eventCount === 1 ? 'decision' : 'decisions'} — ready for legal or regulatory review.
            </p>

            <div className="product-notes" style={{ marginBottom: 20 }}>
              {[
                'Market metrics with source citations (Eurostat LFS, JVS)',
                'Benchmark comparisons with methodology notes',
                'Pay transparency review items and decisions',
                `Governance decision log with timestamps (${eventCount} events, SHA-256 hash-chained)`,
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

        {/* ── Workflow Automation — always visible ── */}
        <section className="comparison-section">
          <div className="panel" style={{ minHeight: 'auto', padding: 22 }}>
            <p className="panel__eyebrow">Workflow Automation</p>
            <h2 style={{ margin: '6px 0 16px', fontSize: '1.15rem' }}>Scheduled workflows</h2>

            {configuredSchedules.length > 0 ? (
              <div className="phase5-configured" style={{ marginBottom: 24 }}>
                {configuredSchedules.map((wf) => (
                  <div key={wf.schedule_id as string ?? wf.id as string} className="phase5-handoff">
                    <div>
                      <strong>{wf.label as string}</strong>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem', display: 'block', marginTop: 3 }}>
                        {CADENCE_LABELS[wf.cadence as string] ?? (wf.cadence as string)} · {wf.approval_required ? 'Requires approval' : 'Auto-runs'} · Status: {wf.status as string}
                      </span>
                    </div>
                    <button
                      className="governance-button governance-button--approve"
                      onClick={() => scheduleBrief(wf as { id: string; label: string })}
                      disabled={scheduleLoading}
                      style={{ display: 'flex', gap: 6, alignItems: 'center' }}
                    >
                      <Play size={14} /> Run now
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ margin: '0 0 20px', fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                No active schedules. Configure one of the templates below to automatically generate briefs or compliance packs on a recurring cadence.
              </p>
            )}

            {/* Always show available templates */}
            {scheduledBriefs.length > 0 && (
              <>
                <p className="panel__eyebrow" style={{ marginBottom: 12 }}>Available templates</p>
                <div className="phase5-configured">
                  {scheduledBriefs.map((brief) => (
                    <div key={brief.id as string} className="phase5-handoff">
                      <div>
                        <strong>{brief.label as string}</strong>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem', display: 'block', marginTop: 3 }}>
                          {CADENCE_LABELS[brief.cadence as string] ?? brief.cadence as string} · {brief.approval_required ? 'Requires approval' : 'Auto-runs'}
                        </span>
                      </div>
                      <button
                        className="governance-button governance-button--approve"
                        onClick={() => scheduleBrief(brief as { id: string; label: string })}
                        disabled={scheduleLoading}
                        style={{ display: 'flex', gap: 6, alignItems: 'center' }}
                      >
                        <Play size={14} /> Schedule
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Pending handoffs */}
            {handoffs.length > 0 && (
              <>
                <p className="panel__eyebrow" style={{ marginBottom: 12, marginTop: 24 }}>Actions required</p>
                <div className="phase5-alert-list">
                  {handoffs.map((handoff) => (
                    <div key={handoff.id as string} className="phase5-alert">
                      <div className="phase5-alert__top">
                        <div>
                          <h3>{handoff.title as string}</h3>
                          <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                            {AUDIENCE_LABELS[handoff.target_audience as string] ?? (handoff.target_audience as string)}
                          </p>
                        </div>
                        <span className="comparison-meta__pill" style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                          {(() => { const s = handoff.status as string; return s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Pending' })()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </section>

      </DataState>
    </div>
  )
}
```

- [ ] **Step 2: Add chain-integrity CSS to App.css**

```css
/* ── Chain Integrity ───────────────────────────────────────────────────── */
.chain-integrity {
  font-size: 0.78rem;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  gap: 6px;
}

.chain-integrity__status {
  font-weight: 700;
  color: var(--text-strong);
}

.chain-integrity__sep {
  color: var(--border-medium);
}

.chain-integrity__count {
  font-variant-numeric: tabular-nums;
}

.chain-integrity__hash {
  font-family: monospace;
  font-size: 0.72rem;
  color: var(--text-muted);
}
```

- [ ] **Step 3: Verify in browser**

Govern page should show chain integrity header: "✓ Chain intact · 9 events · SHA-256: 840a02bd…". Automation section should always be visible with both configured schedules and available templates. Empty governance log shows 3-paragraph orientation guide.

- [ ] **Step 4: Commit**

```bash
git add src/components/sections/GovernSection.tsx src/App.css
git commit -m "feat(govern): chain integrity status, always-on automation templates, richer empty state"
```

---

## Task 9: Sidebar — live market pulse

**Files:**
- Create: `src/components/layout/SidebarContext.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/layout/Sidebar.tsx`
- Modify: `src/App.css`

- [ ] **Step 1: Create SidebarContext**

Create `src/components/layout/SidebarContext.tsx`:

```typescript
import { createContext, useContext } from 'react'

export interface SidebarSignal {
  title: string
  tone: string
  detail: string
}

export interface SidebarData {
  geographyLabel: string
  topSignal: SidebarSignal | null
  governanceEventCount: number
}

export const SidebarContext = createContext<SidebarData>({
  geographyLabel: '',
  topSignal: null,
  governanceEventCount: 0,
})

export function useSidebarData() {
  return useContext(SidebarContext)
}
```

- [ ] **Step 2: Feed SidebarContext from App.tsx**

In `App.tsx`, create a thin provider component that reads from `useOverviewData` and feeds the context. Add this component above `AppShell`:

```typescript
import { SidebarContext } from './components/layout/SidebarContext'
import { useOverviewData } from './hooks/useOverviewData'

function SidebarProvider({ children }: { children: React.ReactNode }) {
  const { overview } = useOverviewData()
  const ov = (overview ?? {}) as Record<string, unknown>
  const intel = (ov.intelligence as Record<string, unknown>) ?? {}
  const signals = (intel.signals as Array<Record<string, unknown>>) ?? []
  const govRaw = (ov.governance as Record<string, unknown>) ?? {}
  const integrity = (govRaw.integrity as Record<string, unknown>) ?? {}
  const appliedFilters = ((ov.filters as Record<string, unknown>)?.applied as Record<string, unknown>) ?? {}

  const topSignal = signals[0]
    ? { title: signals[0].title as string, tone: signals[0].tone as string, detail: signals[0].summary as string ?? '' }
    : null

  return (
    <SidebarContext.Provider value={{
      geographyLabel: (appliedFilters.geography_label as string) ?? '',
      topSignal,
      governanceEventCount: (integrity.event_count as number) ?? 0,
    }}>
      {children}
    </SidebarContext.Provider>
  )
}
```

Wrap the `<Sidebar>` and `<main>` in `AppShell` with `<SidebarProvider>`:

```typescript
// In AppShell return, replace the app-body div:
<div className="app-body">
  <SidebarProvider>
    <Sidebar onCopilotOpen={() => setCopilotOpen(true)} />
    <main className="app-main">
      <Routes>
        <Route path="/" element={<HomeSection />} />
        <Route path="/market" element={<MarketSection />} />
        <Route path="/compare" element={<CompareSection />} />
        <Route path="/pay-analysis" element={<PayAnalysisSection />} />
        <Route path="/govern" element={<GovernSection />} />
      </Routes>
    </main>
  </SidebarProvider>
</div>
```

- [ ] **Step 3: Update Sidebar to show live pulse**

Replace `Sidebar.tsx` entirely:

```typescript
import { NavLink } from 'react-router-dom'
import { BarChart2, Home, Scale, ShieldCheck, MessageSquare, GitCompare } from 'lucide-react'
import { useSidebarData } from './SidebarContext'

const NAV_ITEMS = [
  { to: '/', label: 'Home', Icon: Home, end: true },
  { to: '/market', label: 'Market Intelligence', Icon: BarChart2 },
  { to: '/compare', label: 'Compare', Icon: GitCompare },
  { to: '/pay-analysis', label: 'Pay Analysis', Icon: Scale },
  { to: '/govern', label: 'Govern & Export', Icon: ShieldCheck },
]

const TONE_DOT: Record<string, string> = {
  good: 'var(--tone-good)',
  watch: 'var(--tone-watch)',
  neutral: 'var(--text-muted)',
}

export function Sidebar({ onCopilotOpen }: { onCopilotOpen: () => void }) {
  const { geographyLabel, topSignal, governanceEventCount } = useSidebarData()

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
              {/* Governance event count badge on Govern link */}
              {to === '/govern' && governanceEventCount > 0 && (
                <span className="sidebar__badge">{governanceEventCount}</span>
              )}
            </NavLink>
          </li>
        ))}
      </ul>

      {/* Market pulse strip */}
      {(geographyLabel || topSignal) && (
        <div className="sidebar__pulse">
          {geographyLabel && (
            <p className="sidebar__pulse-label">Viewing</p>
          )}
          {geographyLabel && (
            <p className="sidebar__pulse-geo">{geographyLabel}</p>
          )}
          {topSignal && (
            <div className="sidebar__pulse-signal">
              <span
                className="sidebar__pulse-dot"
                style={{ background: TONE_DOT[topSignal.tone] ?? 'var(--text-muted)' }}
              />
              <span className="sidebar__pulse-text">{topSignal.title}</span>
              <span className="sidebar__pulse-tone" style={{ color: TONE_DOT[topSignal.tone] ?? 'var(--text-muted)' }}>
                {topSignal.tone === 'good' ? 'Good' : topSignal.tone === 'watch' ? 'Watch' : 'Neutral'}
              </span>
            </div>
          )}
        </div>
      )}

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

- [ ] **Step 4: Add sidebar pulse CSS to App.css**

Add after `.sidebar__copilot:hover`:

```css
/* ── Sidebar Badge ─────────────────────────────────────────────────────── */
.sidebar__badge {
  margin-left: auto;
  font-size: 0.65rem;
  font-weight: 700;
  background: var(--accent-primary-glow);
  color: var(--accent-primary);
  border: 1px solid var(--accent-primary);
  border-radius: 999px;
  padding: 1px 6px;
  min-width: 18px;
  text-align: center;
}

/* ── Sidebar Pulse Strip ───────────────────────────────────────────────── */
.sidebar__pulse {
  margin: 12px 0;
  padding: 12px 14px;
  border: 1px solid var(--border-light);
  border-radius: 10px;
  background: var(--bg-elevated);
}

.sidebar__pulse-label {
  margin: 0 0 2px;
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
}

.sidebar__pulse-geo {
  margin: 0 0 10px;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--text-strong);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sidebar__pulse-signal {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.75rem;
}

.sidebar__pulse-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.sidebar__pulse-text {
  flex: 1;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sidebar__pulse-tone {
  font-weight: 700;
  font-size: 0.7rem;
  flex-shrink: 0;
}
```

- [ ] **Step 5: Verify in browser**

Sidebar should show a small "Viewing / EU27 proxy market average" + "● Hiring pressure · Neutral" strip between the nav links and the AI Analyst button. The Govern link should show a badge with the event count (e.g. "9").

- [ ] **Step 6: Commit**

```bash
git add src/components/layout/SidebarContext.tsx src/components/layout/Sidebar.tsx src/App.tsx src/App.css
git commit -m "feat(sidebar): live market pulse strip and governance event count badge"
```

---

## Task 10: Build and smoke-test

**Files:** None new

- [ ] **Step 1: Run TypeScript check**

```bash
cd dashboard/frontend && npx tsc --noEmit
```

Expected: no errors. If errors appear — they will be type mismatches on `AnyObj` casts — fix by adding `as AnyObj` or `as string` where the compiler complains.

- [ ] **Step 2: Run existing test suite**

```bash
cd dashboard/frontend && npm test -- --run
```

Expected: all tests pass. The changes are additive — no existing component API changed.

- [ ] **Step 3: Build production bundle**

```bash
cd dashboard/frontend && npm run build
```

Expected: build succeeds with no errors. Note any warnings about bundle size.

- [ ] **Step 4: Manual smoke test — EU27 view**

Open `http://localhost:5173`. Verify:
- Score pulse strip shows 4 items with fill bars
- Country dropdown shows "EU27 proxy market average", "Austria", "Belgium"…
- Metric cards show benchmark annotation ("● X pts above/below · EU27 proxy average")
- Sidebar shows pulse strip with geography label and top signal

- [ ] **Step 5: Manual smoke test — France filter**

Select France from Country dropdown. Verify:
- Metric card benchmark annotation updates to "Prior period" basis
- Brief updates to France-specific headline
- Pay Analysis onboarding hides (country is now set)

- [ ] **Step 6: Manual smoke test — Compare page**

Navigate to Compare. Verify:
- Country dropdowns show full names
- Metric rows show delta column in centre
- Narrative sentence appears above table

- [ ] **Step 7: Manual smoke test — Market page**

Navigate to Market Intelligence. Verify:
- Chart titles include period e.g. "Unemployment trend · 2024"
- Dashed EU average reference line appears on trend charts
- Signal cards show monospace score badges e.g. "79/100"
- Benchmark context notice appears above charts

- [ ] **Step 8: Manual smoke test — Govern page**

Navigate to Govern. Verify:
- Chain integrity row shows "✓ Chain intact · N events · SHA-256: xxxxxxxx…"
- Automation section always visible with templates
- If no governance events: 3-paragraph empty state guide

- [ ] **Step 9: Final commit**

```bash
git add -A
git commit -m "chore: final build verification — informational upgrade complete"
```
