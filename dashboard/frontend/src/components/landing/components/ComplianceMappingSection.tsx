import { SectionLabel } from './SectionLabel'

const COMPLIANCE_MAP = [
  {
    requirement: 'Gender pay gap by worker category',
    feature: 'Heat by the groups you mapped',
    limit: 'You define equal-value categories. We do not invent them.',
  },
  {
    requirement: '5% unexplained gap → joint pay assessment',
    feature: '5% and 10% unadjusted heat flags',
    limit: 'Unadjusted is not unexplained. We never label a gap as justified.',
  },
  {
    requirement: 'Objective, gender-neutral justification',
    feature: 'Approve / override / reverse log',
    limit: 'Humans record a reason. The calculator does not write the justification.',
  },
  {
    requirement: 'Information for workers and representatives',
    feature: 'Not generated as a legal notice',
    limit: 'Export is evidence for reviewers, not a statutory communication.',
  },
  {
    requirement: 'Comparable market context',
    feature: 'Sector-matched Eurostat benchmark, country fallback',
    limit: 'A market outlier is a flag, not a defence.',
  },
  {
    requirement: 'A compliance certificate or filing',
    feature: 'Not in the product',
    limit: 'No output says you are or are not compliant.',
  },
] as const

export function ComplianceMappingSection() {
  return (
    <section className="landing-section landing-section--alt landing-reveal">
      <div id="compliance" className="landing-anchor" tabIndex={-1} />
      <div className="landing-section__header">
        <SectionLabel>Directive mapping</SectionLabel>
        <h2>What we calculate vs what only counsel decides</h2>
        <p className="landing-section__lede">
          Heat is a review map. National transposition and equal-value mapping sit with you and your lawyers.
        </p>
      </div>
      <div className="landing-compliance-grid landing-compliance-grid--compact">
        {COMPLIANCE_MAP.map((item) => (
          <article key={item.requirement} className="landing-compliance-card landing-compliance-card--compact">
            <p className="landing-compliance-card__requirement">{item.requirement}</p>
            <div className="landing-compliance-card__feature">
              <div className="landing-compliance-card__tag">
                <span>{item.feature}</span>
              </div>
              <p className="landing-compliance-card__limit">{item.limit}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
