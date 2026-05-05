import { Component, startTransition, useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Briefcase,
  ClipboardCheck,
  Download,
  FileSearch,
  RefreshCw,
  Scale,
  ShieldCheck,
  TrendingUp,
  Users,
  X,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api'

const METRIC_ICONS = {
  vacancy_rate: Briefcase,
  unemployment_rate: Users,
  employment_rate: TrendingUp,
  gender_pay_gap: Activity,
  hiring_pressure_index: Briefcase,
  labour_resilience: TrendingUp,
  equity_risk_score: ShieldCheck,
  transition_readiness: FileSearch,
}

const TONE_META = {
  good: { className: 'tone-chip--good', Icon: TrendingUp },
  neutral: { className: 'tone-chip--neutral', Icon: Activity },
  watch: { className: 'tone-chip--watch', Icon: AlertTriangle },
}

const PRIORITY_CLASS = {
  high: 'priority-badge--high',
  medium: 'priority-badge--medium',
  low: 'priority-badge--low',
}

const REVIEW_STATE_LABELS = {
  observed_gap: 'Observed gap',
  justified_difference: 'Monitored difference',
  unresolved_review_item: 'Unresolved review item',
}

const GOVERNANCE_CLASS = {
  approved: 'governance-button--approve',
  overridden: 'governance-button--override',
  reversed: 'governance-button--reverse',
}

const numberFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 1,
  minimumFractionDigits: 0,
})

const fullDateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

const CONSOLE_FOLLOW_UPS = [
  'How does this market compare to the EU benchmark?',
  'Which peer countries look most similar?',
  'What changed versus the prior period?',
  'Which signal is worsening fastest?',
  'Compared to what?',
  'Why did this change?',
  'How confident is this benchmark?',
  'What limits this comparison?',
]

function buildQueryParams(filters) {
  return {
    country: filters.country,
    geography: filters.geography,
    sector: filters.sector,
    period: filters.period,
    benchmark_geography: filters.benchmark_geography,
    benchmark_sector: filters.benchmark_sector,
  }
}

function formatMetricValue(value, unit = '%') {
  if (value == null) {
    return 'Planned'
  }

  if (unit === '%') {
    return `${numberFormatter.format(Number(value))}%`
  }

  if (unit === 'score') {
    return `${numberFormatter.format(Number(value))}/100`
  }

  return numberFormatter.format(Number(value))
}

function formatDelta(delta, unit = '%') {
  if (delta == null || Number.isNaN(Number(delta))) {
    return 'No prior period'
  }

  const sign = delta > 0 ? '+' : ''
  if (unit === '%') {
    return `${sign}${numberFormatter.format(Number(delta))} pts vs prior period`
  }

  return `${sign}${numberFormatter.format(Number(delta))} vs prior period`
}

function formatTooltipValue(value, unit = '%') {
  if (value == null) {
    return 'N/A'
  }

  if (unit === '%') {
    return `${Number(value).toFixed(1)}%`
  }

  return numberFormatter.format(Number(value))
}

function formatComparisonValue(value, unit = '%') {
  if (value == null) {
    return 'Unavailable'
  }

  if (unit === '%') {
    return `${numberFormatter.format(Number(value))}%`
  }

  return numberFormatter.format(Number(value))
}

function formatSignedDifference(delta, unit = '%') {
  if (delta == null || Number.isNaN(Number(delta))) {
    return 'Unavailable'
  }

  const sign = delta > 0 ? '+' : ''
  const suffix = unit === '%' ? ' pts' : ''
  return `${sign}${numberFormatter.format(Number(delta))}${suffix}`
}

function toneFromConfidence(confidence) {
  if (confidence === 'high') {
    return 'good'
  }

  if (confidence === 'low') {
    return 'watch'
  }

  return 'neutral'
}

function toneFromBenchmarkStatus(status) {
  if (status === 'official') {
    return 'good'
  }

  if (status === 'proxy') {
    return 'neutral'
  }

  return 'watch'
}

function toneFromCoverageStatus(status) {
  if (status === 'full') {
    return 'good'
  }

  if (status === 'partial') {
    return 'neutral'
  }

  return 'watch'
}

function toneFromEvidenceBasis(basis) {
  if (basis === 'internal') {
    return 'good'
  }

  if (basis === 'blended') {
    return 'neutral'
  }

  return 'watch'
}

function buildActiveBenchmarkQuestion(overview) {
  const selectedBenchmark = overview?.comparisons?.selected_benchmark
  const applied = overview?.filters?.applied

  if (!selectedBenchmark) {
    return 'How does this market compare to the EU benchmark?'
  }

  if (selectedBenchmark.id === 'market' && selectedBenchmark.selected_target?.label) {
    return `How does this market compare with ${selectedBenchmark.selected_target.label}?`
  }

  if (
    selectedBenchmark.id === 'sector' &&
    selectedBenchmark.selected_target?.label &&
    applied?.sector !== 'ALL' &&
    applied?.sector_label
  ) {
    return `How does ${applied.sector_label} compare with ${selectedBenchmark.selected_target.label}?`
  }

  if (selectedBenchmark.id === 'peer') {
    return 'Which peer countries look most similar?'
  }

  if (selectedBenchmark.id === 'prior_period') {
    return 'What changed versus the prior period?'
  }

  return 'How does this market compare to the EU benchmark?'
}

function normalizeBenchmarkBasis(benchmarkMeta, overview) {
  if (!benchmarkMeta) {
    return null
  }

  const targetLabel = benchmarkMeta.selected_target?.label ?? benchmarkMeta.label ?? 'Benchmark'
  let analystLabel = benchmarkMeta.label ?? 'Benchmark'

  if (benchmarkMeta.id === 'market' && benchmarkMeta.selected_target?.label) {
    analystLabel = `Selected market (${benchmarkMeta.selected_target.label})`
  } else if (benchmarkMeta.id === 'sector' && benchmarkMeta.selected_target?.label) {
    analystLabel = `Selected sector (${benchmarkMeta.selected_target.label})`
  } else if (benchmarkMeta.id === 'eu') {
    analystLabel = 'EU27 proxy average'
  } else if (benchmarkMeta.id === 'peer') {
    analystLabel = 'Peer-country basket'
  } else if (benchmarkMeta.id === 'prior_period') {
    analystLabel = 'Prior period'
  }

  return {
    id: benchmarkMeta.id,
    label: benchmarkMeta.label ?? analystLabel,
    analyst_label: analystLabel,
    target_label: targetLabel,
    availability: benchmarkMeta.availability ?? 'unavailable',
    benchmark_status: benchmarkMeta.benchmark_status ?? 'unavailable',
    confidence: benchmarkMeta.confidence ?? overview?.comparisons?.confidence ?? 'medium',
    coverage_status: benchmarkMeta.coverage_status ?? 'unavailable',
    coverage_note: benchmarkMeta.coverage_note ?? '',
    applicable_metric_count: benchmarkMeta.applicable_metric_count ?? 0,
    total_metric_count: benchmarkMeta.total_metric_count ?? overview?.metrics?.length ?? 0,
    description: benchmarkMeta.description ?? '',
    available_metrics: benchmarkMeta.available_metrics ?? [],
    unavailable_metrics: benchmarkMeta.unavailable_metrics ?? [],
    selected_target: benchmarkMeta.selected_target ?? null,
  }
}

function buildInitialAnalystLimitations(overview, benchmarkBasis) {
  const limitations = [
    'Claims stay grounded in the current country-level marts, and NUTS 2 remains blocked until the active data and model layers support it.',
  ]

  if (benchmarkBasis?.id === 'eu') {
    limitations.push(
      'The EU benchmark is a proxy average across country observations because the marts do not yet expose an official EU aggregate row.',
    )
  } else if (benchmarkBasis?.id === 'peer') {
    limitations.push(
      'Peer-country baskets are proxy constructs built from the nearest comparable country profiles across the currently observed metrics.',
    )
  } else if (benchmarkBasis?.id === 'market') {
    limitations.push(
      'Direct market comparisons are same-period country-to-country checks within the current marts, not regional or NUTS 2 comparisons.',
    )
  } else if (benchmarkBasis?.id === 'sector') {
    limitations.push(
      'Sector-versus-sector answers only cover metrics with live sector-grain support, so whole-market metrics remain excluded.',
    )
  } else if (benchmarkBasis?.id === 'prior_period') {
    limitations.push(
      'Prior-period answers compare the same country-level scope against the immediately preceding observed period.',
    )
  }

  if (benchmarkBasis?.coverage_note) {
    limitations.push(benchmarkBasis.coverage_note)
  }

  return [...new Set(limitations)]
}

