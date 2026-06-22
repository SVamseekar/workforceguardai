import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import axios from 'axios'
import { FreshnessPill } from '../primitives/FreshnessPill'
import { DataState } from '../shared/DataState'
import { ToneChip } from '../primitives/ToneChip'
import { normalizeOverview } from '../../lib/normalizeOverview'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api'

type AnyObj = Record<string, unknown>

const DESIRED_DIRECTION: Record<string, 'up' | 'down'> = {
  employment_rate: 'up',
  unemployment_rate: 'down',
  vacancy_rate: 'down',
  gender_pay_gap: 'down',
}

function deltaTone(metricId: string, delta: number): 'good' | 'watch' | 'neutral' {
  if (Math.abs(delta) < 0.05) return 'neutral'
  const dir = DESIRED_DIRECTION[metricId] ?? 'up'
  if (dir === 'up') return delta > 0 ? 'good' : 'watch'
  return delta < 0 ? 'good' : 'watch'
}

function buildNarrative(rows: Array<{ id: string; leftValue: string; rightValue: string }>, leftLabel: string, rightLabel: string): string {
  if (!rows.length) return ''
  let leftWins = 0
  let rightWins = 0
  rows.forEach(r => {
    const dir = DESIRED_DIRECTION[r.id] ?? 'up'
    const lv = parseFloat(r.leftValue)
    const rv = parseFloat(r.rightValue)
    if (isNaN(lv) || isNaN(rv)) return
    if (dir === 'up') { lv > rv ? leftWins++ : rv > lv ? rightWins++ : null }
    else { lv < rv ? leftWins++ : rv < lv ? rightWins++ : null }
  })
  const total = rows.length
  if (leftWins > rightWins) return `${leftLabel} outperforms ${rightLabel} on ${leftWins} of ${total} indicators.`
  if (rightWins > leftWins) return `${rightLabel} outperforms ${leftLabel} on ${rightWins} of ${total} indicators.`
  return `${leftLabel} and ${rightLabel} are broadly comparable across all ${total} indicators.`
}

const numberFormatter = new Intl.NumberFormat('en-IE', {
  maximumFractionDigits: 1,
  minimumFractionDigits: 0,
})

function formatValue(value: unknown, unit = '%') {
  if (value == null) return '—'
  if (unit === '%') return `${numberFormatter.format(Number(value))}%`
  if (unit === 'score') return `${numberFormatter.format(Number(value))}/100`
  return numberFormatter.format(Number(value))
}

interface PanelFilters {
  country: string
  geography: string
  sector: string
  period: string
}

function makeFilters(country: string, sector = 'ALL', period = 'latest'): PanelFilters {
  return {
    country,
    // geography must match country to get country-level data; ALL → EU27_AVG
    geography: country === 'ALL' ? 'EU27_AVG' : country,
    sector,
    period,
  }
}

async function fetchOverview(filters: PanelFilters): Promise<unknown> {
  const r = await axios.get(`${API_BASE}/overview`, { params: filters, withCredentials: true })
  return normalizeOverview(r.data)
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: { id: string; label: string }[]
  onChange: (v: string) => void
}) {
  const id = `compare-filter-${label.toLowerCase().replace(/\s+/g, '-')}`
  return (
    <div className="control-field">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.id} value={o.id}>{o.label}</option>
        ))}
      </select>
    </div>
  )
}

