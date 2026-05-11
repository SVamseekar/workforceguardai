import { useState } from 'react'
import { useOverviewData } from '../../hooks/useOverviewData'
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
  const [selectedEvidence, setSelectedEvidence] = useState<unknown>(null)

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
                    {companyBenchmark.confidence === 'low' ? 'Limited data — treat with caution' : `${String(companyBenchmark.confidence ?? 'medium')} confidence`}
                  </ToneChip>
                </div>
                <div className="comparison-meta__detail-list">
                  <span>{formatValue(companyBenchmark.internal_value)}</span>
                  <span>{companyBenchmark.female_count as number} female</span>
                  <span>{companyBenchmark.male_count as number} male</span>
                </div>
                <p>Internal pay gap for {(workerCategory.label as string) ?? 'selected category'}.</p>
              </div>

              <div className="comparison-meta">
                <div className="comparison-meta__top">
                  <strong>Market comparator</strong>
                  <span className="comparison-meta__pill">{coverageLabel}</span>
                </div>
                <div className="comparison-meta__detail-list">
                  <span>{formatValue(companyBenchmark.market_value)}</span>
                  <span>{companyBenchmark.delta_label as string} vs market</span>
                </div>
                <p>
                  {evidenceBasisLabel && <span>{evidenceBasisLabel} · </span>}
                  Data as of: {(companyBenchmark.snapshot_date as string) ?? 'Unknown'}
                </p>
              </div>

              <div className="comparison-meta">
                <div className="comparison-meta__top">
                  <strong>Worker category</strong>
                </div>
                <div className="comparison-meta__detail-list">
                  <span>{workerCategory.label as string}</span>
                  <span>{companyBenchmark.headcount as number} employees</span>
                </div>
                <p>
                  {(internalData.sources as { source_id: string; record_count: number }[] | undefined)
                    ?.filter(s => s.record_count > 0)
                    .map(s => `${s.source_id.replace('internal_', '').replace('_snapshot', '')}: ${s.record_count} records`)
                    .join(' · ')
                  }
                </p>
              </div>

              {companyBenchmark.coverage_status === 'directional' && (
                <div className="inline-notice inline-notice--watch" style={{ marginTop: 12, gridColumn: '1 / -1' }}>
                  <strong>Directional estimate</strong>
                  <p style={{ margin: 0 }}>These figures are modelled from your uploaded data via the benchmark mart. They indicate direction and relative position — not a regulatory pay-equity determination. Upload a fuller payroll snapshot for higher confidence.</p>
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
              {((payTransparency.categories as AnyObj[]) ?? []).map((cat) => (
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
              ))}
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
      </DataState>
    </div>
  )
}
