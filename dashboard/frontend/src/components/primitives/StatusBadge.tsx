const STATUS_LABELS = {
  'internal mart active': 'Company data connected',
  'internal mart inactive': 'No company data loaded',
  'external-only answers': 'Market data only',
  'observed_gap': 'Pay gap identified',
  'unresolved_review_item': 'Needs review',
  'justified_difference': 'Documented difference',
  blended: 'Evidence source: Combined',
  internal: 'Evidence source: Company data',
  external: 'Evidence source: Market data',
  partial: 'Partial market data',
  full: 'Full market data',
  proxy: 'Estimated benchmark',
  official: 'Verified benchmark',
  high: 'High confidence',
  low: 'Limited data — treat with caution',
}

export function StatusBadge({ status, className = '' }) {
  const label = STATUS_LABELS[status] ?? status
  return <span className={`comparison-meta__pill ${className}`}>{label}</span>
}
