import { ToneChip } from './ToneChip'
import { ProvenanceBadge } from './ProvenanceBadge'

const TONE_CLASS = {
  good: 'metric-card--teal',
  watch: 'metric-card--orange',
  neutral: 'metric-card--blue',
}

const numberFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 1,
  minimumFractionDigits: 0,
})

function formatValue(value, unit = '%') {
  if (value == null) return 'Planned'
  if (unit === '%') return `${numberFormatter.format(Number(value))}%`
  if (unit === 'score') return `${numberFormatter.format(Number(value))}/100`
  return numberFormatter.format(Number(value))
}

function formatDelta(delta, unit = '%') {
  if (delta == null || Number.isNaN(Number(delta))) return 'No prior period'
  const sign = delta > 0 ? '+' : ''
  if (unit === '%') return `${sign}${numberFormatter.format(Number(delta))} pts vs prior period`
  return `${sign}${numberFormatter.format(Number(delta))} vs prior period`
}

export function MetricCard({ metric, onOpenEvidence, onClick }) {
  const tone = metric.tone ?? 'neutral'
  const toneClass = TONE_CLASS[tone] ?? ''

  return (
    <article
      className={`metric-card ${toneClass}`}
      onClick={onClick}
      style={onClick ? { cursor: 'pointer' } : undefined}
    >
      <div className="metric-card__header">
        <p className="metric-card__eyebrow">{metric.title}</p>
      </div>
      <p className="metric-card__value">{formatValue(metric.value, metric.unit)}</p>
      <p className={`metric-card__delta metric-card__delta--${tone}`}>
        {formatDelta(metric.delta, metric.unit)}
      </p>
      <p className="metric-card__period">{metric.period}</p>
      {metric.tone && (
        <div className="metric-card__coverage" style={{ marginTop: 8 }}>
          <ToneChip tone={tone}>
            {tone === 'good' ? 'Good' : tone === 'watch' ? 'Watch' : 'Neutral'}
          </ToneChip>
        </div>
      )}
      {metric.provenance && (
        <ProvenanceBadge provenance={metric.provenance} compact />
      )}
      {onOpenEvidence && (
        <button className="insight-button" onClick={(e) => { e.stopPropagation(); onOpenEvidence(metric) }}>
          View evidence
        </button>
      )}
    </article>
  )
}
