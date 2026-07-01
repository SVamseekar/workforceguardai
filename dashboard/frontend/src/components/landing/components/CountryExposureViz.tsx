import { ChevronRight } from 'lucide-react'
import { MARKET_INTELLIGENCE_SCOPE } from '../constants'
import { LANDING_FACTS } from '../landingFacts'
import { SectionLabel } from './SectionLabel'

const MAX_GPG = Math.max(...LANDING_FACTS.countrySamples.map((c) => c.financeGpgPct))
const RANKED = [...LANDING_FACTS.countrySamples].sort((a, b) => b.financeGpgPct - a.financeGpgPct)
const { market, research } = LANDING_FACTS

export function CountryExposureViz() {
  return (
    <section className="landing-section landing-reveal" aria-labelledby="exposure-viz-title">
      <div className="landing-section__header">
        <SectionLabel>Live example</SectionLabel>
        <h2 id="exposure-viz-title">Market Intelligence — hiring pressure vs equity risk</h2>
        <p className="landing-section__lede">
          A slice of what the dashboard does today: composite indices and gender pay gaps from live
          Eurostat data. This panel shows finance (NACE K) across {LANDING_FACTS.countrySamples.length}{' '}
          member states — the full product covers all {market.euMemberStates} states,{' '}
          {market.naceSectors} NACE sectors, and {market.yearRange}.
        </p>
      </div>

      <div className="landing-exposure-viz">
        <div className="landing-exposure-viz__dashboard">
          <figure
            className="landing-exposure-viz__panel landing-exposure-viz__scatter"
            aria-label="Scatter plot of hiring pressure versus equity risk"
          >
            <div className="landing-exposure-viz__panel-head">
              <span className="landing-exposure-viz__panel-title">Exposure quadrant</span>
              <span className="landing-exposure-viz__panel-meta">
                n={LANDING_FACTS.countrySamples.length} · EU27 avg {research.eu27FinanceSectorGapPct}%
              </span>
            </div>
            <span className="landing-exposure-viz__axis landing-exposure-viz__axis--y">Equity Risk Score →</span>
            <span className="landing-exposure-viz__axis landing-exposure-viz__axis--x">Hiring Pressure Index →</span>
            <div className="landing-exposure-viz__plot">
              <div className="landing-exposure-viz__grid" aria-hidden="true">
                {[25, 50, 75].map((tick) => (
                  <span
                    key={`x-${tick}`}
                    className="landing-exposure-viz__grid-line landing-exposure-viz__grid-line--v"
                    style={{ left: `${tick}%` }}
                  />
                ))}
                {[25, 50, 75].map((tick) => (
                  <span
                    key={`y-${tick}`}
                    className="landing-exposure-viz__grid-line landing-exposure-viz__grid-line--h"
                    style={{ bottom: `${tick}%` }}
                  />
                ))}
                <span className="landing-exposure-viz__zone">High exposure</span>
              </div>
              {LANDING_FACTS.countrySamples.map((country) => {
                const size = 10 + (country.financeGpgPct / MAX_GPG) * 22
                return (
                  <span
                    key={country.code}
                    className="landing-exposure-viz__point"
                    style={{
                      left: `${country.hpi}%`,
                      bottom: `${country.ers}%`,
                      width: `${size}px`,
                      height: `${size}px`,
                    }}
                    title={`${country.name}: finance gap ${country.financeGpgPct}%, HPI ${country.hpi}, ERS ${country.ers}, employment ${country.employmentRatePct}%`}
                  >
                    <span className="landing-exposure-viz__point-label">{country.code}</span>
                  </span>
                )
              })}
            </div>
            <figcaption className="landing-exposure-viz__caption">
              Bubble size = finance-sector gender pay gap. Position = HPI × ERS.
            </figcaption>
          </figure>

          <aside className="landing-exposure-viz__panel landing-exposure-viz__rank">
            <div className="landing-exposure-viz__panel-head">
              <span className="landing-exposure-viz__panel-title">Finance sector gap — ranked</span>
              <span className="landing-exposure-viz__panel-meta">Eurostat SES · NACE K</span>
            </div>
            <ol className="landing-exposure-viz__bars">
              {RANKED.map((country) => (
                <li key={country.code}>
                  <span className="landing-exposure-viz__bar-label">
                    <span className="landing-exposure-viz__bar-code">{country.code}</span>
                    {country.name}
                  </span>
                  <div className="landing-exposure-viz__bar-track" aria-hidden="true">
                    <span
                      className="landing-exposure-viz__bar-fill"
                      style={{ width: `${(country.financeGpgPct / MAX_GPG) * 100}%` }}
                    />
                  </div>
                  <span className="landing-exposure-viz__bar-meta">
                    <span className="landing-exposure-viz__bar-value">{country.financeGpgPct}%</span>
                    <span className="landing-exposure-viz__bar-emp">emp {country.employmentRatePct}%</span>
                  </span>
                </li>
              ))}
            </ol>
            <p className="landing-exposure-viz__footnote">
              Employment from Eurostat LFS · gap period as labelled in SES
            </p>
          </aside>
        </div>

        <div className="landing-exposure-viz__scope">
          <p className="landing-exposure-viz__scope-lead">
            This is one Market Intelligence view. WorkforceGuard also includes:
          </p>
          <ul className="landing-exposure-viz__scope-list">
            {MARKET_INTELLIGENCE_SCOPE.map((item) => (
              <li
                key={item.label}
                className={`landing-exposure-viz__scope-item${'active' in item && item.active ? ' is-active' : ''}`}
              >
                <span className="landing-exposure-viz__scope-label">{item.label}</span>
                <span className="landing-exposure-viz__scope-detail">{item.detail}</span>
              </li>
            ))}
          </ul>
          <a href="#product-tour" className="landing-cta landing-cta--ghost landing-exposure-viz__scope-cta">
            Explore all modules <ChevronRight size={14} />
          </a>
        </div>
      </div>
    </section>
  )
}
