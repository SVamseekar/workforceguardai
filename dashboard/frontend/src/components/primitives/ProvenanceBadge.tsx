const SOURCE_LABELS: Record<string, string> = {
  eurostat_lfs: 'Eurostat Labour Force Survey',
  eurostat_jvs: 'Eurostat Job Vacancy Survey',
  eurostat_ses: 'Eurostat Structure of Earnings Survey',
  internal_payroll: 'Company payroll data',
  internal_hris: 'Company HR system',
  egapro: 'France Égapro index',
}

export function ProvenanceBadge({ provenance, compact = false }: { provenance: Array<{ source_id: string }>; compact?: boolean }) {
  if (!provenance?.length) return null
  return (
    <div className={`provenance-badge${compact ? ' provenance-badge--compact' : ''}`}>
      {provenance.map((p) => (
        <span key={p.source_id}>
          {SOURCE_LABELS[p.source_id] ?? p.source_id}
        </span>
      ))}
    </div>
  )
}
