import { useState } from 'react'
import { useOverviewData } from '../../hooks/useOverviewData'
import { ToneChip } from '../primitives/ToneChip'
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
  const { overview, loading, error, recordGovernanceAction, actionLoading, uploadPayroll } = useOverviewData()
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
        </div>
      )}

      <EvidenceDrawer
        evidence={selectedEvidence}
        onClose={() => setSelectedEvidence(null)}
      />
    </div>
  )
}
