import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { LANDING_FACTS } from '../landingFacts'
import { SectionLabel } from './SectionLabel'

const CHAOS = [
  'Eurostat tables reconciled manually across member states',
  'Gaps computed in spreadsheets with no versioned methodology',
  'Joint pay assessment triggers discovered after leadership sign-off',
  'No defensible audit trail when regulators ask for proof',
]

const SOLUTION = [
  'dbt-modeled EU reference layer with provenance on every metric',
  'Tenant-isolated payroll blended against market benchmarks',
  'Category review with configurable 5% / 10% thresholds',
  'SHA-256 hash-chained governance log verified on every API call',
]

const TIMELINE = [
  { when: LANDING_FACTS.directive.transpositionLabel, what: 'Member-state transposition for Directive (EU) 2023/970' },
  { when: LANDING_FACTS.directive.firstReportingLabel, what: 'First annual reporting for employers with 250+ workers' },
  { when: 'Jun 2031', what: 'Reporting extends to employers with 100–149 workers (every three years)' },
] as const

export function ProblemSection() {
  const { research } = LANDING_FACTS

  return (
    <section className="landing-section landing-section--alt landing-reveal">
      <div id="problem" className="landing-anchor" tabIndex={-1} />
      <div className="landing-section__header">
        <SectionLabel>The problem</SectionLabel>
        <h2>Pay transparency is a legal obligation — not a spreadsheet exercise</h2>
        <p className="landing-section__lede">
          Directive (EU) 2023/970 requires category-level measurement, objective justification, and
          retrievable evidence. Our Eurostat panel shows why competitive labour markets alone have not
          closed gaps: employment rate and gender pay gap correlate positively (r ≈{' '}
          {research.employmentGapCorrelation}) across {research.panelCountries} countries — Czechia
          records {research.czAllSectorGapPct}% overall while finance (NACE K) reaches{' '}
          {research.czFinanceSectorGapPct2023}% in Eurostat SES 2023.
        </p>
      </div>

      <ol className="landing-problem-timeline">
        {TIMELINE.map(({ when, what }) => (
          <li key={when}>
            <span className="landing-problem-timeline__when">{when}</span>
            <span className="landing-problem-timeline__what">{what}</span>
          </li>
        ))}
      </ol>

      <div className="landing-problem-grid">
        <div className="landing-problem-card landing-problem-card--chaos">
          <h3><AlertTriangle size={18} /> The old way</h3>
          <p className="landing-problem-card__intro">
            Compliance teams inherit fragmented tools. When the regulator asks for proof, reconstruction
            takes weeks.
          </p>
          <ul>
            {CHAOS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div className="landing-problem-card landing-problem-card--solution">
          <h3><CheckCircle2 size={18} /> With WorkforceGuard</h3>
          <p className="landing-problem-card__intro">
            One DuckDB + dbt pipeline connects Eurostat intelligence, uploaded payroll, review
            workflows, and a tamper-evident governance log.
          </p>
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