function buildConsoleFollowUps(overview) {
  const followUps = []
  const marketTarget = overview?.comparisons?.targets?.market?.selected
  const sectorTarget = overview?.comparisons?.targets?.sector?.selected
  const currentSector = overview?.filters?.applied?.sector_label

  followUps.push(buildActiveBenchmarkQuestion(overview))

  if (marketTarget) {
    followUps.push(`How does this market compare with ${marketTarget.label}?`)
  }

  if (sectorTarget && currentSector && overview?.filters?.applied?.sector !== 'ALL') {
    followUps.push(`How does ${currentSector} compare with ${sectorTarget.label}?`)
  }

  return [...new Set([...followUps, ...CONSOLE_FOLLOW_UPS])]
}

function ToneChip({ tone, children }) {
  const toneMeta = TONE_META[tone] ?? TONE_META.neutral
  const ToneIcon = toneMeta.Icon

  return (
    <span className={`tone-chip ${toneMeta.className}`}>
      <ToneIcon size={14} />
      {children}
    </span>
  )
}

function ProvenanceBadge({ provenance, compact = false }) {
  if (!provenance) {
    return null
  }

  return (
    <div className={`provenance-badge ${compact ? 'provenance-badge--compact' : ''}`}>
      <span>{provenance.source_name}</span>
      <span>{provenance.source_version}</span>
      <span>{provenance.formula_version}</span>
      {provenance.human_review_required ? <span>Human review</span> : null}
    </div>
  )
}

function ChartTooltip({ active, payload, label, unit = '%', labelKey = 'period' }) {
  if (!active || !payload?.length) {
    return null
  }

  const datum = payload[0]?.payload ?? {}
  const title = datum[labelKey] ?? label ?? ''

  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip__title">{title}</p>
      <p className="chart-tooltip__value">{formatTooltipValue(payload[0]?.value, unit)}</p>
    </div>
  )
}

function ChartEmptyState({ message }) {
  return (
    <div className="chart-empty-state">
      <AlertTriangle size={18} />
      <span>{message}</span>
    </div>
  )
}

function ChartFrame({ children }) {
  return (
    <ResponsiveContainer width="100%" height="100%" minWidth={240} minHeight={260} debounce={75}>
      {children}
    </ResponsiveContainer>
  )
}

function SelectField({ label, value, options, onChange }) {
  return (
    <label className="control-field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function ScopeBadge({ label, value }) {
  return (
    <div className="scope-badge">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

class PanelErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error) {
    console.error('Panel rendering failed', error)
  }

  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false })
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <section className="inline-notice inline-notice--watch">
          <div>
            <strong>One command-centre panel could not render.</strong>
            <p>Refresh the page once. The core analytics and evidence sections remain available below.</p>
          </div>
        </section>
      )
    }

    return this.props.children
  }
}

function BriefingBoard({ overview }) {
  const filters = overview?.filters ?? {}
  const options = filters.options ?? {}
  const topRecommendation = overview.intelligence.recommendations?.[0]
  const topWatch = overview.intelligence.watchlist?.[0]
  const supportedGrains = Array.isArray(options.supported_grains) ? options.supported_grains : []
  const liveGrains = supportedGrains.filter((grain) => grain.status === 'live').length
  const blockedGrains = supportedGrains.filter((grain) => grain.status !== 'live').length
  const humanReviewCount = [...overview.metrics, ...overview.semantic_metrics].filter(
    (item) => item.provenance?.human_review_required,
  ).length

  const commandCards = [
    {
      id: 'top-risk',
      eyebrow: 'Top attention area',
      title: topWatch?.label ?? 'No elevated watch item',
      body: topWatch?.detail ?? overview.intelligence.summary,
      tone: topWatch?.tone ?? 'neutral',
    },
    {
      id: 'next-move',
      eyebrow: 'Recommended next move',
      title: topRecommendation?.title ?? 'No recommendation available',
      body: topRecommendation?.detail ?? 'WorkforceGuard will surface the next best move when signals qualify.',
      tone: topRecommendation?.priority === 'high' ? 'watch' : 'good',
    },
    {
      id: 'trust-posture',
      eyebrow: 'Trust posture',
      title: humanReviewCount ? `${humanReviewCount} review-backed metrics` : 'Low-friction review state',
      body: humanReviewCount
        ? 'Some metrics require human review before they should influence HR or compliance decisions.'
        : 'Current indicators do not carry extra review requirements for this scope.',
      tone: humanReviewCount ? 'watch' : 'good',
    },
    {
      id: 'coverage',
      eyebrow: 'Coverage',
      title: `${liveGrains} live grains, ${blockedGrains} blocked`,
      body: supportedGrains
        .map((grain) => `${grain.label}: ${grain.status}${grain.note ? ` (${grain.note})` : ''}`)
        .join(' • ') || 'Coverage metadata will appear here once the API provides supported grains.',
      tone: blockedGrains ? 'neutral' : 'good',
    },
  ]

  return (
    <section className="briefing-board">
      <article className="briefing-board__scope panel">
        <div className="panel__header panel__header--tight">
          <div>
            <p className="panel__eyebrow">Current scope</p>
            <h2>Decision context for the active filter state</h2>
          </div>
          <ToneChip tone="neutral">Externally grounded</ToneChip>
        </div>
        <div className="scope-badges">
          <ScopeBadge label="Country" value={filters.applied?.country === 'ALL' ? 'All countries' : filters.applied?.country ?? 'All countries'} />
          <ScopeBadge label="Geography" value={filters.applied?.geography_label ?? 'EU27 proxy market average'} />
          <ScopeBadge label="Sector" value={filters.applied?.sector_label ?? 'All sectors'} />
          <ScopeBadge label="Period" value={filters.applied?.period === 'latest' ? 'Latest available' : filters.applied?.period ?? 'Latest available'} />
        </div>
      </article>

      <div className="briefing-board__grid">
        {commandCards.map((card) => (
          <article key={card.id} className="briefing-card">
            <div className="briefing-card__top">
              <p>{card.eyebrow}</p>
              <ToneChip tone={card.tone}>{card.tone}</ToneChip>
            </div>
            <h3>{card.title}</h3>
            <p>{card.body}</p>
            <span className="briefing-card__link">
              <ArrowUpRight size={16} />
              Decision-ready signal
            </span>
          </article>
        ))}
      </div>
    </section>
  )
}

function MetricCard({ metric, onOpenEvidence }) {
  const Icon = METRIC_ICONS[metric.id] ?? Activity
  const trendClass =
    metric.delta == null
      ? 'metric-card__delta--neutral'
      : metric.delta <= 0
        ? 'metric-card__delta--good'
        : 'metric-card__delta--watch'

  return (
    <article className="metric-card metric-card--teal">
      <div className="metric-card__header">
        <div>
          <p className="metric-card__eyebrow">{metric.title}</p>
          <h3 className="metric-card__value">{formatMetricValue(metric.value, metric.unit)}</h3>
        </div>
        <span className="metric-card__icon">
          <Icon size={22} strokeWidth={2.2} />
        </span>
      </div>
      <p className={`metric-card__delta ${trendClass}`}>{formatDelta(metric.delta, metric.unit)}</p>
      <p className="metric-card__period">{metric.period}</p>
      <div className="metric-card__coverage">
        <ToneChip tone={toneFromCoverageStatus(metric.coverage?.status)}>
          {metric.coverage?.status ?? 'unavailable'} coverage
        </ToneChip>
        <span className="comparison-meta__pill">{metric.coverage?.grain ?? 'country'} grain</span>
      </div>
      {metric.coverage?.notes?.[0] ? <p className="metric-card__note">{metric.coverage.notes[0]}</p> : null}
      <ProvenanceBadge provenance={metric.provenance} compact />
      <button className="insight-button" type="button" onClick={() => onOpenEvidence(metric.evidence_bundle)}>
        View evidence
      </button>
    </article>
  )
}

function SemanticMetricCard({ metric, onOpenEvidence }) {
  const Icon = METRIC_ICONS[metric.id] ?? Activity
  const statusTone = metric.implementation_status === 'planned' ? 'neutral' : 'good'

  return (
    <article className="score-card semantic-card">
      <div className="score-card__header">
        <span>{metric.title}</span>
        <ToneChip tone={statusTone}>
          {metric.value == null ? 'Planned' : `${metric.value}/100`}
        </ToneChip>
      </div>
      <div className="semantic-card__body">
        <span className="semantic-card__icon">
          <Icon size={18} />
        </span>
        <p>{metric.notes || metric.definition}</p>
      </div>
      <ProvenanceBadge provenance={metric.provenance} compact />
      <button className="insight-button" type="button" onClick={() => onOpenEvidence(metric.evidence_bundle)}>
        View evidence
      </button>
    </article>
  )
}