function MetricRow({ id, label, leftValue, rightValue, leftTone, rightTone }: {
  id: string
  label: string
  leftValue: string
  rightValue: string
  leftTone?: string
  rightTone?: string
}) {
  const lv = parseFloat(leftValue)
  const rv = parseFloat(rightValue)
  const delta = (!isNaN(lv) && !isNaN(rv)) ? lv - rv : null
  const tone = delta !== null ? deltaTone(id, delta) : 'neutral'
  const toneColor = tone === 'good' ? 'var(--tone-good)' : tone === 'watch' ? 'var(--tone-watch)' : 'var(--text-muted)'
  const deltaStr = delta !== null ? `${delta > 0 ? '+' : ''}${delta.toFixed(1)} pts` : '—'

  return (
    <div className="compare-row">
      <div className="compare-row__left">
        <span className="compare-row__value">{leftValue}</span>
        {leftTone && (
          <ToneChip tone={leftTone}>
            {leftTone === 'good' ? 'Good' : leftTone === 'watch' ? 'Watch' : 'Neutral'}
          </ToneChip>
        )}
      </div>
      <div className="compare-row__label">
        <span>{label}</span>
        <span className="compare-row__delta" style={{ color: toneColor }}>{deltaStr}</span>
      </div>
      <div className="compare-row__right">
        <span className="compare-row__value">{rightValue}</span>
        {rightTone && (
          <ToneChip tone={rightTone}>
            {rightTone === 'good' ? 'Good' : rightTone === 'watch' ? 'Watch' : 'Neutral'}
          </ToneChip>
        )}
      </div>
    </div>
  )
}

function ComparePanel({
  title,
  filters,
  options,
  onFiltersChange,
  position,
}: {
  title: string
  filters: PanelFilters
  options: AnyObj
  onFiltersChange: (f: PanelFilters) => void
  position: 'left' | 'right'
}) {
  const { data: overview, isLoading, error } = useQuery({
    queryKey: ['overview-compare', position, filters],
    queryFn: () => fetchOverview(filters),
    retry: 1,
  })

  const ov = (overview ?? {}) as AnyObj
  const metrics = (ov.metrics as AnyObj[]) ?? []
  const geoOptions = (options.geography_options ?? options.benchmark_geographies) as Array<{id: string; label: string; nuts_level?: number}> | undefined
  const countryOptions: { id: string; label: string }[] = geoOptions
    ? geoOptions.filter(g => g.id === 'EU27_AVG' || g.nuts_level === 0).map(g => ({ id: g.id === 'EU27_AVG' ? 'ALL' : g.id, label: g.label }))
    : [{ id: 'ALL', label: 'EU27 average' }]
  const sectorOptions = [{ id: 'ALL', label: 'All sectors' }, ...((options.sectors as { id: string; label: string }[]) ?? []).filter(s => s.id !== 'ALL')]
  const periodOptions = (options.periods as { id: string; label: string }[]) ?? [{ id: 'latest', label: 'Latest' }]

  const errorMsg = error
    ? (axios.isAxiosError(error) ? 'Could not load data for this panel.' : 'Could not load data.')
    : ''

  const appliedFilters = ((ov.filters as AnyObj)?.applied as AnyObj) ?? {}
  const panelHeading = (appliedFilters.geography_label as string)
    || (filters.country === 'ALL' ? 'EU27 Average' : filters.country)

  return (
    <div className="compare-panel">
      <p className="panel__eyebrow">{title}</p>
      <h3 style={{ margin: '4px 0 14px', fontSize: '1rem', color: 'var(--text-strong)', fontWeight: 600 }}>
        {panelHeading}
      </h3>
      <div className="filter-bar" style={{ marginBottom: 16 }}>
        <div className="filter-grid">
          <SelectField
            label="Country"
            value={filters.country}
            options={countryOptions}
            onChange={(v) => onFiltersChange(makeFilters(v, filters.sector, filters.period))}
          />
          <SelectField
            label="Sector"
            value={filters.sector}
            options={sectorOptions}
            onChange={(v) => onFiltersChange({ ...filters, sector: v })}
          />
          <SelectField
            label="Period"
            value={filters.period}
            options={periodOptions}
            onChange={(v) => onFiltersChange({ ...filters, period: v })}
          />
        </div>
      </div>
      <DataState loading={isLoading} error={errorMsg} empty={!isLoading && !errorMsg && metrics.length === 0}>
        <div className="compare-metric-list">
          {metrics.map((m) => (
            <div key={m.id as string} className="compare-metric-item">
              <p className="metric-card__eyebrow">{m.title as string}</p>
              <p className="compare-metric-item__value">{formatValue(m.value, m.unit as string)}</p>
              {Boolean(m.tone) && (
                <ToneChip tone={m.tone as string}>
                  {m.tone === 'good' ? 'Good' : m.tone === 'watch' ? 'Watch' : 'Neutral'}
                </ToneChip>
              )}
            </div>
          ))}
        </div>
      </DataState>
    </div>
  )
}

