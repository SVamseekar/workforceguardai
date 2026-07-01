import { LIVE_PROOF_STATS } from '../landingFacts'

export function LiveProofBand() {
  return (
    <section className="landing-stats-band landing-reveal" aria-label="Key market and compliance figures">
      <div className="landing-stats-band__inner">
        {LIVE_PROOF_STATS.map((stat) => (
          <div key={stat.label} className="landing-stat">
            <span className="landing-stat__value">{stat.value}</span>
            <span className="landing-stat__label">{stat.label}</span>
            <span className="landing-stat__detail">{stat.detail}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
