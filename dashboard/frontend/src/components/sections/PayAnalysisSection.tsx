import { useState, useEffect } from 'react'
import { useOverviewData } from '../../hooks/useOverviewData'
import { useAuth } from '../../hooks/useAuth'
import { FreshnessPill } from '../primitives/FreshnessPill'
import { ToneChip } from '../primitives/ToneChip'
import { EvidenceDrawer } from '../shared/EvidenceDrawer'
import { DataState } from '../shared/DataState'
import { FilterBar } from '../shared/FilterBar'

type AnyObj = Record<string, unknown>

const REVIEW_STATE_LABELS: Record<string, string> = {
  observed_gap: 'Pay gap identified',
  justified_difference: 'Documented difference',
  unresolved_review_item: 'Needs review',
}

const numberFormatter = new Intl.NumberFormat('en-IE', {
  maximumFractionDigits: 1,
  minimumFractionDigits: 0,
})

function formatValue(value: unknown, unit = '%') {
  if (value == null) return '—'
  if (unit === '%') return `${numberFormatter.format(Number(value))}%`
  if (unit === 'score') return `${numberFormatter.format(Number(value))}/100`
  return numberFormatter.format(Number(value))
}

export function PayAnalysisSection() {
  const { overview, filters, setFilters, loading, error, recordGovernanceAction, actionLoading, uploadPayroll } = useOverviewData()
  const { isAdmin } = useAuth()
  const [selectedEvidence, setSelectedEvidence] = useState<unknown>(null)

  // Pay Analysis needs geography=country to activate company benchmarking.
  // Sync geography to country on mount and whenever country changes.
  // Also reset sector to ALL — company benchmark mart covers all sectors.
  useEffect(() => {
    const needsGeoSync = filters.country !== 'ALL' && filters.geography !== filters.country
    const needsSectorReset = filters.sector !== 'ALL'
    if (needsGeoSync || needsSectorReset) {
      setFilters({
        ...filters,
        geography: filters.country !== 'ALL' ? filters.country : filters.geography,
        sector: 'ALL',
      })
    }
  }, [filters.country]) // eslint-disable-line react-hooks/exhaustive-deps

  const ov = (overview ?? {}) as AnyObj

  const companyBenchmark = (ov.company_benchmark as AnyObj) ?? {}
  const internalData = (ov.internal_data as AnyObj) ?? {}
  const semanticMetrics = (ov.semantic_metrics as AnyObj[]) ?? []
  const payTransparency = (ov.pay_transparency as AnyObj) ?? {}
  const benchmarkAvailable = Boolean(companyBenchmark.available)
  const internalLoaded = Boolean(internalData.available)
  const options = ((ov.filters as AnyObj)?.options as AnyObj) ?? {}

  const coverageLabel = ({
    partial: 'Partial market data',
    full: 'Full market data',
    unavailable: 'Market data unavailable',
  } as Record<string, string>)[companyBenchmark.coverage_status as string] ?? 'Market data status unknown'

  const evidenceBasisLabel = ({
    blended: 'Evidence source: Combined',
    internal: 'Evidence source: Company data',
    external: 'Evidence source: Market data',
  } as Record<string, string>)[companyBenchmark.evidence_basis as string] ?? ''

  const workerCategory = (companyBenchmark.worker_category as AnyObj | undefined) ?? {}
  const ptSummary = (payTransparency.summary as AnyObj | undefined) ?? {}
  const governance = (ov.governance as AnyObj) ?? {}
  const availableActions = (governance.available_actions as AnyObj[]) ?? []
  const egaproBenchmark = (ov.egapro_peer_benchmark as AnyObj) ?? {}

  return (
    <div className="dashboard">
      <div className="dashboard__halo dashboard__halo--one" />
      <FreshnessPill />

      <DataState loading={loading} error={error} empty={!loading && !error && !overview}>
      <p className="hero__eyebrow" style={{ marginBottom: 8 }}>Pay Analysis</p>

      <FilterBar
        filters={filters}
        options={options}
        onFilterChange={(next) => {
          // When country changes, sync geography to activate company benchmarking
          if (next.country !== filters.country && next.country !== 'ALL') {
            setFilters({ ...next, geography: next.country })
          } else if (next.country === 'ALL') {
            setFilters({ ...next, geography: 'EU27_AVG' })
          } else {
            setFilters(next)
          }
        }}
      />

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
              {/* Column 1 — Internal pay gap */}
              <div className="comparison-meta">
                <div className="comparison-meta__top">
                  <strong>Internal pay gap</strong>
                  <ToneChip tone={companyBenchmark.confidence === 'high' ? 'good' : companyBenchmark.confidence === 'low' ? 'watch' : 'neutral'}>
                    {companyBenchmark.confidence === 'low' ? 'Limited data' : `${String(companyBenchmark.confidence ?? 'medium')} confidence`}
                  </ToneChip>
                </div>
                <p className="comparison-meta__value">{formatValue(companyBenchmark.internal_value)}</p>
                <div className="comparison-meta__detail-list">
                  <span>{companyBenchmark.female_count as number}F / {companyBenchmark.male_count as number}M</span>
                  <span>{companyBenchmark.headcount as number} employees</span>
                </div>
                <p>{(workerCategory.label as string) ?? 'Selected category'}</p>
              </div>

              {/* Column 2 — Market comparator */}
              <div className="comparison-meta">
                <div className="comparison-meta__top">
                  <strong>Market comparator</strong>
                  {coverageLabel && coverageLabel !== 'Market data status unknown' && (
                    <span className="comparison-meta__pill">{coverageLabel}</span>
                  )}
                </div>
                <p className="comparison-meta__value">{formatValue(companyBenchmark.market_value)}</p>
                <div className="comparison-meta__detail-list">
                  <span>{companyBenchmark.delta_label as string} vs market</span>
                </div>
                <p>
                  {evidenceBasisLabel && `${evidenceBasisLabel} · `}
                  Data as of {(companyBenchmark.snapshot_date as string) ?? 'Unknown'}
                </p>
              </div>

              {/* Column 3 — Context */}
              <div className="comparison-meta">
                <div className="comparison-meta__top">
                  <strong>Context</strong>
                </div>
                <div className="comparison-meta__detail-list" style={{ marginTop: 4 }}>
                  <span>{(workerCategory.label as string) ?? 'All categories'}</span>
                  <span>{companyBenchmark.headcount as number} employees</span>
                </div>
                <p>
                  Company data as of {(internalData.snapshot_date as string) ?? '—'}.
                  Market reference: Eurostat LFS, {(companyBenchmark.market_period_code as string) ?? 'latest'}.
                </p>
              </div>

              {companyBenchmark.coverage_status === 'directional' && (
                <div className="inline-notice inline-notice--watch" style={{ gridColumn: '1 / -1' }}>
                  <strong>Directional estimate</strong>
                  <p style={{ margin: 0 }}>Modelled from your uploaded data. Indicates direction and relative position — not a regulatory pay-equity determination. A fuller payroll snapshot will raise confidence.</p>
                </div>
              )}
            </div>
          ) : (
            <div className="comparison-focus">
              <ToneChip tone={internalLoaded ? 'watch' : 'neutral'}>
                {internalLoaded ? 'Select a country to activate' : 'No company data loaded'}
              </ToneChip>
              <p className="comparison-focus__summary">
                {internalLoaded
                  ? 'Company data is loaded. Select a country scope above — for example France — to compare your internal pay gaps against the market.'
                  : (companyBenchmark.note as string) ?? 'Upload your company payroll data to enable benchmarking.'}
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
              <article key={metric.id as string} className="metric-card">
                <p className="metric-card__eyebrow">{metric.title as string}</p>
                <p className="metric-card__value">{formatValue(metric.value, metric.unit as string)}</p>
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
          </div>
        </section>
      )}

      {/* Pay Transparency Compliance */}
      {Boolean(payTransparency.available) && (
        <section className="comparison-section">
          <div className="panel" style={{ minHeight: 'auto', padding: 22 }}>
            <div className="panel__header panel__header--tight">
              <div>
                <p className="panel__eyebrow">EU Pay Transparency Directive</p>
                <h2>Pay transparency compliance</h2>
              </div>
              <ToneChip tone={(ptSummary.unresolved_review_item_count as number) > 0 ? 'watch' : 'good'}>
                {(ptSummary.unresolved_review_item_count as number) > 0
                  ? `${ptSummary.unresolved_review_item_count} need review`
                  : 'All reviewed'}
              </ToneChip>
            </div>

            <div className="compliance-review-list">
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
                    {isAdmin ? (
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
                    ) : (
                      <p className="admin-only-hint" style={{ marginTop: 8 }}>
                        Governance decisions require an admin account.
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* Égapro peer benchmark — only shown when country=FR and data available */}
      {Boolean(egaproBenchmark.available) && (
        <section className="comparison-section">
          <div className="panel" style={{ minHeight: 'auto', padding: 22 }}>
            <p className="panel__eyebrow">France Égapro Index</p>
            <h2 style={{ margin: '6px 0 16px', fontSize: '1.15rem' }}>Peer benchmark</h2>
            <div className="comparison-overview__meta">
              <div className="comparison-meta">
                <div className="comparison-meta__top">
                  <strong>Sector median score</strong>
                  <span className="comparison-meta__pill">{egaproBenchmark.company_count as number} companies</span>
                </div>
                <div className="comparison-meta__detail-list">
                  <span>P25: {egaproBenchmark.p25_score as number}</span>
                  <span>P50: {egaproBenchmark.p50_score as number}</span>
                  <span>P75: {egaproBenchmark.p75_score as number}</span>
                </div>
                <p>{egaproBenchmark.note as string}</p>
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
          {isAdmin ? (
            <label className="panel__action" style={{ cursor: 'pointer' }}>
              Upload your data →
              <input
                type="file"
                accept=".csv"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file && uploadPayroll) uploadPayroll(file)
                }}
              />
            </label>
          ) : (
            <span className="admin-only-hint">Payroll upload requires an admin account.</span>
          )}
        </div>
      )}

      <EvidenceDrawer
        evidence={selectedEvidence}
        onClose={() => setSelectedEvidence(null)}
      />
      </DataState>
    </div>
  )
}
