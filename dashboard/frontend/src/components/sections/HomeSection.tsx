import { useNavigate } from 'react-router-dom'
import { useOverviewData } from '../../hooks/useOverviewData'
import { MetricCard } from '../primitives/MetricCard'
import { FreshnessPill } from '../primitives/FreshnessPill'
import { DataState } from '../shared/DataState'
import { FilterBar } from '../shared/FilterBar'
import {
  AlertTriangle, CheckCircle, Upload, ArrowRight, Download,
  FileText, Scale, Lock, BarChart2, Search, ShieldAlert, Globe,
  TrendingUp, TrendingDown, Minus, Briefcase, Users, ShieldCheck,
} from 'lucide-react'

type AnyObj = Record<string, unknown>

/* ── helpers ──────────────────────────────────────────────────────────── */
const SOURCE_LABELS: Record<string, string> = {
  eurostat_lfs: 'Eurostat Labour Force Survey',
  eurostat_jvs: 'Eurostat Job Vacancy Statistics',
  eurostat_ses: 'Eurostat Structure of Earnings Survey',
}

/** Shorten very long NACE sector names */
function shortSector(label: string): string {
  const map: Record<string, string> = {
    'Administrative and support service activities': 'Admin & Support Services',
    'Financial and insurance activities': 'Finance & Insurance',
    'Information and communication': 'Information & Communication',
    'Professional, scientific and technical activities': 'Professional & Technical',
    'Wholesale and retail trade; repair of motor vehicles and motorcycles': 'Wholesale & Retail Trade',
    'Human health and social work activities': 'Health & Social Work',
    'Accommodation and food service activities': 'Accommodation & Food',
    'Arts, entertainment and recreation': 'Arts & Recreation',
    'Transportation and storage': 'Transportation & Storage',
    'Public administration and defence; compulsory social security': 'Public Administration',
    'Construction': 'Construction',
    'Manufacturing': 'Manufacturing',
    'Education': 'Education',
  }
  return map[label] ?? (label.length > 38 ? label.slice(0, 36) + '…' : label)
}

function DeltaIcon({ tone }: { tone: string }) {
  if (tone === 'good')  return <TrendingUp   size={14} style={{ color: 'var(--tone-good)',  flexShrink: 0 }} />
  if (tone === 'watch') return <TrendingDown size={14} style={{ color: 'var(--tone-watch)', flexShrink: 0 }} />
  return                       <Minus        size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
}

const SIGNAL_META: Record<string, { icon: typeof BarChart2; metricId: string; cta: string }> = {
  signal_hiring_pressure:   { icon: Briefcase,   metricId: 'vacancy_rate',      cta: 'Explore vacancies' },
  signal_labour_resilience: { icon: Users,        metricId: 'employment_rate',   cta: 'View employment trend' },
  signal_equity_risk:       { icon: ShieldCheck,  metricId: 'gender_pay_gap',    cta: 'Review pay equity' },
}

const HANDOFF_META: Record<string, { icon: typeof FileText; desc: string; route: string }> = {
  handoff_executive_brief:   { icon: FileText, desc: 'AI-written narrative ready for leadership distribution.', route: '/market' },
  handoff_evidence_pack:     { icon: Download, desc: 'Hash-chained bundle for legal & regulatory filing.',       route: '/govern' },
  handoff_compliance_review: { icon: Scale,    desc: 'Route pay-equity items to legal for approval or override.', route: '/pay-analysis' },
}

/* ════════════════════════════════════════════════════════════════════════
   HomeSection
   ════════════════════════════════════════════════════════════════════════ */
