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
  const ovFilters = (ov.filters as AnyObj) ?? {}
  const options = (ovFilters.options as Record<string, unknown>) ?? {}

  const unemploymentSeries = ((charts.unemployment_trend as AnyObj)?.series as AnyObj[]) ?? []
  const employmentSeries = ((charts.employment_trend as AnyObj)?.series as AnyObj[]) ?? []
  const vacancySeries = ((charts.vacancy_by_sector as AnyObj)?.series as AnyObj[]) ?? []
  const payGapSeries = ((charts.pay_gap_by_sector as AnyObj)?.series as AnyObj[]) ?? []

  return (
    <div className="dashboard">
      <div className="dashboard__halo dashboard__halo--one" />
      <FreshnessPill />

      <DataState loading={loading} error={error} empty={!loading && !error && !overview}>
      <p className="hero__eyebrow" style={{ marginBottom: 8 }}>Market Intelligence</p>

      <FilterBar
        filters={filters}
        options={options}
        onFilterChange={setFilters}
      />

      <div className="dashboard-grid" style={{ marginTop: 18 }}>
        <ChartPanel title="Unemployment trend" sourceId="eurostat_lfs">
          <MetricChart chartType="line" data={unemploymentSeries} xKey="period" color="#7ff4ea" />
        </ChartPanel>

        <ChartPanel title="Vacancy rate by sector" sourceId="eurostat_jvs">
          <MetricChart chartType="bar" data={vacancySeries} xKey="sector_label" color="#7ff4ea" />
        </ChartPanel>
      </div>

      <div className="dashboard-grid" style={{ marginTop: 18 }}>
        <ChartPanel title="Employment trend" sourceId="eurostat_lfs">
          <MetricChart chartType="line" data={employmentSeries} xKey="period" color="#8db1ff" />
        </ChartPanel>

        <ChartPanel title="Gender pay gap by sector" sourceId="eurostat_ses">
          <MetricChart chartType="bar" data={payGapSeries} xKey="sector_label" color="#ffbf8f" />
        </ChartPanel>
      </div>

      <section className="intelligence-section">
        <p className="panel__eyebrow" style={{ marginBottom: 14 }}>Intelligence Signals</p>
        <div className="signal-list">
          {((intelligence.signals as AnyObj[]) ?? []).map((signal, i) => (
            <div key={i} className="signal-item">
              <div className="signal-item__top">
                <h3>{signal.title as string}</h3>
                <ToneChip tone={signal.tone as string}>
                  {signal.tone === 'good' ? 'Good' : signal.tone === 'watch' ? 'Watch' : 'Neutral'}
                </ToneChip>
              </div>
              <p>{signal.summary as string}</p>
              {Boolean(signal.evidence) && (
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
                      <span className="watchlist-item__label">{item.label as string}</span>
                      <ToneChip tone={(item.tone as string) ?? 'neutral'}>
                        {item.tone === 'watch' ? 'Watch' : item.tone === 'good' ? 'Good' : 'Neutral'}
                      </ToneChip>
                    </div>
                    <p>{item.summary as string}</p>
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
      </DataState>
    </div>
  )
}