function InlineNotice({ notice, onDismiss }) {
  if (!notice) {
    return null
  }

  return (
    <div className={`inline-notice inline-notice--${notice.tone ?? 'neutral'}`}>
      <div>
        <strong>{notice.title}</strong>
        <p>{notice.detail}</p>
      </div>
      <button type="button" className="inline-notice__dismiss" onClick={onDismiss}>
        <X size={16} />
      </button>
    </div>
  )
}

function buildTargetOptions(target, emptyLabel) {
  return [{ id: '', label: emptyLabel }, ...(target?.options ?? [])]
}

function FilterBar({ filters, options, comparisonTargets, onFilterChange, onExport, exporting }) {
  const marketTarget = comparisonTargets?.market ?? {}
  const sectorTarget = comparisonTargets?.sector ?? {}

  return (
    <section className="filter-bar">
      <div className="filter-bar__header">
        <div>
          <p className="panel__eyebrow">Control surface</p>
          <h2>Adjust scope before you interpret the signals</h2>
        </div>
      </div>
      <div className="filter-grid">
        <SelectField
          label="Country scope"
          value={filters.country}
          options={options.country_options}
          onChange={(value) => onFilterChange('country', value)}
        />
        <SelectField
          label="Region / benchmark"
          value={filters.geography}
          options={options.geography_options}
          onChange={(value) => onFilterChange('geography', value)}
        />
        <SelectField
          label="Sector focus"
          value={filters.sector}
          options={options.sector_options}
          onChange={(value) => onFilterChange('sector', value)}
        />
        <SelectField
          label="Time period"
          value={filters.period}
          options={options.period_options}
          onChange={(value) => onFilterChange('period', value)}
        />
      </div>
      <div className="filter-bar__benchmark-header">
        <div>
          <p className="panel__eyebrow">Direct benchmarks</p>
          <h3>Choose a like-for-like market or sector target when you need observed comparison instead of a proxy basket.</h3>
        </div>
      </div>
      <div className="benchmark-target-grid">
        <label className="control-field">
          <span>Compare to market</span>
          <select
            value={filters.benchmark_geography}
            onChange={(event) => onFilterChange('benchmark_geography', event.target.value)}
            disabled={marketTarget.status === 'blocked' && !(marketTarget.options ?? []).length}
          >
            {buildTargetOptions(
              marketTarget,
              marketTarget.status === 'blocked' ? 'Direct market comparison unavailable' : 'No direct market target',
            ).map((option) => (
              <option key={option.id || 'empty-market-target'} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
          {marketTarget.notes?.[0] ? <small className="control-field__note">{marketTarget.notes[0]}</small> : null}
        </label>

        <label className="control-field">
          <span>Compare to sector</span>
          <select
            value={filters.benchmark_sector}
            onChange={(event) => onFilterChange('benchmark_sector', event.target.value)}
            disabled={sectorTarget.status === 'blocked' && !(sectorTarget.options ?? []).length}
          >
            {buildTargetOptions(
              sectorTarget,
              sectorTarget.status === 'blocked' ? 'Direct sector comparison unavailable' : 'No direct sector target',
            ).map((option) => (
              <option key={option.id || 'empty-sector-target'} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
          {sectorTarget.notes?.[0] ? <small className="control-field__note">{sectorTarget.notes[0]}</small> : null}
        </label>
      </div>
      <div className="filter-bar__actions">
        <button className="filter-bar__button" type="button" onClick={onExport} disabled={exporting}>
          <Download size={16} />
          {exporting ? 'Exporting...' : 'Export evidence pack'}
        </button>
      </div>
    </section>
  )
}

function IntelligenceSection({ intelligence, semanticMetrics, onOpenEvidence }) {
  const benchmarkContext = intelligence.benchmark_context

  return (
    <section className="intelligence-section">
      <article className="intelligence-brief">
        <div className="panel__header">
          <div>
            <p className="panel__eyebrow">Decision brief</p>
            <h2>{intelligence.headline}</h2>
          </div>
          <ToneChip tone="neutral">Grounded interpretation</ToneChip>
        </div>
        <p className="intelligence-brief__summary">{intelligence.summary}</p>
        {benchmarkContext ? (
          <div className="intelligence-benchmark">
            <div className="intelligence-benchmark__top">
              <div>
                <p className="panel__eyebrow">Benchmark context</p>
                <h3>{benchmarkContext.target_label}</h3>
              </div>
              <ToneChip tone={toneFromConfidence(benchmarkContext.confidence)}>
                {benchmarkContext.confidence} confidence
              </ToneChip>
            </div>
            <p>{benchmarkContext.summary}</p>
            <div className="intelligence-benchmark__chips">
              <ToneChip tone={benchmarkContext.coverage_status === 'partial' ? 'neutral' : 'good'}>
                {benchmarkContext.coverage_status}
              </ToneChip>
              <span className="comparison-meta__pill">
                {benchmarkContext.applicable_metric_count}/{benchmarkContext.total_metric_count} metrics
              </span>
            </div>
          </div>
        ) : null}
        <div className="score-grid">
          {semanticMetrics.map((metric) => (
            <SemanticMetricCard key={metric.id} metric={metric} onOpenEvidence={onOpenEvidence} />
          ))}
        </div>
      </article>

      <div className="intelligence-grid">
        <article className="panel panel--intelligence">
          <div className="panel__header">
            <div>
              <p className="panel__eyebrow">Signals</p>
              <h2>What the data is saying</h2>
            </div>
          </div>
          <div className="signal-list">
            {intelligence.signals.map((signal) => (
              <div key={signal.id} className="signal-item">
                <div className="signal-item__top">
                  <h3>{signal.title}</h3>
                  <ToneChip tone={signal.tone}>{signal.tone}</ToneChip>
                </div>
                <p>{signal.detail}</p>
                <button className="insight-button" type="button" onClick={() => onOpenEvidence(signal.evidence_bundle)}>
                  View evidence
                </button>
              </div>
            ))}
          </div>
        </article>

        <article className="panel panel--intelligence">
          <div className="panel__header">
            <div>
              <p className="panel__eyebrow">Actions</p>
              <h2>Recommended next moves</h2>
            </div>
          </div>
          <div className="recommendation-list">
            {intelligence.recommendations.map((recommendation) => (
              <div key={recommendation.id} className="recommendation-item">
                <div className="recommendation-item__top">
                  <h3>{recommendation.title}</h3>
                  <span
                    className={`priority-badge ${PRIORITY_CLASS[recommendation.priority] ?? PRIORITY_CLASS.medium}`}
                  >
                    {recommendation.priority} priority
                  </span>
                </div>
                <p>{recommendation.detail}</p>
                <button className="insight-button" type="button" onClick={() => onOpenEvidence(recommendation.evidence_bundle)}>
                  View evidence
                </button>
              </div>
            ))}
          </div>
        </article>

        <article className="panel panel--intelligence">
          <div className="panel__header">
            <div>
              <p className="panel__eyebrow">Watchlist</p>
              <h2>Where to look first</h2>
            </div>
          </div>
          <div className="watchlist">
            {intelligence.watchlist.map((item) => (
              <div key={item.id} className="watchlist-item">
                <div className="watchlist-item__top">
                  <span className="watchlist-item__label">{item.label}</span>
                  <ToneChip tone={item.tone}>{item.value}</ToneChip>
                </div>
                <p>{item.detail}</p>
                <button className="insight-button" type="button" onClick={() => onOpenEvidence(item.evidence_bundle)}>
                  View evidence
                </button>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  )
}

function ComparisonMetricCard({ metric, benchmarkId, onOpenEvidence }) {
  const comparison = metric.comparisons?.[benchmarkId]
  const Icon = METRIC_ICONS[metric.id] ?? Activity

  if (!comparison) {
    return null
  }

  return (
    <article className="comparison-card">
      <div className="comparison-card__header">
        <div>
          <p className="metric-card__eyebrow">{metric.title}</p>
          <h3>{formatMetricValue(metric.value, metric.unit)}</h3>
        </div>
        <span className="metric-card__icon">
          <Icon size={20} strokeWidth={2.1} />
        </span>
      </div>

      <div className="comparison-card__body">
        <div className="comparison-card__row">
          <span>{comparison.label}</span>
          <strong>{formatComparisonValue(comparison.benchmark_value, metric.unit)}</strong>
        </div>
        <div className="comparison-card__row">
          <span>Gap</span>
          <strong>{formatSignedDifference(comparison.delta, metric.unit)}</strong>
        </div>
        {comparison.selected_target ? (
          <div className="comparison-card__row">
            <span>Benchmark target</span>
            <strong>{comparison.selected_target.label}</strong>
          </div>
        ) : null}
        <div className="comparison-card__row">
          <span>Coverage</span>
          <strong>
            {comparison.coverage_status} • {comparison.observation_count}/{comparison.expected_count}
          </strong>
        </div>
        <div className="comparison-card__chips">
          <ToneChip tone={toneFromBenchmarkStatus(comparison.benchmark_status)}>
            {comparison.benchmark_status}
          </ToneChip>
          <ToneChip tone={toneFromConfidence(comparison.confidence)}>
            {comparison.confidence} confidence
          </ToneChip>
          <ToneChip tone={comparison.tone ?? 'neutral'}>
            {comparison.gap_label}
          </ToneChip>
        </div>
      </div>

      <p className="comparison-card__explanation">{comparison.explanation}</p>
      {!!comparison.notes?.length && <p className="comparison-card__note">{comparison.notes[0]}</p>}

      {comparison.evidence_bundle ? (
        <button className="insight-button" type="button" onClick={() => onOpenEvidence(comparison.evidence_bundle)}>
          View evidence
        </button>
      ) : null}
    </article>
  )
}

function ComparisonSection({
  comparisons,
  metrics,
  selectedBenchmark,
  onBenchmarkChange,
  onOpenEvidence,
}) {
  const benchmarkOptions = comparisons?.benchmark_options ?? []
  const peerGroup = comparisons?.peer_group ?? {}
  const activeBenchmarkMeta = benchmarkOptions.find((option) => option.id === selectedBenchmark)
  const availableMetrics = metrics.filter((metric) => metric.comparisons?.[selectedBenchmark]?.available)
  const activeUnavailableMetrics = activeBenchmarkMeta?.unavailable_metrics ?? []
  const activeBenchmarkLabel = activeBenchmarkMeta?.selected_target?.label ?? activeBenchmarkMeta?.label
  const activeLeadMetric = activeBenchmarkMeta?.lead_metric

  return (
    <section className="comparison-section">
      <article className="comparison-overview panel">
        <div className="panel__header">
          <div>
            <p className="panel__eyebrow">Comparative intelligence</p>
            <h2>Benchmarks with confidence and coverage called out</h2>
          </div>
          <ToneChip tone={toneFromConfidence(comparisons?.confidence)}>
            {comparisons?.confidence ?? 'medium'} confidence
          </ToneChip>
        </div>

        <p className="comparison-overview__summary">{comparisons?.summary}</p>

        <div className="comparison-overview__controls">
          {benchmarkOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`comparison-toggle ${selectedBenchmark === option.id ? 'comparison-toggle--active' : ''}`}
              onClick={() => option.availability === 'available' && onBenchmarkChange(option.id)}
              disabled={option.availability !== 'available'}
            >
              <span>{option.label}</span>
              <small>{option.benchmark_status}</small>
            </button>
          ))}
        </div>

        <div className="comparison-overview__meta">
          {benchmarkOptions.map((option) => (
            <div key={option.id} className="comparison-meta">
              <div className="comparison-meta__top">
                <strong>{option.label}</strong>
                <ToneChip tone={toneFromConfidence(option.confidence)}>{option.confidence}</ToneChip>
              </div>
              <div className="comparison-meta__detail-list">
                <span>{option.coverage_status}</span>
                <span>
                  {option.applicable_metric_count}/{option.total_metric_count} metrics
                </span>
                {option.selected_target ? <span>{option.selected_target.label}</span> : null}
              </div>
              <p>{option.description}</p>
              {option.unavailable_metrics?.length ? (
                <p className="comparison-meta__footnote">
                  {option.unavailable_metrics.length} metric{option.unavailable_metrics.length === 1 ? '' : 's'} excluded for now.
                </p>
              ) : null}
            </div>
          ))}
        </div>

        {!!comparisons?.notes?.length && (
          <div className="comparison-overview__notes">
            {comparisons.notes.map((note) => (
              <div key={note} className="product-note">
                <ShieldCheck size={16} />
                <span>{note}</span>
              </div>
            ))}
          </div>
        )}

        {activeBenchmarkMeta ? (
          <div className="comparison-focus">
            <div className="comparison-focus__top">
              <div>
                <p className="panel__eyebrow">Active benchmark basis</p>
                <h3>{activeBenchmarkLabel}</h3>
              </div>
              <div className="comparison-focus__chips">
                <ToneChip tone={toneFromBenchmarkStatus(activeBenchmarkMeta.benchmark_status)}>
                  {activeBenchmarkMeta.benchmark_status}
                </ToneChip>
                <ToneChip tone={toneFromConfidence(activeBenchmarkMeta.confidence)}>
                  {activeBenchmarkMeta.confidence} confidence
                </ToneChip>
                <span className="comparison-meta__pill">
                  {activeBenchmarkMeta.applicable_metric_count}/{activeBenchmarkMeta.total_metric_count} metrics
                </span>
              </div>
            </div>
            <p className="comparison-focus__summary">{activeBenchmarkMeta.description}</p>
            {activeLeadMetric ? (
              <p className="comparison-focus__lead">
                Widest current gap: {activeLeadMetric.title} • {activeLeadMetric.gap_label}
              </p>
            ) : null}
            {!!activeBenchmarkMeta.available_metrics?.length && (
              <div className="comparison-focus__metric-list">
                {activeBenchmarkMeta.available_metrics.map((title) => (
                  <span key={`${activeBenchmarkMeta.id}-${title}`} className="comparison-meta__pill">
                    {title}
                  </span>
                ))}
              </div>
            )}
            {!!activeUnavailableMetrics.length && (
              <div className="comparison-focus__limits">
                {activeUnavailableMetrics.map((item) => (
                  <div key={`${activeBenchmarkMeta.id}-${item.id}`} className="comparison-focus__limit">
                    <strong>{item.title}</strong>
                    <span>{item.reason}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {peerGroup.available ? (
          <div className="comparison-peer-strip">
            <div>
              <p className="panel__eyebrow">Peer basket</p>
              <h3>{peerGroup.label}</h3>
            </div>
            <div className="comparison-peer-strip__chips">
              {peerGroup.members.map((member) => (
                <span key={member.geo_id} className="analyst-console__evidence-chip">
                  {member.label} • {member.common_metric_count} metrics
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </article>

      {availableMetrics.length ? (
        <div className="comparison-grid">
          {availableMetrics.map((metric) => (
            <ComparisonMetricCard
              key={`${metric.id}-${selectedBenchmark}`}
              metric={metric}
              benchmarkId={selectedBenchmark}
              onOpenEvidence={onOpenEvidence}
            />
          ))}
        </div>
      ) : (
        <article className="comparison-empty panel">
          <div className="panel__header panel__header--tight">
            <div>
              <p className="panel__eyebrow">Coverage limit</p>
              <h3>No metrics are currently comparable on this basis</h3>
            </div>
          </div>
          <p>{activeBenchmarkMeta?.description ?? 'Choose another benchmark or adjust the filter state.'}</p>
          {!!activeUnavailableMetrics.length && (
            <div className="comparison-empty__reasons">
              {activeUnavailableMetrics.map((item) => (
                <div key={`${selectedBenchmark}-${item.id}`} className="comparison-focus__limit">
                  <strong>{item.title}</strong>
                  <span>{item.reason}</span>
                </div>
              ))}
            </div>
          )}
        </article>
      )}
    </section>
  )
}

function CompanyBenchmarkSection({ internalData, companyBenchmark }) {
  const internalLoaded = Boolean(internalData?.available)
  const benchmarkAvailable = Boolean(companyBenchmark?.available)

  return (
    <section className="comparison-section">
      <article className="panel panel--intelligence">
        <div className="panel__header">
          <div>
            <p className="panel__eyebrow">Company-Aware Preview</p>
            <h2>Internal data connection and first blended benchmark</h2>
          </div>
          <div className="comparison-focus__chips">
            <ToneChip tone={internalLoaded ? 'good' : 'watch'}>
              {internalLoaded ? 'internal mart active' : 'internal mart inactive'}
            </ToneChip>
            {companyBenchmark?.evidence_basis ? (
              <ToneChip tone={toneFromEvidenceBasis(companyBenchmark.evidence_basis)}>
                {companyBenchmark.evidence_basis} evidence
              </ToneChip>
            ) : null}
          </div>
        </div>

        <p className="comparison-overview__summary">{internalData?.note}</p>
        {!!internalData?.optional_sources?.length && (
          <div className="comparison-focus__metric-list">
            {internalData.optional_sources.map((source) => (
              <span key={source.source_id} className="comparison-meta__pill">
                {source.source_id.replace('internal_', '').replaceAll('_', ' ')}: {source.status}
              </span>
            ))}
          </div>
        )}

        {benchmarkAvailable ? (
          <>
            <div className="comparison-overview__meta">
              <div className="comparison-meta">
                <div className="comparison-meta__top">
                  <strong>Worker category</strong>
                  <ToneChip tone={toneFromConfidence(companyBenchmark.confidence)}>
                    {companyBenchmark.confidence} confidence
                  </ToneChip>
                </div>
                <div className="comparison-meta__detail-list">
                  <span>{companyBenchmark.worker_category?.label}</span>
                  <span>{companyBenchmark.headcount} employees</span>
                  <span>{companyBenchmark.coverage_status}</span>
                </div>
                <p>{companyBenchmark.note}</p>
              </div>

              <div className="comparison-meta">
                <div className="comparison-meta__top">
                  <strong>Internal pay gap</strong>
                  <span className="comparison-meta__pill">{companyBenchmark.snapshot_date ?? 'Unknown snapshot'}</span>
                </div>
                <div className="comparison-meta__detail-list">
                  <span>{formatMetricValue(companyBenchmark.internal_value)}</span>
                  <span>{companyBenchmark.female_count} female</span>
                  <span>{companyBenchmark.male_count} male</span>
                </div>
                <p>Directional pay-gap read from the modeled internal benchmark mart for the selected worker category.</p>
              </div>

              <div className="comparison-meta">
                <div className="comparison-meta__top">
                  <strong>Market comparator</strong>
                  <ToneChip tone={toneFromCoverageStatus('partial')}>market signal</ToneChip>
                </div>
                <div className="comparison-meta__detail-list">
                  <span>{formatMetricValue(companyBenchmark.market_value)}</span>
                  <span>{companyBenchmark.delta_label} vs market</span>
                </div>
                <p>External comparator comes from the modeled market benchmark joined into the dbt mart for the active country scope.</p>
              </div>
            </div>
          </>
        ) : (
          <div className="comparison-focus">
            <div className="comparison-focus__top">
              <div>
                <p className="panel__eyebrow">Current state</p>
                <h3>Company benchmark unavailable</h3>
              </div>
              <ToneChip tone="watch">external-only answers</ToneChip>
            </div>
            <p className="comparison-focus__summary">
              {companyBenchmark?.note ?? 'The company-aware benchmark is not available for the current scope.'}
            </p>
            {!!internalData?.missing_assets?.length && (
              <div className="comparison-focus__metric-list">
                {internalData.missing_assets.map((asset) => (
                  <span key={asset} className="comparison-meta__pill">
                    missing: {asset}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </article>
    </section>
  )
}

function buildPayTransparencyEvidence(payTransparency) {
  if (!payTransparency?.available) {
    return null
  }

  const summary = payTransparency.summary ?? {}
  return {
    title: payTransparency.title,
    summary: payTransparency.note,
    evidence: [
      { label: 'Unresolved review items', value: String(summary.unresolved_review_item_count ?? 0) },
      { label: 'Observed gaps', value: String(summary.observed_gap_count ?? 0) },
      { label: 'Monitored differences', value: String(summary.justified_difference_count ?? 0) },
      { label: 'Formula version', value: payTransparency.formula_version },
    ],
    provenance: payTransparency.provenance ?? [],
    governance_target: payTransparency.governance_target,
  }
}

function ComplianceSimulationSection({ payTransparency, onOpenEvidence }) {
  const available = Boolean(payTransparency?.available)
  const summary = payTransparency?.summary ?? {}
  const reviewItems = payTransparency?.top_review_items ?? []

  return (
    <section className="comparison-section">
      <article className="panel panel--intelligence">
        <div className="panel__header">
          <div>
            <p className="panel__eyebrow">Compliance Suite</p>
            <h2>Pay-transparency category review</h2>
          </div>
          <div className="comparison-focus__chips">
            <ToneChip tone={available ? toneFromCoverageStatus(payTransparency.coverage_status) : 'watch'}>
              {available ? payTransparency.coverage_status : 'simulation inactive'}
            </ToneChip>
            {payTransparency?.evidence_basis ? (
              <ToneChip tone={toneFromEvidenceBasis(payTransparency.evidence_basis)}>
                {payTransparency.evidence_basis} evidence
              </ToneChip>
            ) : null}
          </div>
        </div>

        <p className="comparison-overview__summary">{payTransparency?.note}</p>

        {available ? (
          <>
            <div className="compliance-summary-grid">
              <div className="comparison-meta">
                <div className="comparison-meta__top">
                  <strong>Unresolved review items</strong>
                  <AlertTriangle size={16} />
                </div>
                <div className="comparison-meta__detail-list">
                  <span>{summary.unresolved_review_item_count ?? 0}</span>
                  <span>{formatMetricValue(summary.max_internal_gap)} max gap</span>
                </div>
              </div>

              <div className="comparison-meta">
                <div className="comparison-meta__top">
                  <strong>Observed gaps</strong>
                  <Scale size={16} />
                </div>
                <div className="comparison-meta__detail-list">
                  <span>{summary.observed_gap_count ?? 0}</span>
                  <span>{summary.category_count ?? 0} categories reviewed</span>
                </div>
              </div>

              <div className="comparison-meta">
                <div className="comparison-meta__top">
                  <strong>Monitored differences</strong>
                  <ClipboardCheck size={16} />
                </div>
                <div className="comparison-meta__detail-list">
                  <span>{summary.justified_difference_count ?? 0}</span>
                  <span>{payTransparency.formula_version}</span>
                </div>
              </div>
            </div>

            {!!reviewItems.length && (
              <div className="compliance-review-list">
                {reviewItems.map((item) => (
                  <div key={item.worker_category.id} className="compliance-review-item">
                    <div className="comparison-meta__top">
                      <strong>{item.worker_category.label}</strong>
                      <span className={`priority-badge ${PRIORITY_CLASS[item.priority] ?? ''}`}>
                        {REVIEW_STATE_LABELS[item.review_state] ?? item.review_label}
                      </span>
                    </div>
                    <div className="comparison-meta__detail-list">
                      <span>{formatMetricValue(item.internal_gap)} internal gap</span>
                      <span>{item.market_gap == null ? 'No market comparator' : `${formatMetricValue(item.market_gap)} market`}</span>
                      <span>{item.headcount} employees</span>
                    </div>
                    <p>{item.rationale}</p>
                  </div>
                ))}
              </div>
            )}

            <button
              className="panel__action"
              type="button"
              onClick={() => onOpenEvidence(buildPayTransparencyEvidence(payTransparency))}
            >
              <FileSearch size={16} />
              Open compliance evidence
            </button>
          </>
        ) : (
          <div className="comparison-focus">
            <div className="comparison-focus__top">
              <div>
                <p className="panel__eyebrow">Current state</p>
                <h3>Simulation unavailable</h3>
              </div>
              <ToneChip tone="watch">needs trusted internal data</ToneChip>
            </div>
            <p className="comparison-focus__summary">
              {payTransparency?.unavailable_reason ?? 'Trusted internal category pay data is required before compliance simulation can run.'}
            </p>
          </div>
        )}
      </article>
    </section>
  )
}

function EvidenceDrawer({
  evidence,
  governance,
  onClose,
  onGovernanceAction,
  actionLoading,
}) {
  if (!evidence) {
    return null
  }

  return (
    <aside className="evidence-drawer">
      <div className="evidence-drawer__header">
        <div>
          <p className="panel__eyebrow">Evidence drawer</p>
          <h2>{evidence.title}</h2>
        </div>
        <button className="evidence-drawer__close" type="button" onClick={onClose}>
          <X size={18} />
        </button>
      </div>

      <p className="evidence-drawer__summary">{evidence.summary}</p>

      <div className="evidence-drawer__section">
        <h3>Evidence</h3>
        <div className="evidence-drawer__list">
          {evidence.evidence.map((item) => (
            <div key={`${item.label}-${item.value}`} className="evidence-drawer__item">
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>
      </div>

      <div className="evidence-drawer__section">
        <h3>Provenance</h3>
        <div className="evidence-drawer__provenance-list">
          {evidence.provenance.map((item) => (
            <div key={`${item.metric_id}-${item.source_id}`} className="evidence-drawer__provenance-item">
              <strong>{item.metric_id}</strong>
              <span>{item.source_name}</span>
              <span>{item.source_version}</span>
              <span>{item.formula_version}</span>
              {item.human_review_required ? <ToneChip tone="watch">Human review required</ToneChip> : null}
            </div>
          ))}
        </div>
      </div>

      <div className="evidence-drawer__section">
        <h3>Governance actions</h3>
        <div className="evidence-drawer__actions">
          {governance.available_actions.map((action) => (
            <button
              key={action.action_code}
              className={`governance-button ${GOVERNANCE_CLASS[action.action_code] ?? ''}`}
              type="button"
              disabled={actionLoading}
              onClick={() =>
                onGovernanceAction(
                  action.action_code,
                  evidence.governance_target.target_type,
                  evidence.governance_target.target_id,
                )
              }
            >
              {action.action_name}
            </button>
          ))}
        </div>
      </div>

      {!!governance.recent_events?.length && (
        <div className="evidence-drawer__section">
          <h3>Recent governance events</h3>
          <div className="governance-log">
            {governance.recent_events.map((event) => (
              <div key={event.event_id} className="governance-log__item">
                <span>{event.action_name}</span>
                <strong>{event.target_id}</strong>
                <small>{event.reason || 'No reason required'}</small>
              </div>
            ))}
          </div>
        </div>
      )}
    </aside>
  )
}

function AnalystConsole({ filters, initialResponse }) {
  const [question, setQuestion] = useState('')
  const [response, setResponse] = useState(initialResponse)
  const [asking, setAsking] = useState(false)

  useEffect(() => {
    setResponse(initialResponse)
  }, [initialResponse])

  async function submitQuestion(nextQuestion) {
    const prompt = nextQuestion.trim()
    if (!prompt) {
      return
    }

    setQuestion(prompt)
    setAsking(true)

    try {
      const apiResponse = await axios.post(`${API_BASE}/ask`, {
        question: prompt,
        ...filters,
      })
      setResponse(apiResponse.data)
    } catch {
      setResponse({
        question: prompt,
        answer:
          'The analyst console could not complete that request right now. Review the evidence-backed cards on the page or retry once the local API is stable.',
        confidence: 'low',
        evidence: [],
        provenance: [],
        follow_ups: CONSOLE_FOLLOW_UPS,
      })
    } finally {
      setAsking(false)
    }
  }

  function handleSubmit(event) {
    event.preventDefault()
    submitQuestion(question)
  }

  return (
    <section className="analyst-console">
      <article className="panel analyst-console__shell">
        <div className="panel__header">
          <div>
            <p className="panel__eyebrow">Analyst console</p>
            <h2>Ask WorkforceGuard what matters</h2>
          </div>
          <ToneChip tone={asking ? 'watch' : 'good'}>
            {asking ? 'Thinking' : 'Ready'}
          </ToneChip>
        </div>

        <form className="analyst-console__form" onSubmit={handleSubmit}>
          <label className="analyst-console__label" htmlFor="analyst-question">
            Questions stay grounded in the approved metrics, benchmark rules, and the current filter state.
          </label>
          <div className="analyst-console__controls">
            <input
              id="analyst-question"
              className="analyst-console__input"
              type="text"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Example: How does this market compare to the EU benchmark?"
            />
            <button className="analyst-console__button" type="submit" disabled={asking}>
              {asking ? 'Analyzing...' : 'Ask'}
            </button>
          </div>
        </form>

        <div className="analyst-console__suggestions">
          {response?.follow_ups?.map((suggestion) => (
            <button
              key={suggestion}
              className="analyst-console__chip"
              type="button"
              onClick={() => submitQuestion(suggestion)}
            >
              {suggestion}
            </button>
          ))}
        </div>

        {response ? (
          <div className="analyst-console__response">
        <div className="analyst-console__response-top">
          <div>
            <p className="analyst-console__question">{response.question}</p>
            <h3>{response.answer}</h3>
          </div>
          <div className="comparison-focus__chips">
            <ToneChip tone={toneFromConfidence(response.confidence)}>
              {response.confidence} confidence
            </ToneChip>
            {response.evidence_basis ? (
              <ToneChip tone={toneFromEvidenceBasis(response.evidence_basis)}>
                {response.evidence_basis} evidence
              </ToneChip>
            ) : null}
          </div>
        </div>

            {response.benchmark_basis ? (
              <div className="analyst-console__basis">
                <div className="analyst-console__basis-top">
                  <div>
                    <p className="panel__eyebrow">Benchmark basis</p>
                    <h4>{response.benchmark_basis.analyst_label ?? response.benchmark_basis.label}</h4>
                  </div>
                  <div className="analyst-console__basis-chips">
                    <ToneChip tone={toneFromBenchmarkStatus(response.benchmark_basis.benchmark_status)}>
                      {response.benchmark_basis.benchmark_status}
                    </ToneChip>
                    <span className="comparison-meta__pill">
                      {response.coverage?.status ?? response.benchmark_basis.coverage_status} coverage
                    </span>
                    <span className="comparison-meta__pill">
                      {(response.coverage?.applicable_metric_count ?? response.benchmark_basis.applicable_metric_count)}/
                      {(response.coverage?.total_metric_count ?? response.benchmark_basis.total_metric_count)} metrics
                    </span>
                  </div>
                </div>
                {response.benchmark_basis.description ? (
                  <p className="analyst-console__basis-copy">{response.benchmark_basis.description}</p>
                ) : null}
                {response.coverage?.summary ? (
                  <p className="analyst-console__basis-copy">{response.coverage.summary}</p>
                ) : null}
              </div>
            ) : null}

            {!!response.limitations?.length && (
              <div className="analyst-console__limits">
                {response.limitations.map((item) => (
                  <div key={item} className="analyst-console__limit">
                    <AlertTriangle size={14} />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            )}

            {!!response.evidence?.length && (
              <div className="analyst-console__evidence">
                {response.evidence.map((item) => (
                  <span key={`${item.label}-${item.value}`} className="analyst-console__evidence-chip">
                    {item.label}: {item.value}
                  </span>
                ))}
              </div>
            )}

            {!!response.provenance?.length && (
              <div className="analyst-console__provenance">
                {response.provenance.map((item) => (
                  <ProvenanceBadge
                    key={`${item.metric_id}-${item.source_id}`}
                    provenance={item}
                    compact
                  />
                ))}
              </div>
            )}

            {!!response.follow_ups?.length && (
              <div className="analyst-console__follow-ups">
                {response.follow_ups.map((followUp) => (
                  <button
                    key={followUp}
                    className="analyst-console__follow-up"
                    type="button"
                    onClick={() => submitQuestion(followUp)}
                  >
                    {followUp}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </article>
    </section>
  )
}

function useOverviewData() {
  const [filters, setFilters] = useState({
    country: 'ALL',
    geography: 'EU27_AVG',
    sector: 'ALL',
    period: 'latest',
    benchmark_geography: '',
    benchmark_sector: '',
  })
  const [overview, setOverview] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [exporting, setExporting] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [notice, setNotice] = useState(null)
  const requestFilters = useMemo(
    () => ({
      country: filters.country,
      geography: filters.geography,
      sector: filters.sector,
      period: filters.period,
      benchmark_geography: filters.benchmark_geography,
      benchmark_sector: filters.benchmark_sector,
    }),
    [
      filters.country,
      filters.geography,
      filters.sector,
      filters.period,
      filters.benchmark_geography,
      filters.benchmark_sector,
    ],
  )

  useEffect(() => {
    if (!notice) {
      return undefined
    }

    const timeoutId = window.setTimeout(() => setNotice(null), 4200)
    return () => window.clearTimeout(timeoutId)
  }, [notice])

  useEffect(() => {
    let cancelled = false

    async function loadOverview() {
      setLoading(true)
      setError('')

      try {
        const response = await axios.get(`${API_BASE}/overview`, {
          params: buildQueryParams(requestFilters),
        })

        if (!cancelled) {
          startTransition(() => {
            setOverview(response.data)
            const nextApplied = response.data.filters?.applied
            if (nextApplied) {
              const nextComparisonTargets = response.data.comparisons?.targets ?? {}
              const nextRequestState = {
                country: nextApplied.country,
                geography: nextApplied.geography,
                sector: nextApplied.sector,
                period: nextApplied.period,
                benchmark_geography: nextComparisonTargets.market?.selected?.id ?? '',
                benchmark_sector: nextComparisonTargets.sector?.selected?.id ?? '',
              }
              if (JSON.stringify(requestFilters) !== JSON.stringify(nextRequestState)) {
                setFilters(nextRequestState)
              }
            }
          })
        }
      } catch (requestError) {
        if (!cancelled) {
          if (axios.isAxiosError(requestError)) {
            if (requestError.response?.status >= 500) {
              setError('The API hit an internal error while building this view. Try a different filter state or inspect the backend logs.')
            } else if (requestError.response?.status) {
              setError(`The API rejected this request with status ${requestError.response.status}.`)
            } else {
              setError('The dashboard could not reach the analytics API.')
            }
          } else {
            setError('The dashboard could not load analytics from the local API.')
          }
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadOverview()

    return () => {
      cancelled = true
    }
  }, [requestFilters])

  async function exportEvidencePack() {
    setExporting(true)
    try {
      const response = await axios.get(`${API_BASE}/evidence-pack`, {
        params: buildQueryParams(filters),
      })
      const blob = new Blob([JSON.stringify(response.data, null, 2)], {
        type: 'application/json',
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'workforceguard-evidence-pack.json'
      link.click()
      URL.revokeObjectURL(url)
      setNotice({
        tone: 'good',
        title: 'Evidence pack exported',
        detail: 'The current scope has been downloaded as a governance-friendly JSON pack.',
      })
    } catch {
      setNotice({
        tone: 'watch',
        title: 'Export failed',
        detail: 'The evidence pack could not be generated from the local API for this scope.',
      })
    } finally {
      setExporting(false)
    }
  }

  async function recordGovernanceAction(actionCode, targetType, targetId) {
    const requiresReason = overview?.governance?.available_actions?.find(
      (action) => action.action_code === actionCode,
    )?.requires_reason
    let reason = ''

    if (requiresReason) {
      reason = window.prompt(`Why are you choosing "${actionCode}" for ${targetId}?`) ?? ''
      if (!reason.trim()) {
        return
      }
    }

    setActionLoading(true)
    try {
      const response = await axios.post(`${API_BASE}/governance-events`, {
        action_code: actionCode,
        target_type: targetType,
        target_id: targetId,
        reason,
      })

      setOverview((current) =>
        current
          ? {
              ...current,
              governance: {
                ...current.governance,
                recent_events: [response.data, ...(current.governance?.recent_events ?? [])].slice(0, 10),
              },
            }
          : current,
      )
      setNotice({
        tone: actionCode === 'approved' ? 'good' : 'watch',
        title: `Governance event recorded`,
        detail: `${actionCode} was logged for ${targetId}.`,
      })
    } catch {
      setNotice({
        tone: 'watch',
        title: 'Governance event failed',
        detail: 'The action could not be recorded. Check the API and try again.',
      })
    } finally {
      setActionLoading(false)
    }
  }

  return {
    filters,
    setFilters,
    overview,
    loading,
    error,
    exporting,
    actionLoading,
    notice,
    setNotice,
    exportEvidencePack,
    recordGovernanceAction,
  }
}

function Overview() {
  const {
    filters,
    setFilters,
    overview,
    loading,
    error,
    exporting,
    actionLoading,
    notice,
    setNotice,
    exportEvidencePack,
    recordGovernanceAction,
  } = useOverviewData()
  const [selectedEvidence, setSelectedEvidence] = useState(null)
  const [selectedBenchmark, setSelectedBenchmark] = useState('eu')

  useEffect(() => {
    if (!selectedEvidence) {
      return undefined
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setSelectedEvidence(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedEvidence])

  const initialAnalystResponse = useMemo(() => {
    if (!overview) {
      return null
    }

    const selectedBenchmarkMeta = overview.comparisons?.selected_benchmark ?? null
    const benchmarkBasis = normalizeBenchmarkBasis(selectedBenchmarkMeta, overview)
    const benchmarkId = selectedBenchmarkMeta?.id ?? overview.comparisons?.default_benchmark
    const comparableMetrics =
      overview.metrics?.filter((metric) => metric.comparisons?.[benchmarkId]?.available) ?? []

    return {
      question: buildActiveBenchmarkQuestion(overview),
      answer: overview.comparisons?.summary ?? overview.intelligence.headline,
      confidence: benchmarkBasis?.confidence ?? overview.comparisons?.confidence ?? 'high',
      benchmark_basis: benchmarkBasis,
      coverage: {
        status: benchmarkBasis?.coverage_status ?? 'unavailable',
        summary: benchmarkBasis?.coverage_note ?? '',
        applicable_metric_count: benchmarkBasis?.applicable_metric_count ?? 0,
        total_metric_count: benchmarkBasis?.total_metric_count ?? overview.metrics?.length ?? 0,
      },
      limitations: buildInitialAnalystLimitations(overview, benchmarkBasis),
      evidence:
        comparableMetrics
          ?.map((metric) => {
            const comparison = metric.comparisons?.[benchmarkId]
            if (!comparison?.available) {
              return null
            }

            return {
              label: metric.title,
              value: `${formatMetricValue(metric.value, metric.unit)} vs ${formatComparisonValue(comparison.benchmark_value, metric.unit)}`,
            }
          })
          .filter(Boolean)
          .slice(0, 3) ?? [],
      provenance: comparableMetrics.slice(0, 3).map((metric) => metric.provenance) ?? [],
      follow_ups: buildConsoleFollowUps(overview),
      evidence_basis: 'external',
      internal_data_available: Boolean(overview.internal_data?.available),
    }
  }, [overview])

  const activeBenchmark = useMemo(() => {
    if (!overview?.comparisons?.default_benchmark) {
      return selectedBenchmark
    }

    const availableBenchmarks = new Set(
      (overview.comparisons.benchmark_options ?? [])
        .filter((option) => option.availability === 'available')
        .map((option) => option.id),
    )

    return availableBenchmarks.has(selectedBenchmark)
      ? selectedBenchmark
      : overview.comparisons.default_benchmark
  }, [overview, selectedBenchmark])

  if (loading) {
    return (
      <section className="dashboard dashboard--loading">
        <div className="loading-panel">
          <RefreshCw className="loading-panel__icon" size={24} />
          <h2>Connecting to workforce analytics</h2>
          <p>Preparing the latest European labour-market snapshot from the modeled API.</p>
        </div>
      </section>
    )
  }

  if (error || !overview) {
    return (
      <section className="dashboard dashboard--error">
        <div className="error-panel">
          <AlertTriangle size={22} />
          <h2>Local API unavailable</h2>
          <p>{error || 'No overview payload was returned by the local API.'}</p>
          <p>Check whether the backend is running, or inspect the backend logs if the API returned an internal error.</p>
        </div>
      </section>
    )
  }

  const { applied, options, notes } = overview.filters
  const generatedAt = overview.generated_at
    ? fullDateTimeFormatter.format(new Date(overview.generated_at))
    : 'Latest available'

  return (
    <section className="dashboard">
      <div className="dashboard__halo dashboard__halo--one" />
      <div className="dashboard__halo dashboard__halo--two" />

      <header className="hero">
        <div className="hero__copy">
          <p className="hero__eyebrow">WorkforceGuard command centre</p>
          <h1>European labour intelligence with evidence and review built in.</h1>
          <p className="hero__lede">
            Move from passive charts to benchmark-aware workforce signals, coverage-conscious comparisons,
            explainable recommendations, and governance-friendly evidence packs.
          </p>
        </div>
        <div className="hero__meta">
          <div className="hero__meta-card">
            <span>Snapshot generated</span>
            <strong>{generatedAt}</strong>
          </div>
          <div className="hero__meta-card">
            <span>Current scope</span>
            <strong>{applied.geography_label}</strong>
          </div>
        </div>
      </header>

      <FilterBar
        filters={filters}
        options={options}
        comparisonTargets={overview.comparisons?.targets}
        onFilterChange={(key, value) => {
          if (key === 'benchmark_geography' && value) {
            setSelectedBenchmark('market')
          }
          if (key === 'benchmark_sector' && value) {
            setSelectedBenchmark('sector')
          }
          setFilters((current) => ({ ...current, [key]: value }))
        }}
        onExport={exportEvidencePack}
        exporting={exporting}
      />

      <InlineNotice notice={notice} onDismiss={() => setNotice(null)} />

      <PanelErrorBoundary
        resetKey={`${applied.country}-${applied.geography}-${applied.sector}-${applied.period}-${overview.generated_at}`}
      >
        <BriefingBoard overview={overview} />
      </PanelErrorBoundary>

      <section className="product-notes">
        {notes.map((note) => (
          <div key={note} className="product-note">
            <ShieldCheck size={16} />
            <span>{note}</span>
          </div>
        ))}
      </section>

      <IntelligenceSection
        intelligence={overview.intelligence}
        semanticMetrics={overview.semantic_metrics}
        onOpenEvidence={setSelectedEvidence}
      />

      <ComparisonSection
        comparisons={overview.comparisons}
        metrics={overview.metrics}
        selectedBenchmark={activeBenchmark}
        onBenchmarkChange={setSelectedBenchmark}
        onOpenEvidence={setSelectedEvidence}
      />

      <CompanyBenchmarkSection
        internalData={overview.internal_data}
        companyBenchmark={overview.company_benchmark}
      />

      <ComplianceSimulationSection
        payTransparency={overview.pay_transparency}
        onOpenEvidence={setSelectedEvidence}
      />

      <section className="metric-section">
        <div className="panel__header panel__header--tight">
          <div>
            <p className="panel__eyebrow">Observed market metrics</p>
            <h2>What the source data currently shows</h2>
          </div>
        </div>
        <div className="metric-grid">
          {overview.metrics.map((metric) => (
            <MetricCard key={metric.id} metric={metric} onOpenEvidence={setSelectedEvidence} />
          ))}
        </div>
      </section>

      <AnalystConsole filters={filters} initialResponse={initialAnalystResponse} />

      <div className="dashboard-grid">
        <article className="panel panel--wide">
          <div className="panel__header">
            <div>
              <p className="panel__eyebrow">Trendline</p>
              <h2>Unemployment rate</h2>
            </div>
            <div className="panel__meta">
              <span className="panel__tag">Annual series</span>
              <ToneChip tone={toneFromCoverageStatus(overview.charts.unemployment_trend.coverage?.status)}>
                {overview.charts.unemployment_trend.coverage?.status ?? 'unavailable'} coverage
              </ToneChip>
              <ProvenanceBadge provenance={overview.charts.unemployment_trend.provenance} compact />
            </div>
          </div>
          {overview.charts.unemployment_trend.coverage?.note ? (
            <p className="panel__coverage-note">{overview.charts.unemployment_trend.coverage.note}</p>
          ) : null}
          <div className="panel__body panel__body--chart">
            {overview.charts.unemployment_trend.series.length ? (
              <ChartFrame>
                <LineChart data={overview.charts.unemployment_trend.series} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                  <CartesianGrid stroke="rgba(127, 219, 255, 0.12)" vertical={false} />
                  <XAxis dataKey="period" tickLine={false} axisLine={false} tick={{ fill: '#9fb9d6', fontSize: 12 }} />
                  <YAxis tickFormatter={(value) => `${value}%`} tickLine={false} axisLine={false} tick={{ fill: '#9fb9d6', fontSize: 12 }} />
                  <Tooltip content={<ChartTooltip unit="%" />} />
                  <Line type="monotone" dataKey="value" stroke="#7ff4ea" strokeWidth={3} dot={{ r: 3, fill: '#7ff4ea', strokeWidth: 0 }} activeDot={{ r: 5, fill: '#f5f7ff', stroke: '#7ff4ea', strokeWidth: 2 }} />
                </LineChart>
              </ChartFrame>
            ) : (
              <ChartEmptyState message="No unemployment trend data is available for the current filter state." />
            )}
          </div>
        </article>

        <article className="panel">
          <div className="panel__header">
            <div>
              <p className="panel__eyebrow">Trendline</p>
              <h2>Employment rate</h2>
            </div>
            <div className="panel__meta">
              <span className="panel__tag">Annual series</span>
              <ToneChip tone={toneFromCoverageStatus(overview.charts.employment_trend.coverage?.status)}>
                {overview.charts.employment_trend.coverage?.status ?? 'unavailable'} coverage
              </ToneChip>
              <ProvenanceBadge provenance={overview.charts.employment_trend.provenance} compact />
            </div>
          </div>
          {overview.charts.employment_trend.coverage?.note ? (
            <p className="panel__coverage-note">{overview.charts.employment_trend.coverage.note}</p>
          ) : null}
          <div className="panel__body panel__body--chart">
            {overview.charts.employment_trend.series.length ? (
              <ChartFrame>
                <LineChart data={overview.charts.employment_trend.series} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                  <CartesianGrid stroke="rgba(127, 219, 255, 0.12)" vertical={false} />
                  <XAxis dataKey="period" tickLine={false} axisLine={false} tick={{ fill: '#9fb9d6', fontSize: 12 }} />
                  <YAxis tickFormatter={(value) => `${value}%`} tickLine={false} axisLine={false} tick={{ fill: '#9fb9d6', fontSize: 12 }} />
                  <Tooltip content={<ChartTooltip unit="%" />} />
                  <Line type="monotone" dataKey="value" stroke="#8db1ff" strokeWidth={3} dot={{ r: 3, fill: '#8db1ff', strokeWidth: 0 }} activeDot={{ r: 5, fill: '#f5f7ff', stroke: '#8db1ff', strokeWidth: 2 }} />
                </LineChart>
              </ChartFrame>
            ) : (
              <ChartEmptyState message="No employment trend data is available for the current filter state." />
            )}
          </div>
        </article>

        <article className="panel">
          <div className="panel__header">
            <div>
              <p className="panel__eyebrow">Ranking</p>
              <h2>Highest vacancy sectors</h2>
            </div>
            <div className="panel__meta">
              <span className="panel__tag">{applied.period === 'latest' ? 'Latest quarter' : applied.period}</span>
              <ToneChip tone={toneFromCoverageStatus(overview.charts.vacancy_by_sector.coverage?.status)}>
                {overview.charts.vacancy_by_sector.coverage?.status ?? 'unavailable'} coverage
              </ToneChip>
              <ProvenanceBadge provenance={overview.charts.vacancy_by_sector.provenance} compact />
            </div>
          </div>
          {overview.charts.vacancy_by_sector.coverage?.note ? (
            <p className="panel__coverage-note">{overview.charts.vacancy_by_sector.coverage.note}</p>
          ) : null}
          <div className="panel__body panel__body--chart">
            {overview.charts.vacancy_by_sector.series.length ? (
              <ChartFrame>
                <BarChart data={overview.charts.vacancy_by_sector.series} layout="vertical" margin={{ top: 8, right: 4, bottom: 0, left: 20 }}>
                  <CartesianGrid stroke="rgba(127, 219, 255, 0.12)" horizontal={false} />
                  <XAxis type="number" tickFormatter={(value) => `${value}%`} tickLine={false} axisLine={false} tick={{ fill: '#9fb9d6', fontSize: 12 }} />
                  <YAxis type="category" dataKey="sector_label" width={120} tickLine={false} axisLine={false} tick={{ fill: '#d7e6f7', fontSize: 12 }} />
                  <Tooltip content={<ChartTooltip unit="%" labelKey="sector_label" />} />
                  <Bar dataKey="value" radius={[0, 10, 10, 0]} fill="#7ff4ea" />
                </BarChart>
              </ChartFrame>
            ) : (
              <ChartEmptyState message="No sector vacancy ranking is available for the current filter state." />
            )}
          </div>
        </article>

        <article className="panel">
          <div className="panel__header">
            <div>
              <p className="panel__eyebrow">Ranking</p>
              <h2>Widest gender pay gaps</h2>
            </div>
            <div className="panel__meta">
              <span className="panel__tag">{applied.period === 'latest' ? 'Latest annual release' : applied.period}</span>
              <ToneChip tone={toneFromCoverageStatus(overview.charts.pay_gap_by_sector.coverage?.status)}>
                {overview.charts.pay_gap_by_sector.coverage?.status ?? 'unavailable'} coverage
              </ToneChip>
              <ProvenanceBadge provenance={overview.charts.pay_gap_by_sector.provenance} compact />
            </div>
          </div>
          {overview.charts.pay_gap_by_sector.coverage?.note ? (
            <p className="panel__coverage-note">{overview.charts.pay_gap_by_sector.coverage.note}</p>
          ) : null}
          <div className="panel__body panel__body--chart">
            {overview.charts.pay_gap_by_sector.series.length ? (
              <ChartFrame>
                <BarChart data={overview.charts.pay_gap_by_sector.series} layout="vertical" margin={{ top: 8, right: 4, bottom: 0, left: 20 }}>
                  <CartesianGrid stroke="rgba(127, 219, 255, 0.12)" horizontal={false} />
                  <XAxis type="number" tickFormatter={(value) => `${value}%`} tickLine={false} axisLine={false} tick={{ fill: '#9fb9d6', fontSize: 12 }} />
                  <YAxis type="category" dataKey="sector_label" width={120} tickLine={false} axisLine={false} tick={{ fill: '#d7e6f7', fontSize: 12 }} />
                  <Tooltip content={<ChartTooltip unit="%" labelKey="sector_label" />} />
                  <Bar dataKey="value" radius={[0, 10, 10, 0]} fill="#ff8aa5" />
                </BarChart>
              </ChartFrame>
            ) : (
              <ChartEmptyState message="No sector pay-gap ranking is available for the current filter state." />
            )}
          </div>
        </article>
      </div>

      {selectedEvidence ? (
        <button
          type="button"
          className="evidence-drawer__backdrop"
          aria-label="Close evidence drawer"
          onClick={() => setSelectedEvidence(null)}
        />
      ) : null}

      <EvidenceDrawer
        evidence={selectedEvidence}
        governance={overview.governance}
        onClose={() => setSelectedEvidence(null)}
        onGovernanceAction={recordGovernanceAction}
        actionLoading={actionLoading}
      />
    </section>
  )
}

export default Overview
