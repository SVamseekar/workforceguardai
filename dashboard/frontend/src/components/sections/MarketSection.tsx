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

  const unemploymentPeriod = (unemploymentSeries[unemploymentSeries.length - 1]?.period as string | undefined)?.replace(/^(\d{4})-Q(\d)$/, 'Q$2 $1')
  const employmentPeriod = (employmentSeries[employmentSeries.length - 1]?.period as string | undefined)?.replace(/^(\d{4})-Q(\d)$/, 'Q$2 $1')
  const vacancyPeriod = (vacancySeries[0]?.period as string | undefined)?.replace(/^(\d{4})-Q(\d)$/, 'Q$2 $1')
  const payGapPeriod = (payGapSeries[0]?.period as string | undefined)?.replace(/^(\d{4})-Q(\d)$/, 'Q$2 $1')

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
                    {Boolean(signal.score_label) && (
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
                          {Boolean(item.value) && (
                            <span style={{ marginLeft: 8, fontSize: '0.82rem', color: 'var(--text-strong)', fontWeight: 600 }}>
                              {item.value as string}
                            </span>
                          )}
                        </div>
                        <ToneChip tone={(item.tone as string) ?? 'neutral'}>
                          {item.tone === 'watch' ? 'Watch' : item.tone === 'good' ? 'Good' : 'Neutral'}
                        </ToneChip>
                      </div>
                      <p>{(item.detail as string) ?? (item.summary as string)}</p>
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
