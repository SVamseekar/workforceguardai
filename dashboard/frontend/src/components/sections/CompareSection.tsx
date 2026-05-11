import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import axios from 'axios'
import { FreshnessPill } from '../primitives/FreshnessPill'
import { DataState } from '../shared/DataState'
import { ToneChip } from '../primitives/ToneChip'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api'

type AnyObj = Record<string, unknown>

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
  sector: string
  period: string
}

const DEFAULT_FILTERS: PanelFilters = {
  country: 'ALL',
  sector: 'ALL',
  period: 'latest',
}

async function fetchOverview(filters: PanelFilters): Promise<unknown> {
  const r = await axios.get(`${API_BASE}/overview`, { params: filters })
  return r.data
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
  return (
    <div className="control-field">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.id} value={o.id}>{o.label}</option>
        ))}
      </select>
    </div>
  )
}

function MetricRow({ label, leftValue, rightValue, leftTone, rightTone }: {
  label: string
  leftValue: string
  rightValue: string
  leftTone?: string
  rightTone?: string
}) {
  return (
    <div className="compare-row">
      <div className="compare-row__left">
        <span className="compare-row__value">{leftValue}</span>
        {leftTone && <ToneChip tone={leftTone}>{leftTone === 'good' ? 'Good' : leftTone === 'watch' ? 'Watch' : 'Neutral'}</ToneChip>}
      </div>
      <div className="compare-row__label">{label}</div>
      <div className="compare-row__right">
        <span className="compare-row__value">{rightValue}</span>
        {rightTone && <ToneChip tone={rightTone}>{rightTone === 'good' ? 'Good' : rightTone === 'watch' ? 'Watch' : 'Neutral'}</ToneChip>}
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
  const countryOptions = [{ id: 'ALL', label: 'All countries' }, ...((options.countries as { id: string; label: string }[]) ?? [])]
  const sectorOptions = [{ id: 'ALL', label: 'All sectors' }, ...((options.sectors as { id: string; label: string }[]) ?? [])]
  const periodOptions = (options.periods as { id: string; label: string }[]) ?? [{ id: 'latest', label: 'Latest' }]

  const errorMsg = (() => {
    if (!error) return ''
    if (axios.isAxiosError(error)) return 'Could not load data for this panel.'
    return 'Could not load data.'
  })()

  return (
    <div className="compare-panel">
      <p className="panel__eyebrow">{title}</p>
      <div className="filter-bar" style={{ marginBottom: 16 }}>
        <div className="filter-grid">
          <SelectField
            label="Country"
            value={filters.country}
            options={countryOptions}
            onChange={(v) => onFiltersChange({ ...filters, country: v })}
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
              {Boolean(m.tone) && <ToneChip tone={m.tone as string}>{m.tone === 'good' ? 'Good' : m.tone === 'watch' ? 'Watch' : 'Neutral'}</ToneChip>}
            </div>
          ))}
        </div>
      </DataState>
    </div>
  )
}

export function CompareSection() {
  const [searchParams] = useSearchParams()

  const [leftFilters, setLeftFilters] = useState<PanelFilters>({
    country: searchParams.get('country') ?? 'ALL',
    sector: searchParams.get('sector') ?? 'ALL',
    period: searchParams.get('period') ?? 'latest',
  })

  const [rightFilters, setRightFilters] = useState<PanelFilters>({
    country: DEFAULT_FILTERS.country,
    sector: DEFAULT_FILTERS.sector,
    period: DEFAULT_FILTERS.period,
  })

  // Fetch options from a baseline overview call
  const { data: baseOverview } = useQuery({
    queryKey: ['overview-base-options'],
    queryFn: () => fetchOverview(DEFAULT_FILTERS),
    staleTime: 5 * 60_000,
  })

  const baseOv = (baseOverview ?? {}) as AnyObj
  const options = ((baseOv.filters as AnyObj)?.options as AnyObj) ?? {}

  // Fetch both panels for the side-by-side metric rows
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

  // Build metric rows by matching metric IDs
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
