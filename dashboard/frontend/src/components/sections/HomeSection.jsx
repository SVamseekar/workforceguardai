import { useNavigate } from 'react-router-dom'
import { useOverviewData } from '../../hooks/useOverviewData'
import { MetricCard } from '../primitives/MetricCard'
import { AlertTriangle, CheckCircle } from 'lucide-react'

export function HomeSection() {
  const { overview, loading, error } = useOverviewData()
  const navigate = useNavigate()

  if (loading) {
    return (
      <div className="dashboard--loading">
        <div className="loading-panel">
          <h2>Loading…</h2>
          <p>Fetching latest workforce intelligence.</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="dashboard--error">
        <div className="error-panel">
          <h2>Could not load data</h2>
          <p>{error}</p>
        </div>
      </div>
    )
  }

  if (!overview) return null

  const watchSignals = (overview.intelligence?.signals ?? []).filter((s) => s.tone === 'watch')
  const unresolvedCount = overview.pay_transparency?.summary?.unresolved_review_item_count ?? 0
  const brief = overview.brief

  const attentionItems = [
    ...watchSignals.slice(0, 2).map((s) => ({
      type: 'watch',
      text: s.title,
      route: '/market',
    })),
    ...(unresolvedCount > 0
      ? [{ type: 'watch', text: `${unresolvedCount} pay transparency ${unresolvedCount === 1 ? 'category needs' : 'categories need'} review`, route: '/pay-analysis' }]
      : []),
    ...(overview.metrics ?? [])
      .filter((m) => m.tone === 'good')
      .slice(0, 1)
      .map((m) => ({ type: 'good', text: `${m.title} is ${m.delta > 0 ? 'improving' : 'stable'}`, route: '/market' })),
  ]

  return (
    <div className="dashboard">
      <div className="dashboard__halo dashboard__halo--one" />
      <div className="dashboard__halo dashboard__halo--two" />

      <section className="metric-section" style={{ marginBottom: 28 }}>
        <p className="hero__eyebrow">Command Centre</p>
        <div className="metric-grid">
          {(overview.metrics ?? []).map((metric) => (
            <MetricCard
              key={metric.id}
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
            <h2 style={{ margin: '8px 0 14px', fontSize: '1.15rem' }}>{brief.headline}</h2>
            <p className="intelligence-brief__summary">{brief.summary}</p>
          </div>
        </section>
      )}
    </div>
  )
}
