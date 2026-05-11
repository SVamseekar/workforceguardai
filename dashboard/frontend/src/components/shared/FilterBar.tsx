import type { ReactNode } from 'react'
import type { Filters } from '../../hooks/useOverviewData'

type SelectOption = { id?: string; label?: string } | string

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: SelectOption[]; onChange: (v: string) => void }) {
  const id = `filter-${label.toLowerCase().replace(/\s+/g, '-')}`
  return (
    <div className="control-field">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((opt) => (
          <option key={typeof opt === 'string' ? opt : (opt.id ?? '')} value={typeof opt === 'string' ? opt : (opt.id ?? '')}>
            {typeof opt === 'string' ? opt : (opt.label ?? opt.id ?? '')}
          </option>
        ))}
      </select>
    </div>
  )
}

export function FilterBar({ filters, options, onFilterChange, onAnalyse, children }: { filters: Filters; options: Record<string, unknown>; onFilterChange: (f: Filters) => void; onAnalyse?: () => void; children?: ReactNode }) {
  // Support both old key names (countries/sectors/periods) and backend key names (country_options/sector_options/period_options)
  const rawCountries = (options?.countries ?? options?.country_options) as SelectOption[] | undefined
  const rawSectors = (options?.sectors ?? options?.sector_options) as SelectOption[] | undefined
  const rawPeriods = (options?.periods ?? options?.period_options) as SelectOption[] | undefined
  const rawBenchmarks = (options?.benchmark_geographies ?? options?.geography_options) as SelectOption[] | undefined

  const countryOptions = rawCountries?.length ? rawCountries : [{ id: 'ALL', label: 'All countries' }]
  const sectorOptions = rawSectors?.length ? rawSectors : [{ id: 'ALL', label: 'All sectors' }]
  const periodOptions = rawPeriods ?? []
  const benchmarkOptions = rawBenchmarks ?? []

  return (
    <div className="filter-bar">
      <div className="filter-grid">
        <SelectField
          label="Country"
          value={filters.country}
          options={countryOptions}
          onChange={(v) => onFilterChange({ ...filters, country: v })}
        />
        <SelectField
          label="Sector"
          value={filters.sector}
          options={sectorOptions}
          onChange={(v) => onFilterChange({ ...filters, sector: v })}
        />
        <SelectField
          label="Period"
          value={filters.period}
          options={periodOptions}
          onChange={(v) => onFilterChange({ ...filters, period: v })}
        />
        {benchmarkOptions.length > 0 && (
          <SelectField
            label="Compare against"
            value={filters.benchmark_geography}
            options={benchmarkOptions}
            onChange={(v) => onFilterChange({ ...filters, benchmark_geography: v })}
          />
        )}
      </div>
      {children}
      {onAnalyse && (
        <div className="filter-bar__actions">
          <button className="filter-bar__button" onClick={onAnalyse}>
            Run Analysis
          </button>
        </div>
      )}
    </div>
  )
}
