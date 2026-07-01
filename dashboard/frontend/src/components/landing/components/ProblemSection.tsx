import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { SectionLabel } from './SectionLabel'

const CHAOS = [
  'Eurostat tables reconciled by hand',
  'Pay gaps in spreadsheets, no audit trail',
  'Legal asks for evidence the HRIS cannot produce',
]

const SOLUTION = [
  'Live EU27 benchmarks with provenance',
  'Payroll-aware review with threshold flagging',
  'Hash-chained governance log and export',
]

export function ProblemSection() {
  return (
    <section id="problem" className="landing-section landing-section--alt landing-reveal">
      <div className="landing-section__header">
        <SectionLabel>The problem</SectionLabel>
        <h2>Pay transparency is a legal obligation — not a spreadsheet exercise</h2>
        <p className="landing-section__lede">
          Directive (EU) 2023/970 demands measurable gaps, justified differences, and retained evidence.
          Most employers are not ready.
        </p>
      </div>

      <div className="landing-problem-grid">
        <div className="landing-problem-card landing-problem-card--chaos">
          <h3><AlertTriangle size={18} /> The old way</h3>
          <ul>
            {CHAOS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div className="landing-problem-card landing-problem-card--solution">
          <h3><CheckCircle2 size={18} /> With WorkforceGuard</h3>
          <ul>
            {SOLUTION.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
