import { AlertTriangle, Calendar } from 'lucide-react'
import { SectionLabel } from './SectionLabel'
import {
  TRANSPOSITION_AS_OF,
  TRANSPOSITION_DEADLINE,
  TRANSPOSITION_ROWS,
  TRANSPOSITION_STATUS_LABELS,
  type TranspositionStatus,
} from '../transpositionData'

const STATUS_CLASS: Record<TranspositionStatus, string> = {
  transposed: 'landing-transposition__status--transposed',
  draft: 'landing-transposition__status--draft',
  delayed: 'landing-transposition__status--delayed',
  none: 'landing-transposition__status--none',
}

export function TranspositionStatusSection() {
  return (
    <section className="landing-section landing-reveal">
      <div id="transposition" className="landing-anchor" tabIndex={-1} />
      <div className="landing-section__header">
        <SectionLabel>Transposition tracker</SectionLabel>
        <h2>Most member states still lack national pay-transparency law</h2>
        <p className="landing-section__lede">
          Directive (EU) 2023/970 must be transposed by{' '}
          <strong>{TRANSPOSITION_DEADLINE}</strong>. Employers in countries without national
          implementation must interpret the EU text directly — WorkforceGuard maps Directive
          obligations even when national guidance is missing.
        </p>
      </div>

      <div className="landing-transposition__meta">
        <div className="landing-transposition__deadline">
          <Calendar size={18} aria-hidden="true" />
          <span>
            Deadline: <strong>{TRANSPOSITION_DEADLINE}</strong>
          </span>
        </div>
        <div className="landing-transposition__warning">
          <AlertTriangle size={18} aria-hidden="true" />
          <span>Snapshot as of {TRANSPOSITION_AS_OF} · illustrative sample of member states</span>
        </div>
      </div>

      <div className="landing-transposition__table-wrap">
        <table className="landing-transposition__table">
          <caption className="sr-only">
            EU member-state transposition status for Directive (EU) 2023/970
          </caption>
          <thead>
            <tr>
              <th scope="col">Member state</th>
              <th scope="col">Status</th>
              <th scope="col">Notes</th>
            </tr>
          </thead>
          <tbody>
            {TRANSPOSITION_ROWS.map((row) => (
              <tr key={row.code}>
                <td>
                  <span className="landing-transposition__country">{row.country}</span>
                  <span className="landing-transposition__code">{row.code}</span>
                </td>
                <td>
                  <span
                    className={`landing-transposition__status ${STATUS_CLASS[row.status]}`}
                  >
                    {TRANSPOSITION_STATUS_LABELS[row.status]}
                  </span>
                </td>
                <td>{row.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
