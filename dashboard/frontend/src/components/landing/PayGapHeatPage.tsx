import { Link } from 'react-router-dom'
import { LandingShell, useLandingDemo } from './LandingShell'
import { MarketingPage } from './MarketingPage'

const TITLE = 'Pay-gap heat — WorkforceGuard AI'
const DESCRIPTION =
  'Hourly gender pay-gap heat by worker category: mean and median, variable pay, quartiles, small-n suppression. Review flags, not a legal verdict.'

const STATES = [
  { label: 'Too few people to report', rule: 'Fewer than 5 women or 5 men in the category. The gap is withheld.' },
  { label: 'Below 5% trigger', rule: 'Unadjusted mean hourly gap is under 5%. That is not a legal justification.' },
  { label: 'Pay gap identified', rule: 'Unadjusted mean hourly gap is at least 5% and under 10%.' },
  { label: 'Needs review', rule: 'Unadjusted mean hourly gap is at least 10%.' },
]

const COMPUTES = [
  'Hourly conversion from annual, monthly, or hourly pay (default 40 hours/week is flagged as assumed).',
  'Mean and median gaps on total hourly pay, base pay, and variable pay.',
  'Share of women and men receiving variable pay.',
  'Female share of each pay quartile.',
  'Sector-letter Eurostat market comparator, with country all-sector fallback.',
]

const DOES_NOT = [
  'Map work of equal value — you assign job codes to worker categories.',
  'Decide whether a gap is unexplained. Unadjusted is not unexplained.',
  'Say the employer is or is not Directive-compliant.',
  'Produce a statutory worker notice or a national filing.',
]

export function PayGapHeatPage() {
  const { openDemo } = useLandingDemo()

  return (
    <LandingShell>
      <MarketingPage
        title={TITLE}
        description={DESCRIPTION}
        path="/pay-gap-heat"
        eyebrow="Pay-gap heat"
        heading="A first look at where pay gaps sit — for a person to review"
        lede="Upload job architecture, then payroll. We convert to hourly pay, suppress small cells, and flag categories. Counsel in the member state decides what the heat means in law."
      >
        <section className="landing-section landing-reveal">
          <div className="landing-section__header landing-section__header--left">
            <h2>What we compute</h2>
            <p className="landing-section__lede">
              Aligned with the spirit of Directive (EU) 2023/970 Article 9 indicators, computed in SQL
              and Python — not by an LLM.
            </p>
          </div>
          <ul className="landing-heat-list">
            {COMPUTES.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="landing-section landing-section--alt landing-reveal">
          <div className="landing-section__header landing-section__header--left">
            <h2>Review labels</h2>
            <p className="landing-section__lede">
              Labels describe the unadjusted hourly gap. They never read as “justified”.
            </p>
          </div>
          <div className="landing-hub">
            {STATES.map((state) => (
              <article key={state.label} className="landing-hub__card landing-hub__card--static">
                <h3>{state.label}</h3>
                <p>{state.rule}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-section landing-reveal">
          <div className="landing-section__header landing-section__header--left">
            <h2>What we do not do</h2>
          </div>
          <ul className="landing-heat-list">
            {DOES_NOT.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="landing-section__lede" style={{ marginTop: 24 }}>
            Templates:{' '}
            <a href="/templates/job_architecture_upload_template.csv" download>
              job architecture
            </a>
            {' · '}
            <a href="/templates/payroll_upload_template.csv" download>
              payroll
            </a>
            . Required payroll fields include employee id, job code, country, worker category, gender,
            base pay, and snapshot date. Hours, pay frequency, and variable pay improve the heat.
          </p>
          <div className="landing-cta-section__actions" style={{ marginTop: 28 }}>
            <button type="button" className="landing-cta landing-cta--primary" onClick={openDemo}>
              Request a walkthrough
            </button>
            <Link to="/directive" className="landing-cta landing-cta--ghost">
              What the Directive asks
            </Link>
          </div>
        </section>
      </MarketingPage>
    </LandingShell>
  )
}
