import { useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { FreshnessPill } from '../primitives/FreshnessPill'
import { ChartPanel } from '../shared/ChartPanel'
import { DataState } from '../shared/DataState'
import { useResearchPanel } from '../../hooks/useResearchPanel'
import { ResearchScatterChart } from '../research/ResearchScatterChart'
import { ResearchHeatmap } from '../research/ResearchHeatmap'
import { ResearchTrajectoryChart } from '../research/ResearchTrajectoryChart'
import { ResearchFinanceBars } from '../research/ResearchFinanceBars'
import { RESEARCH_PAPER_LABEL, RESEARCH_PAPER_URL } from '../landing/site'

export function ResearchSection() {
  const [trajectoryGroup, setTrajectoryGroup] = useState('fast_recovery')
  const { data, isLoading, error } = useResearchPanel(trajectoryGroup)
  const errorMsg = error
    ? (error instanceof Error ? error.message : 'Failed to load research panel')
    : ''

  const panel = data?.panel
  const figures = data?.figures
  const insights = data?.insights ?? []

  return (
    <div className="dashboard">
      <div className="dashboard__halo dashboard__halo--one" />
      <FreshnessPill />

      <DataState loading={isLoading} error={errorMsg} empty={!isLoading && !errorMsg && !data}>
        <div className="research-hero">
          <p className="hero__eyebrow">Research panel</p>
          <h1 className="research-hero__title">Paper findings — live from the warehouse</h1>
          <p className="research-hero__lede">
            Eurostat panel across {panel?.countries ?? '—'} member states ({panel?.year_range ?? '2019–2025'}).
            Same dbt metrics that power compliance workflows — not a separate research copy.
          </p>
          {panel && (
            <div className="research-summary-band">
              <div className="research-summary-band__item">
                <span className="research-summary-band__value">{panel.eu27_gpg_mean ?? '—'}%</span>
                <span className="research-summary-band__label">Panel mean GPG</span>
              </div>
              <div className="research-summary-band__item">
                <span className="research-summary-band__value">{panel.eu27_finance_gpg_mean ?? '—'}%</span>
                <span className="research-summary-band__label">Finance sector mean</span>
              </div>
              <div className="research-summary-band__item">
                <span className="research-summary-band__value">
                  {panel.employment_gpg_correlation != null ? `+${panel.employment_gpg_correlation.toFixed(2)}` : '—'}
                </span>
                <span className="research-summary-band__label">Employment–GPG correlation</span>
              </div>
              <a
                href={RESEARCH_PAPER_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="research-summary-band__link"
              >
                {RESEARCH_PAPER_LABEL} <ExternalLink size={14} />
              </a>
            </div>
          )}
        </div>

        <div className="dashboard-grid" style={{ marginTop: 20 }}>
          <ChartPanel
            title={figures?.tightness_gpg_scatter.title ?? 'Employment vs gender pay gap'}
            sourceId="eurostat_lfs"
          >
            <ResearchScatterChart
              points={figures?.tightness_gpg_scatter.points ?? []}
              xKey="employment_rate"
              yKey="gender_pay_gap"
              zKey="finance_gpg"
              xUnit="%"
              yUnit="%"
              correlation={figures?.tightness_gpg_scatter.correlation}
            />
          </ChartPanel>

          <ChartPanel
            title={figures?.risk_quadrant.title ?? 'Hiring pressure vs equity risk'}
            sourceId="workforceguard_composite"
          >
            <ResearchScatterChart
              points={figures?.risk_quadrant.points ?? []}
              xKey="hpi"
              yKey="ers"
              zKey="finance_gpg"
            />
          </ChartPanel>
        </div>

        <div className="dashboard-grid" style={{ marginTop: 18 }}>
          <ChartPanel
            title={figures?.finance_vs_overall.title ?? 'Finance vs all-sector gap'}
            sourceId="eurostat_ses"
          >
            <ResearchFinanceBars rows={figures?.finance_vs_overall.rows ?? []} />
          </ChartPanel>

          <ChartPanel
            title={figures?.employment_trajectories.title ?? 'Employment trajectories'}
            sourceId="eurostat_lfs"
          >
            <div className="research-trajectory-controls">
              {(figures?.employment_trajectories.groups ?? []).map((group) => (
                <button
                  key={group.id}
                  type="button"
                  className={`research-trajectory-controls__btn${trajectoryGroup === group.id ? ' is-active' : ''}`}
                  onClick={() => setTrajectoryGroup(group.id)}
                >
                  {group.label}
                </button>
              ))}
            </div>
            {figures?.employment_trajectories.note && (
              <p className="research-trajectory-note">{figures.employment_trajectories.note}</p>
            )}
            <div className="research-chart-wrap research-chart-wrap--tall">
              <ResearchTrajectoryChart series={figures?.employment_trajectories.series ?? []} />
            </div>
          </ChartPanel>
        </div>

        <section style={{ marginTop: 18 }}>
          <ChartPanel
            title={figures?.sector_heatmap.title ?? 'Sectoral gender pay gap heatmap'}
            sourceId="eurostat_ses"
          >
            <ResearchHeatmap
              sectors={figures?.sector_heatmap.sectors ?? []}
              cells={figures?.sector_heatmap.cells ?? []}
            />
          </ChartPanel>
        </section>

        <section className="research-insights" style={{ marginTop: 24 }}>
          <p className="panel__eyebrow" style={{ marginBottom: 14 }}>Interpretive insights</p>
          <div className="research-insights__list">
            {insights.map((insight) => (
              <details key={insight.id} className="research-insights__item">
                <summary>
                  <span className="research-insights__title">{insight.title}</span>
                  <span className="research-insights__summary">{insight.summary}</span>
                </summary>
                <p className="research-insights__detail">{insight.detail}</p>
                <p className="research-insights__countries">
                  Key countries: {insight.countries.join(', ')}
                </p>
              </details>
            ))}
          </div>
        </section>
      </DataState>
    </div>
  )
}
