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
  'Live EU benchmarks with provenance on every metric',
  'Payroll kept separate from public market data until you benchmark',
  'Category review with 5% and 10% threshold flagging',
  'Tamper-evident governance log for every compliance decision',
]

const TIMELINE = [
  { when: LANDING_FACTS.directive.transpositionLabel, what: 'Member-state transposition for Directive (EU) 2023/970' },
  { when: LANDING_FACTS.directive.firstReportingLabel, what: 'First annual reporting for employers with 250+ workers' },
  { when: 'Jun 2031', what: 'Reporting extends to employers with 100–149 workers (every three years)' },
] as const

const INSIGHTS = [
  {
    value: `+${LANDING_FACTS.research.employmentGapCorrelation}`,
    label: 'Employment–gap correlation',
    detail: `Pearson r across ${LANDING_FACTS.research.panelCountries} countries — stronger labour markets do not mean smaller gaps.`,
  },
  {
    value: `${LANDING_FACTS.research.eu27FinanceSectorGapPct}%`,
    label: 'EU27 finance sector (NACE K)',
    detail: `More than 2× the ${LANDING_FACTS.research.eu27UnadjustedGapPct}% all-sector EU27 average (Eurostat SES).`,
  },
  {
    value: LANDING_FACTS.directive.transpositionLabel,
    label: 'Transposition deadline',
    detail: 'Category-level reporting, justification, and evidence retention become enforceable.',
  },
] as const

export function ProblemSection() {
  return (
    <section className="landing-section landing-section--alt landing-reveal">
      <div id="problem" className="landing-anchor" tabIndex={-1} />
      <div className="landing-section__header">
        <SectionLabel>The problem</SectionLabel>
        <h2>Pay transparency is a legal obligation — not a spreadsheet exercise</h2>
        <p className="landing-section__lede">
          Directive (EU) 2023/970 requires measurable, defensible pay equity evidence — not narrative
          assurance. The labour-market data says why that matters.
        </p>
      </div>

      <div className="landing-problem-insights">
        {INSIGHTS.map((item) => (
          <article key={item.label} className="landing-problem-insight">
            <span className="landing-problem-insight__value">{item.value}</span>
            <span className="landing-problem-insight__label">{item.label}</span>
            <p>{item.detail}</p>
          </article>
        ))}
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
            One workspace connects Eurostat intelligence, uploaded payroll, review workflows, and an
            audit-ready evidence trail.
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