export function CompareSection() {
  const [searchParams] = useSearchParams()

  const [leftFilters, setLeftFilters] = useState<PanelFilters>(
    makeFilters(searchParams.get('country') ?? 'ALL', searchParams.get('sector') ?? 'ALL', searchParams.get('period') ?? 'latest'),
  )

  const [rightFilters, setRightFilters] = useState<PanelFilters>(
    makeFilters('FR'),
  )

  // Fetch filter options from baseline EU27 call
  const { data: baseOverview } = useQuery({
    queryKey: ['overview-base-options'],
    queryFn: () => fetchOverview(makeFilters('ALL')),
    staleTime: 5 * 60_000,
  })

  const baseOv = (baseOverview ?? {}) as AnyObj
  const options = ((baseOv.filters as AnyObj)?.options as AnyObj) ?? {}

  // Independent data for the side-by-side rows (reuses panel query cache)
  const { data: leftData } = useQuery({
    queryKey: ['overview-compare', 'left', leftFilters],
    queryFn: () => fetchOverview(leftFilters),
    retry: 1,
  })
  const { data: rightData } = useQuery({
    queryKey: ['overview-compare', 'right', rightFilters],
    queryFn: () => fetchOverview(rightFilters),
    retry: 1,
  })

  const leftMetrics = (((leftData ?? {}) as AnyObj).metrics as AnyObj[]) ?? []
  const rightMetrics = (((rightData ?? {}) as AnyObj).metrics as AnyObj[]) ?? []

  const metricRows = leftMetrics.map((lm) => {
    const rm = rightMetrics.find((r) => r.id === lm.id)
    return {
      id: lm.id as string,
      label: lm.title as string,
      leftValue: formatValue(lm.value, lm.unit as string),
      rightValue: rm ? formatValue(rm.value, rm.unit as string) : '—',
      leftTone: lm.tone as string | undefined,
      rightTone: rm?.tone as string | undefined,
    }
  })

  return (
    <div className="dashboard">
      <div className="dashboard__halo dashboard__halo--one" />
      <FreshnessPill />

      <p className="hero__eyebrow" style={{ marginBottom: 16 }}>Compare</p>

      <div className="compare-grid">
        <ComparePanel
          title="Primary view"
          filters={leftFilters}
          options={options}
          onFiltersChange={setLeftFilters}
          position="left"
        />
        <ComparePanel
          title="Comparator"
          filters={rightFilters}
          options={options}
          onFiltersChange={setRightFilters}
          position="right"
        />
      </div>

      {metricRows.length > 0 && (
        <section className="comparison-section" style={{ marginTop: 24 }}>
          <div className="panel" style={{ minHeight: 'auto', padding: 22 }}>
            {(() => {
              const leftLabel = (((leftData ?? {}) as AnyObj).filters as AnyObj | undefined)
                ? String(((((leftData ?? {}) as AnyObj).filters as AnyObj).applied as AnyObj)?.geography_label ?? leftFilters.country)
                : leftFilters.country === 'ALL' ? 'EU27 Average' : leftFilters.country
              const rightLabel = (((rightData ?? {}) as AnyObj).filters as AnyObj | undefined)
                ? String(((((rightData ?? {}) as AnyObj).filters as AnyObj).applied as AnyObj)?.geography_label ?? rightFilters.country)
                : rightFilters.country === 'ALL' ? 'EU27 Average' : rightFilters.country
              const narrative = buildNarrative(metricRows, leftLabel, rightLabel)
              return narrative ? (
                <p style={{ margin: '0 0 18px', fontSize: '0.92rem', color: 'var(--text-strong)', fontWeight: 600, lineHeight: 1.5 }}>
                  {narrative}
                </p>
              ) : null
            })()}
            <p className="panel__eyebrow" style={{ marginBottom: 16 }}>Side-by-side comparison</p>
            <div className="compare-rows">
              {metricRows.map((row) => (
                <MetricRow key={row.id} {...row} />
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