export function HomeSection() {
  const {
    overview, filters, setFilters, loading, error,
    exporting, uploadPayroll, exportEvidencePack,
  } = useOverviewData()
  const navigate = useNavigate()

  const ov      = (overview ?? {}) as AnyObj
  const options = ((ov.filters as AnyObj)?.options as Record<string, unknown>) ?? {}
  const current = ((ov.filters as AnyObj)?.current as AnyObj) ?? {}
  const isEU27  = !current.country || current.country === 'ALL'

  /* ── brief & deltas ─────────────────────────────────────────────────── */
  const briefRaw     = (ov.brief as AnyObj | undefined) ?? {}
  const briefSummary = (briefRaw.summary as AnyObj | undefined) ?? {}
  const headline     = String(briefSummary.headline ?? briefRaw.title ?? '')
  const bodyText     = String(briefSummary.body ?? '')
  const confidence   = String(briefSummary.confidence ?? '')
  const whatChanged  = (briefRaw.what_changed as AnyObj | undefined) ?? {}
  const basisLabel   = String((whatChanged.basis as AnyObj | undefined)?.label ?? '')
  const metricDeltas = (whatChanged.items as AnyObj[]) ?? []
  const provenance   = (briefRaw.provenance as AnyObj[]) ?? []
  const sources      = [...new Set(provenance.map(p => p.source_id as string).filter(Boolean))]

  /* ── metrics & intelligence ─────────────────────────────────────────── */
  const metrics  = (ov.metrics as AnyObj[]) ?? []
  const metricById: Record<string, AnyObj> = {}
  metrics.forEach(m => { metricById[m.id as string] = m })

  const intel           = (ov.intelligence as AnyObj | undefined) ?? {}
  const signals         = (intel.signals as AnyObj[]) ?? []
  const watchSignals    = signals.filter(s => s.tone === 'watch')
  const recommendations = (intel.recommendations as AnyObj[]) ?? []
  const watchlist       = (intel.watchlist as AnyObj[]) ?? []

  /* ── sector chart data ──────────────────────────────────────────────── */
  const charts           = (ov.charts as AnyObj | undefined) ?? {}
  const vacancyBySector  = ((charts.vacancy_by_sector as AnyObj)?.series as AnyObj[]) ?? []
  const payGapBySector   = ((charts.pay_gap_by_sector as AnyObj)?.series as AnyObj[]) ?? []
  // Sort descending and take top 5
  const topVacancy = [...vacancyBySector].sort((a, b) => (b.value as number) - (a.value as number)).slice(0, 5)
  const topPayGap  = [...payGapBySector].sort((a, b) => (b.value as number) - (a.value as number)).slice(0, 5)
  const maxVacancy = (topVacancy[0]?.value as number) || 1
  const maxPayGap  = (topPayGap[0]?.value as number) || 1

  /* ── pay transparency ───────────────────────────────────────────────── */
  const pt              = (ov.pay_transparency as AnyObj | undefined) ?? {}
  const ptAvailable     = Boolean(pt.available)
  const ptSummary       = (pt.summary as AnyObj | undefined) ?? {}
  const unresolvedCount = (ptSummary.unresolved_review_item_count as number) ?? 0
  const ptTopItems      = (pt.top_review_items as AnyObj[]) ?? []
  const ptNote          = String(pt.unavailable_reason ?? '')

  /* ── automation ─────────────────────────────────────────────────────── */
  const automation = (ov.automation as AnyObj | undefined) ?? {}
  const handoffs   = (automation.handoffs as AnyObj[]) ?? []

  /* ── company benchmark ──────────────────────────────────────────────── */
  const cb           = (ov.company_benchmark as AnyObj | undefined) ?? {}
  const benchmarkAvail = Boolean(cb.available)

  /* ── governance ─────────────────────────────────────────────────────── */
  const gov        = (ov.governance as AnyObj | undefined) ?? {}
  const govInt     = (gov.integrity as AnyObj | undefined) ?? {}
  const eventCount = (govInt.event_count as number) ?? 0

  /* ── needs-attention items ──────────────────────────────────────────── */
  const urgentItems = [
    ...watchSignals.slice(0, 2).map(s => ({ text: s.title as string, route: '/market', type: 'signal' as const })),
    ...watchlist.slice(0, 2).map(w => ({ text: `${w.label as string}: ${w.detail as string}`, route: '/market', type: 'watch' as const })),
    ...(unresolvedCount > 0
      ? [{ text: `${unresolvedCount} pay transparency ${unresolvedCount === 1 ? 'category needs' : 'categories need'} review`, route: '/pay-analysis', type: 'signal' as const }]
      : []),
  ]

  return (
    <div className="dashboard">
      <div className="dashboard__halo dashboard__halo--one" />
      <div className="dashboard__halo dashboard__halo--two" />

      {/* ── header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <p className="hero__eyebrow" style={{ margin: 0 }}>Command Centre</p>
        <FreshnessPill />
      </div>

      <FilterBar filters={filters} options={options} onFilterChange={setFilters} />

      <DataState loading={loading} error={error} empty={!loading && !error && !overview}>

        {/* ════════════════════════════════════════════════════════════════
            § 0 — SCORE PULSE STRIP
            4 composite scores from semantic_metrics — hiring pressure,
            labour resilience, equity risk, transition readiness
        ════════════════════════════════════════════════════════════════ */}
        {metrics.length > 0 && (
          <section className="score-pulse" style={{ marginBottom: 20 }}>
            {((ov.semantic_metrics as AnyObj[]) ?? []).map((sm) => {
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

        {/* ════════════════════════════════════════════════════════════════
            § 1 — EXECUTIVE BRIEF  (AI narrative only — no metric duplication)
        ════════════════════════════════════════════════════════════════ */}
        {headline && (
          <section className="brief-hero panel" style={{ marginBottom: 24, padding: '26px 28px' }}>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
              <p className="panel__eyebrow" style={{ margin: 0 }}>Executive Brief</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                {confidence && (
                  <span className={`tone-chip tone-chip--${confidence === 'high' ? 'good' : confidence === 'medium' ? 'neutral' : 'watch'}`} style={{ fontSize: '0.7rem' }}>
                    {confidence.charAt(0).toUpperCase() + confidence.slice(1)} confidence
                  </span>
                )}
                {basisLabel && (
                  <span className="comparison-meta__pill" style={{ fontSize: '0.7rem' }}>
                    <Globe size={10} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                    Benchmark: {basisLabel}
                  </span>
                )}
              </div>
            </div>

            <h1 style={{ margin: '0 0 10px', fontSize: 'clamp(1.15rem, 2vw, 1.5rem)', fontWeight: 800, color: 'var(--text-strong)', letterSpacing: '-0.025em', lineHeight: 1.25, maxWidth: '70ch' }}>
              {headline}
            </h1>

            {/* Body text — filtered to remove methodology noise */}
            {bodyText && (
              <p style={{ margin: '0 0 20px', fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: 1.65, maxWidth: '80ch' }}>
                {bodyText
                  .replace(/\s*Active benchmark basis:[^.]+\./g, '')
                  .replace(/\s*All \d+ observed metrics are currently comparable[^.]+\./g, '')
                  .trim()}
              </p>
            )}


            {/* Data sources */}
            {sources.length > 0 && (
              <div style={{ marginTop: 18, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: '0.67rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Sources</span>
                {sources.map(sid => (
                  <span key={sid} className="comparison-meta__pill" style={{ fontSize: '0.67rem' }}>
                    {SOURCE_LABELS[sid] ?? sid}
                  </span>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ════════════════════════════════════════════════════════════════
            § 2 — LIVE MARKET INDICATORS
        ════════════════════════════════════════════════════════════════ */}
        {metrics.length > 0 && (
          <section style={{ marginBottom: 24 }}>
            <p className="panel__eyebrow" style={{ marginBottom: 10 }}>Live Market Indicators</p>
            <div className="metric-grid">
              {metrics.map(m => (
                <MetricCard key={m.id as string} metric={m} onClick={() => navigate('/market')} />
              ))}
            </div>
          </section>
        )}

        {/* ════════════════════════════════════════════════════════════════
            § 3 — ANALYST RECOMMENDATIONS
            Priority-ranked actions derived from the live data — these tell
            you WHAT TO DO, not just what the numbers are.
        ════════════════════════════════════════════════════════════════ */}
        {recommendations.length > 0 && (
          <section style={{ marginBottom: 24 }}>
            <p className="panel__eyebrow" style={{ marginBottom: 10 }}>Analyst Recommendations</p>
            <div className="signal-cards-grid">
              {recommendations.map((rec, i) => {
                const priority = String(rec.priority)
                const needsReview = Boolean(rec.review_required)
                const route = (rec.id as string)?.includes('hiring') ? '/market'
                  : (rec.id as string)?.includes('equity') ? '/pay-analysis'
                  : '/market'
                return (
                  <button
                    key={i}
                    className={`signal-card signal-card--${priority === 'high' ? 'watch' : priority === 'medium' ? 'neutral' : 'good'}`}
                    onClick={() => navigate(route)}
                  >
                    <div className="signal-card__top">
                      <span className={`badge-priority badge-priority--${priority}`}>{priority}</span>
                      {needsReview && (
                        <span className="badge-action-needed" style={{ fontSize: '0.62rem' }}>
                          <AlertTriangle size={10} /> Review required
                        </span>
                      )}
                    </div>
                    <strong className="signal-card__title">{rec.title as string}</strong>
                    <p className="signal-card__detail">{rec.detail as string}</p>
                    <div className="signal-card__footer">
                      <span>Take action</span>
                      <ArrowRight size={12} />
                    </div>
                  </button>
                )
              })}
            </div>
          </section>
        )}

        {/* ════════════════════════════════════════════════════════════════
            § 4 — SECTOR SPOTLIGHT
            Left: Top hiring pressure sectors (vacancy rate)
            Right: Top pay gap sectors (gender pay gap)
            — uses chart series data from the API
        ════════════════════════════════════════════════════════════════ */}
        {(topVacancy.length > 0 || topPayGap.length > 0) && (
          <section style={{ marginBottom: 24 }}>
            <p className="panel__eyebrow" style={{ marginBottom: 10 }}>Sector Spotlight — ranked by market signal intensity</p>
            <div className="dashboard-grid">

              {/* Vacancy pressure ranking */}
              {topVacancy.length > 0 && (
                <div className="panel" style={{ padding: 22, minHeight: 'auto' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                    <div style={{ padding: 8, borderRadius: 8, background: 'var(--tone-watch-bg)', color: 'var(--tone-watch)', display: 'flex' }}>
                      <Search size={15} />
                    </div>
                    <div>
                      <p className="panel__eyebrow" style={{ margin: 0 }}>Hiring Pressure</p>
                      <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-strong)' }}>
                        Tightest talent markets
                      </h3>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {topVacancy.map((row, i) => {
                      const pct = ((row.value as number) / maxVacancy) * 100
                      const isHotspot = i === 0
                      return (
                        <div key={i} className="sector-bar-row">
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', minWidth: 16 }}>#{i + 1}</span>
                              <span style={{ fontSize: '0.82rem', color: 'var(--text-strong)', fontWeight: isHotspot ? 700 : 500 }}>
                                {shortSector(row.sector_label as string)}
                              </span>
                              {isHotspot && (
                                <span className="badge-action-needed" style={{ fontSize: '0.62rem', padding: '1px 6px' }}>
                                  Hotspot
                                </span>
                              )}
                            </div>
                            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: isHotspot ? 'var(--tone-watch)' : 'var(--text-strong)', flexShrink: 0, marginLeft: 8 }}>
                              {(row.value as number).toFixed(1)}%
                            </span>
                          </div>
                          <div className="sector-bar-track">
                            <div
                              className={`sector-bar-fill sector-bar-fill--${isHotspot ? 'watch' : 'neutral'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  <p style={{ margin: '14px 0 0', fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                    Vacancy rate by sector · {topVacancy[0]?.period as string} · Higher = harder to fill roles
                  </p>
                  <button className="panel__action" onClick={() => navigate('/market')} style={{ marginTop: 10 }}>
                    <BarChart2 size={13} /> Explore vacancy trends
                  </button>
                </div>
              )}

              {/* Pay gap ranking */}
              {topPayGap.length > 0 && (
                <div className="panel" style={{ padding: 22, minHeight: 'auto' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                    <div style={{ padding: 8, borderRadius: 8, background: 'rgba(251,191,36,0.12)', color: '#f59e0b', display: 'flex' }}>
                      <ShieldAlert size={15} />
                    </div>
                    <div>
                      <p className="panel__eyebrow" style={{ margin: 0 }}>Pay Equity Exposure</p>
                      <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-strong)' }}>
                        Widest market pay gaps
                      </h3>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {topPayGap.map((row, i) => {
                      const pct     = ((row.value as number) / maxPayGap) * 100
                      const isWorst = i === 0
                      return (
                        <div key={i} className="sector-bar-row">
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', minWidth: 16 }}>#{i + 1}</span>
                              <span style={{ fontSize: '0.82rem', color: 'var(--text-strong)', fontWeight: isWorst ? 700 : 500 }}>
                                {shortSector(row.sector_label as string)}
                              </span>
                              {isWorst && (
                                <span style={{ fontSize: '0.62rem', padding: '1px 6px', borderRadius: 4, background: 'rgba(251,191,36,0.12)', color: '#f59e0b', fontWeight: 700, flexShrink: 0 }}>
                                  Widest
                                </span>
                              )}
                            </div>
                            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: isWorst ? '#f59e0b' : 'var(--text-strong)', flexShrink: 0, marginLeft: 8 }}>
                              {(row.value as number).toFixed(1)}%
                            </span>
                          </div>
                          <div className="sector-bar-track">
                            <div
                              className="sector-bar-fill sector-bar-fill--equity"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  <p style={{ margin: '14px 0 0', fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                    Market gender pay gap by sector · {topPayGap[0]?.period as string} · Internal exposure varies by headcount
                  </p>
                  <button className="panel__action" onClick={() => navigate('/pay-analysis')} style={{ marginTop: 10 }}>
                    <Scale size={13} /> Open pay analysis
                  </button>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ════════════════════════════════════════════════════════════════
            § 5 — NEEDS ATTENTION
        ════════════════════════════════════════════════════════════════ */}
        {urgentItems.length > 0 && (
          <section style={{ marginBottom: 24 }}>
            <p className="panel__eyebrow" style={{ marginBottom: 10 }}>Needs Attention</p>
            <div className="product-notes">
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
            </div>
          </section>
        )}

        {/* ════════════════════════════════════════════════════════════════
            § 6 — WHAT TO DO NEXT  (guided workflow)
        ════════════════════════════════════════════════════════════════ */}
        <section style={{ marginBottom: 24 }}>
          <p className="panel__eyebrow" style={{ marginBottom: 10 }}>What to do next</p>
          <div className="workflow-grid">
            {handoffs.map((h) => {
              const hid       = h.id as string
              const meta      = HANDOFF_META[hid]
              const Icon      = meta?.icon ?? FileText
              const isBlocked = h.status === 'blocked'
              return (
                <div
                  key={hid}
                  className={`workflow-card${isBlocked ? ' workflow-card--blocked' : ''}`}
                  onClick={() => !isBlocked && navigate(meta?.route ?? '/')}
                  role="button"
                  tabIndex={isBlocked ? -1 : 0}
                  onKeyDown={e => e.key === 'Enter' && !isBlocked && navigate(meta?.route ?? '/')}
                  aria-disabled={isBlocked}
                >
                  <div className="workflow-card__icon">
                    {isBlocked ? <Lock size={18} /> : <Icon size={18} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <strong className="workflow-card__title">{h.title as string}</strong>
                    <p className="workflow-card__desc">
                      {isBlocked
                        ? h.blocked_reason as string
                        : (meta?.desc ?? h.approval_checkpoint as string)}
                    </p>
                  </div>
                  {isBlocked
                    ? <span className="badge-priority badge-priority--low" style={{ flexShrink: 0 }}>Locked</span>
                    : <ArrowRight size={15} className="workflow-card__arrow" />}
                </div>
              )
            })}

            {/* Unlock nudge for EU27 */}
            {isEU27 && !ptAvailable && (
              <div className="workflow-card workflow-card--unlock">
                <div className="workflow-card__icon workflow-card__icon--unlock">
                  <Scale size={18} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <strong className="workflow-card__title">Unlock Pay Transparency Simulation</strong>
                  <p className="workflow-card__desc">
                    Select a country above — <strong>France (FR)</strong>, <strong>Germany (DE)</strong> or <strong>Ireland (IE)</strong> — to simulate EU Pay Transparency Directive compliance against your internal pay categories.
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════════
            § 7 — BOTTOM ROW
            Left: Pay transparency simulation  |  Right: Evidence pack + payroll
        ════════════════════════════════════════════════════════════════ */}
        <div className="dashboard-grid">

          {/* Pay transparency */}
          <section className="panel" style={{ padding: 22, minHeight: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <p className="panel__eyebrow" style={{ margin: '0 0 3px' }}>Pay Transparency</p>
                <h2 style={{ margin: 0, fontSize: '1.05rem' }}>EU Directive simulation</h2>
              </div>
              {ptAvailable && (
                <span className={`tone-chip ${unresolvedCount > 0 ? 'tone-chip--watch' : 'tone-chip--good'}`}>
                  {unresolvedCount > 0 ? `${unresolvedCount} unresolved` : 'All clear'}
                </span>
              )}
            </div>

            {ptAvailable ? (
              <>
                {/* Summary stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
                  {[
                    { label: 'Categories', value: String(ptSummary.category_count ?? 0) },
                    { label: 'Unresolved', value: String(unresolvedCount) },
                    { label: 'Max internal gap', value: ptSummary.max_internal_gap != null ? `${(ptSummary.max_internal_gap as number).toFixed(1)}%` : '—' },
                  ].map(s => (
                    <div key={s.label} style={{ padding: '8px 10px', borderRadius: 8, background: 'var(--bg-elevated)', border: '1px solid var(--border-light)', textAlign: 'center' }}>
                      <span style={{ fontSize: '0.67rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.label}</span>
                      <strong style={{ fontSize: '1rem', color: 'var(--text-strong)' }}>{s.value}</strong>
                    </div>
                  ))}
                </div>

                {/* Top review items */}
                {ptTopItems.slice(0, 3).map((item, i) => {
                  const cat     = item.worker_category as AnyObj
                  const intGap  = (item.internal_gap as number).toFixed(1)
                  const mktGap  = (item.market_gap as number).toFixed(1)
                  const delta   = item.gap_to_market as number
                  const isAbove = delta > 0
                  return (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 12px', borderRadius: 8, background: 'var(--bg-elevated)', border: '1px solid var(--border-light)', marginBottom: 7 }}>
                      <div style={{ minWidth: 0 }}>
                        <strong style={{ fontSize: '0.83rem', color: 'var(--text-strong)', display: 'block' }}>
                          {cat.label as string}
                        </strong>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          Internal {intGap}% · Market benchmark {mktGap}%
                        </span>
                      </div>
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: Math.abs(delta) > 1 ? 'var(--tone-watch)' : 'var(--tone-good)', flexShrink: 0, marginLeft: 10 }}>
                        {isAbove ? '+' : ''}{delta.toFixed(1)} pts
                      </span>
                    </div>
                  )
                })}

                <button className="panel__action" onClick={() => navigate('/pay-analysis')} style={{ marginTop: 8 }}>
                  <Scale size={13} /> Review all {ptSummary.category_count as number} categories
                </button>
              </>
            ) : (
              <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <div style={{ padding: 10, borderRadius: 10, background: 'var(--bg-elevated)', flexShrink: 0 }}>
                  <Lock size={18} style={{ color: 'var(--text-muted)' }} />
                </div>
                <div>
                  <p style={{ margin: '0 0 8px', fontSize: '0.83rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                    {ptNote || 'Select a specific country to simulate compliance under the EU Pay Transparency Directive (2023/970).'}
                  </p>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
                    → Try: France (FR), Germany (DE) or Ireland (IE)
                  </p>
                </div>
              </div>
            )}
          </section>

          {/* Evidence pack + payroll */}
          <section className="panel" style={{ padding: 22, minHeight: 'auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

            <div>
              <p className="panel__eyebrow" style={{ margin: '0 0 3px' }}>Compliance Export</p>
              <h2 style={{ margin: '0 0 10px', fontSize: '1.05rem' }}>Evidence pack</h2>
              <p style={{ margin: '0 0 12px', fontSize: '0.81rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                A cryptographically-hashed JSON bundle containing all market data, pay simulation states, and your full governance audit trail ({eventCount} events) — ready for legal or regulatory review.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 16 }}>
                {[
                  'Live Eurostat market snapshots (LFS, JVS)',
                  'Pay transparency simulation results',
                  `Governance audit log (${eventCount} events, SHA-256 hash-chained)`,
                  'Benchmark basis & provenance metadata',
                ].map(item => (
                  <div key={item} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    <CheckCircle size={12} style={{ color: 'var(--tone-good)', flexShrink: 0, marginTop: 2 }} />
                    {item}
                  </div>
                ))}
              </div>
              <button
                className="filter-bar__button"
                onClick={exportEvidencePack}
                disabled={exporting}
                style={{ display: 'inline-flex', gap: 8, alignItems: 'center', width: '100%', justifyContent: 'center' }}
              >
                <Download size={14} />
                {exporting ? 'Preparing...' : 'Export evidence pack'}
              </button>
            </div>

            <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: 18 }}>
              <p className="panel__eyebrow" style={{ margin: '0 0 3px' }}>Internal Payroll</p>
              <h2 style={{ margin: '0 0 10px', fontSize: '1.05rem' }}>
                {benchmarkAvail ? 'Benchmark active' : 'Connect your data'}
              </h2>
              {benchmarkAvail ? (
                <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
                  {[
                    { l: 'Headcount', v: String(cb.headcount) },
                    { l: 'Internal gap', v: `${(cb.internal_value as number)?.toFixed(1)}%` },
                    { l: 'vs Market', v: cb.delta_label as string },
                  ].map(s => (
                    <div key={s.l}>
                      <span style={{ fontSize: '0.67rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>{s.l}</span>
                      <strong style={{ fontSize: '0.9rem', color: 'var(--text-strong)' }}>{s.v ?? '—'}</strong>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ margin: '0 0 10px', fontSize: '0.79rem', color: 'var(--text-muted)', lineHeight: 1.55 }}>
                  Upload a payroll CSV to benchmark your internal gender pay gap against live Eurostat data and activate the pay transparency simulation.
                </p>
              )}
              <div className="upload-dropzone">
                <input type="file" accept=".csv" onChange={e => { const f = e.target.files?.[0]; if (f) uploadPayroll(f) }} aria-label="Upload Payroll CSV File" />
                <Upload size={18} style={{ margin: '0 auto 5px', color: 'var(--text-muted)' }} />
                <span style={{ fontSize: '0.79rem', fontWeight: 600, display: 'block', color: 'var(--text-strong)', marginBottom: 2 }}>
                  {benchmarkAvail ? 'Replace payroll CSV' : 'Upload payroll CSV'}
                </span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Drag & drop or click to browse</span>
              </div>
            </div>

          </section>
        </div>

      </DataState>
    </div>
  )
}
