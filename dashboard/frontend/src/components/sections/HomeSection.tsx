import { useNavigate } from 'react-router-dom'
import { useOverviewData } from '../../hooks/useOverviewData'
import { MetricCard } from '../primitives/MetricCard'
import { FreshnessPill } from '../primitives/FreshnessPill'
import { DataState } from '../shared/DataState'
import { FilterBar } from '../shared/FilterBar'
import { AlertTriangle, CheckCircle, Database, Upload, ArrowRight, Download, Play, ShieldAlert, Zap } from 'lucide-react'

type AnyObj = Record<string, unknown>

const dateFormatter = new Intl.DateTimeFormat('en-IE', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

function formatDate(val: unknown): string {
  if (!val) return '—'
  try {
    return dateFormatter.format(new Date(val as string))
  } catch {
    return '—'
  }
}

export function HomeSection() {
  const {
    overview,
    filters,
    setFilters,
    loading,
    error,
    exporting,
    uploadPayroll,
    exportEvidencePack,
  } = useOverviewData()
  const navigate = useNavigate()

  const ov = (overview ?? {}) as AnyObj
  const options = ((ov.filters as AnyObj)?.options as Record<string, unknown>) ?? {}

  const intelligence = (ov.intelligence as AnyObj | undefined) ?? {}
  const signals = (intelligence.signals as AnyObj[]) ?? []
  const watchSignals = signals.filter((s) => s.tone === 'watch')
  const payTransparency = (ov.pay_transparency as AnyObj | undefined) ?? {}
  const ptSummary = (payTransparency.summary as AnyObj | undefined) ?? {}
  const unresolvedCount = (ptSummary.unresolved_review_item_count as number) ?? 0
  const briefRaw = ov.brief as AnyObj | undefined

  const brief = briefRaw
    ? {
        headline: briefRaw.headline ?? (briefRaw.summary as AnyObj | undefined)?.headline ?? briefRaw.title,
        summary: (() => {
          const body = ((briefRaw.summary as AnyObj | undefined)?.body ?? briefRaw.summary ?? briefRaw.title) as string | undefined
          if (!body) return ''
          // Strip internal methodology sentences added by the backend
          return body
            .replace(/\s*Active benchmark basis:[^.]+\./g, '')
            .replace(/\s*All \d+ observed metrics are currently comparable[^.]+\./g, '')
            .replace(/\s*[A-Za-z ]+ is \d+(\.\d+)? pts (above|below) [^.]+\./g, '')
            .trim()
        })(),
        whyItMatters: (briefRaw.why_it_matters as AnyObj[]) ?? [],
      }
    : null

  const metrics = (ov.metrics as AnyObj[]) ?? []
  const recommendations = (intelligence.recommendations as AnyObj[]) ?? []
  const watchlist = (intelligence.watchlist as AnyObj[]) ?? []

  const companyBenchmark = (ov.company_benchmark as AnyObj | undefined) ?? {}
  const internalData = (ov.internal_data as AnyObj | undefined) ?? {}
  const benchmarkAvailable = Boolean(companyBenchmark.available)
  const internalLoaded = Boolean(internalData.available)

  const governance = (ov.governance as AnyObj | undefined) ?? {}
  const loggedEvents = (governance.logged_events as AnyObj[]) ?? []

  const urgentItems = [
    ...watchSignals.slice(0, 2).map((s) => ({
      type: 'watch',
      text: s.title as string,
      route: '/market',
    })),
    ...(unresolvedCount > 0
      ? [{ type: 'watch', text: `${unresolvedCount} pay transparency ${unresolvedCount === 1 ? 'category needs' : 'categories need'} review`, route: '/pay-analysis' }]
      : []),
  ]

  const positiveItems = metrics
    .filter((m) => m.tone === 'good')
    .slice(0, 2)
    .map((m) => ({ type: 'good', text: `${m.title as string}: ${m.gap_label as string ?? 'improving'}`, route: '/market' }))

  return (
    <div className="dashboard">
      <div className="dashboard__halo dashboard__halo--one" />
      <div className="dashboard__halo dashboard__halo--two" />
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <p className="hero__eyebrow" style={{ margin: 0 }}>Command Centre</p>
        <FreshnessPill />
      </div>

      <FilterBar
        filters={filters}
        options={options}
        onFilterChange={setFilters}
      />

      <DataState loading={loading} error={error} empty={!loading && !error && !overview}>
        
        {/* Executive Brief Banner */}
        {brief && (
          <section className="intelligence-section" style={{ marginBottom: 28 }}>
            <div className="panel brief-hero" style={{ padding: '26px 28px', borderLeft: '4px solid var(--accent-primary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <p className="panel__eyebrow" style={{ margin: 0 }}>Executive Brief</p>
                {Boolean((briefRaw?.summary as AnyObj | undefined)?.confidence) && (
                  <span className="comparison-meta__pill" style={{ textTransform: 'capitalize', fontSize: '0.74rem' }}>
                    Confidence: {String((briefRaw?.summary as AnyObj).confidence)}
                  </span>
                )}
              </div>
              <h2 style={{ margin: '0 0 12px', fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-strong)', letterSpacing: '-0.02em', lineHeight: 1.25 }}>
                {brief.headline as string}
              </h2>
              <p className="intelligence-brief__summary" style={{ margin: '0 0 24px', fontSize: '0.98rem', color: 'var(--text-muted)', lineHeight: 1.6, maxWidth: '85ch' }}>
                {brief.summary as string}
              </p>

              {brief.whyItMatters && brief.whyItMatters.length > 0 && (
                <div>
                  <p className="panel__eyebrow" style={{ marginBottom: 12, fontSize: '0.7rem', opacity: 0.8 }}>Strategic Implications</p>
                  <div className="implication-grid">
                    {brief.whyItMatters.map((item, idx) => (
                      <div key={idx} className="implication-card">
                        <div className="implication-card__header">
                          <span className={`badge-priority badge-priority--${String(item.priority).toLowerCase()}`}>
                            {String(item.priority).toUpperCase()}
                          </span>
                          {Boolean(item.review_required) && (
                            <span className="badge-action-needed">
                              <AlertTriangle size={12} />
                              Review Required
                            </span>
                          )}
                        </div>
                        <h4 className="implication-card__title">{item.title as string}</h4>
                        <p className="implication-card__detail">{item.detail as string}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Command Centre Core Metrics Grid */}
        <section className="metric-section" style={{ marginBottom: 28 }}>
          <p className="panel__eyebrow" style={{ marginBottom: 12 }}>Key Indicators</p>
          <div className="metric-grid">
            {metrics.map((metric) => (
              <MetricCard
                key={metric.id as string}
                metric={metric}
                onClick={() => navigate('/market')}
              />
            ))}
          </div>
        </section>

        {/* Needs Attention Alert Center */}
        {(urgentItems.length > 0 || positiveItems.length > 0) && (
          <section className="metric-section" style={{ marginBottom: 28 }}>
            {urgentItems.length > 0 && (
              <>
                <p className="panel__eyebrow" style={{ marginBottom: 12 }}>Needs Attention</p>
                <div className="product-notes" style={{ marginBottom: positiveItems.length > 0 ? 12 : 0 }}>
                  {urgentItems.map((item, i) => (
                    <button
                      key={i}
                      className="product-note inline-notice inline-notice--watch"
                      onClick={() => navigate(item.route)}
                      style={{ textAlign: 'left', cursor: 'pointer', display: 'flex', width: '100%' }}
                    >
                      <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                      <span>{item.text}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
            {urgentItems.length === 0 && positiveItems.length > 0 && (
              <>
                <p className="panel__eyebrow" style={{ marginBottom: 12 }}>Looking good</p>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {positiveItems.map((item, i) => (
                    <button
                      key={i}
                      className="product-note inline-notice inline-notice--good"
                      onClick={() => navigate(item.route)}
                      style={{ textAlign: 'left', cursor: 'pointer', flex: '1 1 auto' }}
                    >
                      <CheckCircle size={14} style={{ flexShrink: 0 }} />
                      <span>{item.text}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </section>
        )}

        {/* Two-Column Analytics & Integrations Grid */}
        <div className="dashboard-grid" style={{ marginBottom: 28 }}>
          
          {/* Column 1: Strategic Intelligence (Recommendations & Risks) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            
            {/* Actionable Recommendations */}
            {recommendations.length > 0 && (
              <section className="panel" style={{ minHeight: 'auto', padding: 22 }}>
                <p className="panel__eyebrow">Strategic Recommendations</p>
                <h2 style={{ margin: '6px 0 16px', fontSize: '1.15rem' }}>Action items</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {recommendations.map((rec, i) => (
                    <div key={i} className="action-card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <h3 style={{ margin: 0, fontSize: '0.94rem', fontWeight: 700, color: 'var(--text-strong)' }}>
                          {rec.title as string}
                        </h3>
                        <span className={`badge-priority badge-priority--${String(rec.priority).toLowerCase()}`}>
                          {String(rec.priority)}
                        </span>
                      </div>
                      <p style={{ margin: '0 0 12px', fontSize: '0.84rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                        {rec.summary as string}
                      </p>
                      <button 
                        onClick={() => navigate('/pay-analysis')} 
                        className="insight-button"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', padding: '4px 0', border: 'none', background: 'none', color: 'var(--accent-primary)', fontWeight: 600, cursor: 'pointer' }}
                      >
                        Initiate analysis <ArrowRight size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Risk Watchlist */}
            {watchlist.length > 0 && (
              <section className="panel" style={{ minHeight: 'auto', padding: 22 }}>
                <p className="panel__eyebrow">Risk Watchlist</p>
                <h2 style={{ margin: '6px 0 16px', fontSize: '1.15rem' }}>Monitored anomalies</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {watchlist.map((w, i) => (
                    <div key={i} className="risk-card" style={{ borderLeft: '3px solid var(--tone-watch)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <ShieldAlert size={14} style={{ color: 'var(--tone-watch)' }} />
                        <h3 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-strong)' }}>
                          {w.title as string ?? w.label as string}
                        </h3>
                      </div>
                      <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                        {w.summary as string}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Column 2: Connected Systems, Governance & Quick Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            
            {/* Payroll Connectivity Card */}
            <section className="panel" style={{ minHeight: 'auto', padding: 22 }}>
              <p className="panel__eyebrow">Internal Systems</p>
              <h2 style={{ margin: '6px 0 16px', fontSize: '1.15rem' }}>Payroll integration</h2>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12, background: 'var(--bg-elevated)', border: '1px solid var(--border-light)' }}>
                  <div style={{ padding: 10, borderRadius: 8, background: internalLoaded ? 'var(--tone-good-bg)' : 'var(--tone-watch-bg)', color: internalLoaded ? 'var(--tone-good)' : 'var(--tone-watch)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Database size={18} />
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <strong style={{ fontSize: '0.88rem', display: 'block', color: 'var(--text-strong)' }}>
                      {internalLoaded ? 'Active Payroll Feed' : 'No Company Payroll Connected'}
                    </strong>
                    <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', display: 'block', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      {internalLoaded ? `As of ${internalData.snapshot_date as string}` : 'Upload CSV data to calculate internal benchmarks'}
                    </span>
                  </div>
                </div>

                {internalLoaded && benchmarkAvailable && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div style={{ border: '1px solid var(--border-light)', padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.01)' }}>
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>Headcount</span>
                      <strong style={{ fontSize: '1.15rem', color: 'var(--text-strong)' }}>{companyBenchmark.headcount as number}</strong>
                    </div>
                    <div style={{ border: '1px solid var(--border-light)', padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.01)' }}>
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>Confidence</span>
                      <strong style={{ fontSize: '1.15rem', color: companyBenchmark.confidence === 'high' ? 'var(--tone-good)' : 'var(--text-strong)' }}>
                        {String(companyBenchmark.confidence ?? 'Medium').toUpperCase()}
                      </strong>
                    </div>
                  </div>
                )}

                {/* Upload Zone */}
                <div className="upload-dropzone" style={{ border: '2px dashed var(--border-medium)', borderRadius: 12, padding: '18px 12px', textAlign: 'center', background: 'rgba(255,255,255,0.01)', position: 'relative', cursor: 'pointer', transition: 'all 0.2s ease' }}>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) uploadPayroll(file)
                    }}
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', zIndex: 2 }}
                    aria-label="Upload Payroll CSV File"
                  />
                  <Upload size={22} style={{ margin: '0 auto 8px', color: 'var(--text-muted)' }} />
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', color: 'var(--text-strong)', marginBottom: 2 }}>
                    Upload payroll CSV
                  </span>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    Drag & drop or click to browse
                  </span>
                </div>
              </div>
            </section>

            {/* Governance Events & Actions */}
            <section className="panel" style={{ minHeight: 'auto', padding: 22 }}>
              <p className="panel__eyebrow">Governance</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h2 style={{ margin: 0, fontSize: '1.15rem' }}>Recent Decisions Log</h2>
                <button 
                  onClick={() => navigate('/govern')} 
                  className="insight-button"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.76rem', padding: 0, border: 'none', background: 'none', color: 'var(--accent-primary)', fontWeight: 600, cursor: 'pointer' }}
                >
                  View log <ArrowRight size={12} />
                </button>
              </div>

              {loggedEvents.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.84rem', margin: 0 }}>
                  No governance actions recorded yet. Override or approve category gaps in Pay Analysis to begin.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {loggedEvents.slice(0, 3).map((event, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderRadius: 8, background: 'var(--bg-elevated)', border: '1px solid var(--border-light)', fontSize: '0.8rem' }}>
                      <div style={{ minWidth: 0, flex: 1, paddingRight: 10 }}>
                        <strong style={{ color: 'var(--text-strong)', display: 'block', fontSize: '0.82rem', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          {(event.action_label as string) ?? (event.action_code as string)}
                        </strong>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.74rem', display: 'block', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          {(event.target_label as string) ?? (event.target_id as string)}
                        </span>
                      </div>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.74rem', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {formatDate(event.recorded_at)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>

        {/* Global Compliance Quick Actions Bar */}
        <section className="panel" style={{ minHeight: 'auto', padding: '20px 22px', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
          <div>
            <h3 style={{ margin: '0 0 4px', fontSize: '1rem', fontWeight: 700, color: 'var(--text-strong)' }}>
              Export Evidence Package
            </h3>
            <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Generate a verified JSON bundle of all active market datasets, compliance simulation states, and governance audit trails.
            </p>
          </div>
          <button
            className="filter-bar__button"
            onClick={exportEvidencePack}
            disabled={exporting}
            style={{ display: 'inline-flex', gap: 8, alignItems: 'center', whiteSpace: 'nowrap' }}
          >
            <Download size={15} />
            {exporting ? 'Preparing pack...' : 'Export evidence'}
          </button>
        </section>

      </DataState>
    </div>
  )
}
