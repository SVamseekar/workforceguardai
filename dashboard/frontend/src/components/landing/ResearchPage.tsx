import { Link } from 'react-router-dom'
import { GitCompare } from 'lucide-react'
import { LandingShell } from './LandingShell'
import { MarketingPage } from './MarketingPage'
import { countrySample, LANDING_FACTS } from './landingFacts'
import { RESEARCH_PAPER_LABEL, RESEARCH_PAPER_URL } from './site'

const { market, research } = LANDING_FACTS

const TITLE = 'Research — WorkforceGuard AI'
const DESCRIPTION =
  'Tight labour markets have not closed gender pay gaps: evidence from a 27-country Eurostat panel.'

export function ResearchPage() {
  return (
    <LandingShell>
      <MarketingPage
        title={TITLE}
        description={DESCRIPTION}
        path="/research"
        eyebrow="Research-backed"
        heading="Tight labour markets have not closed gender pay gaps"
        lede={`Eurostat panel of ${research.panelCountries} countries and ${research.panelSectors} sectors (${market.yearRange}). Employment rate and gender pay gap correlate positively (r ≈ ${research.employmentGapCorrelation}).`}
      >
        <section className="landing-section landing-reveal">
          <div className="landing-research">
            <div className="landing-research__copy">
              <p>
                The five tightest labour markets in the sample all record gaps above the EU27 average of{' '}
                {research.eu27UnadjustedGapPct}%.
              </p>
              <p>
                WorkforceGuard implements the same composite indices cited in our{' '}
                <a href={RESEARCH_PAPER_URL} target="_blank" rel="noopener noreferrer">
                  {RESEARCH_PAPER_LABEL}
                </a>{' '}
                preprint — Hiring Pressure, Labour Resilience, Equity Risk, and Transition Readiness
                (in-development proxy, see <Link to="/disclaimer">disclaimer</Link>).
              </p>
            </div>
            <div className="landing-research__panel">
              <div className="landing-research__quadrant" aria-hidden="true">
                <span className="landing-research__axis landing-research__axis--y">Equity Risk</span>
                <span className="landing-research__axis landing-research__axis--x">Hiring Pressure</span>
                <span className="landing-research__dot landing-research__dot--a" />
                <span className="landing-research__dot landing-research__dot--b" />
                <span className="landing-research__dot landing-research__dot--c" />
                <span className="landing-research__zone">High exposure zone</span>
              </div>
              <GitCompare size={18} />
              <h3>Combined Risk Quadrant</h3>
              <p>
                Hungary finance gap {countrySample('HU').financeGpgPct}% (HPI {countrySample('HU').hpi}),
                Germany {countrySample('DE').financeGpgPct}% (ERS {countrySample('DE').ers}), Italy ERS{' '}
                {countrySample('IT').ers} — tight markets do not guarantee low equity risk.
              </p>
              <Link to="/app/compare" className="landing-cta landing-cta--secondary">
                Explore the comparison
              </Link>
            </div>
          </div>
        </section>
      </MarketingPage>
    </LandingShell>
  )
}
