import { useState } from 'react'
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
