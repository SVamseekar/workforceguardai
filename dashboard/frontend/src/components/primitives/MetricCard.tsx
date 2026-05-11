import { ToneChip } from './ToneChip'
import { ProvenanceBadge } from './ProvenanceBadge'

type AnyObj = Record<string, unknown>

const TONE_CLASS: Record<string, string> = {
  good: 'metric-card--teal',
  watch: 'metric-card--orange',
  neutral: 'metric-card--blue',
}

const numberFormatter = new Intl.NumberFormat('en-IE', {
  maximumFractionDigits: 1,
  minimumFractionDigits: 0,
})

function formatValue(value: unknown, unit = '%') {
  if (value == null) return 'Planned'
  if (unit === '%') return `${numberFormatter.format(Number(value))}%`
  if (unit === 'score') return `${numberFormatter.format(Number(value))}/100`
  return numberFormatter.format(Number(value))
}

function formatDelta(delta: unknown, unit = '%') {
  if (delta == null || Number.isNaN(Number(delta))) return 'No prior period'
  const sign = (delta as number) > 0 ? '+' : ''
  if (unit === '%') return `${sign}${numberFormatter.format(Number(delta))} pts vs prior period`
  return `${sign}${numberFormatter.format(Number(delta))} vs prior period`
}

export function MetricCard({ metric, onOpenEvidence, onClick }: { metric: AnyObj; onOpenEvidence?: (m: unknown) => void; onClick?: () => void }) {
  const tone = (metric.tone as string) ?? 'neutral'
  const toneClass = TONE_CLASS[tone] ?? ''

  return (
    <article
      className={`metric-card ${toneClass}`}
      onClick={onClick}
      style={onClick ? { cursor: 'pointer' } : undefined}
    >
      <div className="metric-card__header">
        <p className="metric-card__eyebrow">{metric.title as string}</p>
      </div>
      <p className="metric-card__value">{formatValue(metric.value, metric.unit as string | undefined)}</p>
      <p className={`metric-card__delta metric-card__delta--${tone}`}>
        {formatDelta(metric.delta, metric.unit as string | undefined)}
      </p>
      <p className="metric-card__period">{metric.period as string}</p>
      {Boolean(metric.tone) && (
        <div className="metric-card__coverage" style={{ marginTop: 8 }}>
          <ToneChip tone={tone}>
            {tone === 'good' ? 'Good' : tone === 'watch' ? 'Watch' : 'Neutral'}
          </ToneChip>
        </div>
      )}
      {Boolean(metric.provenance) && (
        <ProvenanceBadge provenance={metric.provenance as Array<{ source_id: string }>} compact />
      )}
      {onOpenEvidence && (
        <button className="insight-button" onClick={(e) => { e.stopPropagation(); onOpenEvidence(metric) }}>
          View evidence
        </button>
      )}
    </article>
  )
}
