import { CheckCircle2, ChevronRight } from 'lucide-react'
import { SectionLabel } from './SectionLabel'

const COMPLIANCE_MAP = [
  { requirement: 'Gender pay gap reporting by worker category', feature: 'Pay Transparency Review' },
  { requirement: 'Joint pay assessment above 5%', feature: 'Threshold flagging' },
  { requirement: 'Objective, gender-neutral justification', feature: 'Approve / override / reverse' },
  { requirement: 'Audit trail for regulators', feature: 'Governance log' },
  { requirement: 'Comparable employer benchmarking', feature: 'Compare' },
  { requirement: 'Regulatory evidence pack', feature: 'Evidence export' },
] as const

export function ComplianceMappingSection() {
  return (
    <section className="landing-section landing-section--alt landing-reveal">
      <div id="compliance" className="landing-anchor" tabIndex={-1} />
      <div className="landing-section__header">
        <SectionLabel>Compliance mapping</SectionLabel>
        <h2>Directive obligations → platform modules</h2>
        <p className="landing-section__lede">
          Each obligation routes to a concrete workflow in the product tour above — not a generic HR checkbox.
        </p>
      </div>
      <div className="landing-compliance-grid landing-compliance-grid--compact">
        {COMPLIANCE_MAP.map((item) => (
          <article key={item.requirement} className="landing-compliance-card landing-compliance-card--compact">
            <p className="landing-compliance-card__requirement">{item.requirement}</p>
            <div className="landing-compliance-card__arrow" aria-hidden="true">
              <ChevronRight size={16} />
            </div>
            <div className="landing-compliance-card__feature">
              <div className="landing-compliance-card__tag">
                <CheckCircle2 size={14} />
                <span>{item.feature}</span>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
