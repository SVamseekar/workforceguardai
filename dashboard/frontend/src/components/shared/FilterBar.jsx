function SelectField({ label, value, options, onChange }) {
  return (
    <div className="control-field">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((opt) => (
          <option key={opt.id ?? opt} value={opt.id ?? opt}>
            {opt.label ?? opt}
          </option>
        ))}
      </select>
    </div>
  )
}

export function FilterBar({ filters, options, onFilterChange, onAnalyse, children }) {
  const countryOptions = [{ id: 'ALL', label: 'All countries' }, ...(options?.countries ?? [])]
  const sectorOptions = [{ id: 'ALL', label: 'All sectors' }, ...(options?.sectors ?? [])]
  const periodOptions = options?.periods ?? []
  const benchmarkOptions = options?.benchmark_geographies ?? []

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
