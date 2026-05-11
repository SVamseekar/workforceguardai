import { useNavigate } from 'react-router-dom'
import { useOverviewData } from '../../hooks/useOverviewData'
import { MetricCard } from '../primitives/MetricCard'
import { FreshnessPill } from '../primitives/FreshnessPill'
import { DataState } from '../shared/DataState'
import { AlertTriangle, CheckCircle } from 'lucide-react'

type AnyObj = Record<string, unknown>

export function HomeSection() {
  const { overview, loading, error } = useOverviewData()
  const navigate = useNavigate()

  const ov = (overview ?? {}) as AnyObj

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
        summary: (briefRaw.summary as AnyObj | undefined)?.body ?? briefRaw.summary ?? briefRaw.title,
      }
    : null

  const metrics = (ov.metrics as AnyObj[]) ?? []

  const attentionItems = [
    ...watchSignals.slice(0, 2).map((s) => ({
      type: 'watch',
      text: s.title as string,
      route: '/market',
    })),
    ...(unresolvedCount > 0
      ? [{ type: 'watch', text: `${unresolvedCount} pay transparency ${unresolvedCount === 1 ? 'category needs' : 'categories need'} review`, route: '/pay-analysis' }]
      : []),
    ...metrics
      .filter((m) => m.tone === 'good')
      .slice(0, 1)
      .map((m) => ({ type: 'good', text: `${m.title} is ${(m.delta as number) > 0 ? 'improving' : 'stable'}`, route: '/market' })),
  ]

  return (
    <div className="dashboard">
      <div className="dashboard__halo dashboard__halo--one" />
      <div className="dashboard__halo dashboard__halo--two" />
      <FreshnessPill />
      <DataState loading={loading} error={error} empty={!loading && !error && !overview}>
        <section className="metric-section" style={{ marginBottom: 28 }}>
          <p className="hero__eyebrow">Command Centre</p>
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

        {attentionItems.length > 0 && (
          <section className="metric-section" style={{ marginBottom: 28 }}>
            <p className="panel__eyebrow" style={{ marginBottom: 12 }}>Needs Attention</p>
            <div className="product-notes">
              {attentionItems.map((item, i) => (
                <button
                  key={i}
                  className={`product-note inline-notice inline-notice--${item.type === 'watch' ? 'watch' : 'good'}`}
                  onClick={() => navigate(item.route)}
                  style={{ textAlign: 'left', cursor: 'pointer' }}
                >
                  {item.type === 'watch'
                    ? <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                    : <CheckCircle size={16} style={{ flexShrink: 0 }} />
                  }
                  <span>{item.text}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {brief && (
          <section className="intelligence-section">
            <div className="intelligence-brief">
              <p className="panel__eyebrow">Executive Brief</p>
              <h2 style={{ margin: '8px 0 14px', fontSize: '1.15rem' }}>{brief.headline as string}</h2>
              <p className="intelligence-brief__summary">{brief.summary as string}</p>
            </div>
          </section>
        )}
      </DataState>
    </div>
  )
}
