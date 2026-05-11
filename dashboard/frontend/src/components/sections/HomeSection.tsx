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
      }
    : null

  const metrics = (ov.metrics as AnyObj[]) ?? []

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
                      style={{ textAlign: 'left', cursor: 'pointer' }}
                    >
                      <AlertTriangle size={16} style={{ flexShrink: 0 }} />
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
                      style={{ textAlign: 'left', cursor: 'pointer', flex: '0 0 auto' }}
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
