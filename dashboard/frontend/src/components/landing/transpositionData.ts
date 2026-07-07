/** Static seed from docs/paper-insights.md §10 (May 2026 desk research). */
export const TRANSPOSITION_DEADLINE = '7 June 2026'
export const TRANSPOSITION_AS_OF = 'May 2026'

export type TranspositionStatus = 'transposed' | 'draft' | 'delayed' | 'none'

export type TranspositionRow = {
  country: string
  code: string
  status: TranspositionStatus
  note: string
}

export const TRANSPOSITION_STATUS_LABELS: Record<TranspositionStatus, string> = {
  transposed: 'Transposed',
  draft: 'Draft only',
  delayed: 'Delayed',
  none: 'No draft',
}

export const TRANSPOSITION_ROWS: TranspositionRow[] = [
  {
    country: 'Belgium (Wallonia-Brussels)',
    code: 'BE',
    status: 'transposed',
    note: 'Partial transposition · Sep 2024',
  },
  { country: 'Malta', code: 'MT', status: 'draft', note: 'Draft legislation published' },
  { country: 'Slovakia', code: 'SK', status: 'draft', note: 'Draft legislation published' },
  { country: 'Finland', code: 'FI', status: 'draft', note: 'Draft legislation published' },
  { country: 'Poland', code: 'PL', status: 'draft', note: 'Draft legislation published' },
  { country: 'Cyprus', code: 'CY', status: 'draft', note: 'Draft legislation published' },
  {
    country: 'Netherlands',
    code: 'NL',
    status: 'delayed',
    note: 'Missed Jun 2026 deadline · target Jan 2027',
  },
  { country: 'Bulgaria', code: 'BG', status: 'none', note: 'No draft legislation yet' },
  { country: 'Slovenia', code: 'SI', status: 'none', note: 'No draft legislation yet' },
  { country: 'Germany', code: 'DE', status: 'draft', note: 'Federal draft in progress' },
  { country: 'France', code: 'FR', status: 'draft', note: 'Draft under parliamentary review' },
  { country: 'Ireland', code: 'IE', status: 'draft', note: 'Draft legislation published' },
]
