import { LANDING_FACTS } from '../landingFacts'
import { SectionLabel } from './SectionLabel'

const MAX_GPG = Math.max(...LANDING_FACTS.countrySamples.map((c) => c.financeGpgPct))
const RANKED = [...LANDING_FACTS.countrySamples].sort((a, b) => b.financeGpgPct - a.financeGpgPct)

export function CountryExposureViz() {
  const { research } = LANDING_FACTS

  return (
    <section className="landing-section landing-reveal" aria-labelledby="exposure-viz-title">
      <div className="landing-section__header">
        <SectionLabel>Market exposure</SectionLabel>
        <h2 id="exposure-viz-title">Hiring pressure vs equity risk — finance sector (NACE K)</h2>
        <p className="landing-section__lede">
          n={LANDING_FACTS.countrySamples.length} member states · Eurostat SES · bubble size = gender pay gap
          · EU27 finance average {research.eu27FinanceSectorGapPct}%
        </p>
      </div>

      <div className="landing-exposure-viz">
        <figure className="landing-exposure-viz__scatter" aria-label="Scatter plot of hiring pressure versus equity risk">
          <span className="landing-exposure-viz__axis landing-exposure-viz__axis--y">Equity Risk Score →</span>
          <span className="landing-exposure-viz__axis landing-exposure-viz__axis--x">Hiring Pressure Index →</span>
          <div className="landing-exposure-viz__plot">
            <div className="landing-exposure-viz__grid" aria-hidden="true">
              {[25, 50, 75].map((tick) => (
                <span key={`x-${tick}`} className="landing-exposure-viz__grid-line landing-exposure-viz__grid-line--v" style={{ left: `${tick}%` }} />
              ))}
              {[25, 50, 75].map((tick) => (
                <span key={`y-${tick}`} className="landing-exposure-viz__grid-line landing-exposure-viz__grid-line--h" style={{ bottom: `${tick}%` }} />
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
            Each point is a country. Position = HPI × ERS. Diameter scales with finance-sector gender pay gap.
          </figcaption>
        </figure>

        <div className="landing-exposure-viz__rank">
          <h3>Finance sector gap — ranked</h3>
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
            Eurostat LFS employment rate · gap period as labelled in SES
          </p>
        </div>
      </div>
    </section>
  )
}
