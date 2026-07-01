import { WORKFLOW_STEPS } from '../constants'
import { SectionLabel } from './SectionLabel'

export function ComplianceWorkflowStory() {
  return (
    <section id="workflow" className="landing-section landing-section--alt landing-reveal">
      <div className="landing-section__header">
        <SectionLabel>How it works</SectionLabel>
        <h2>From payroll upload to regulator-ready evidence</h2>
      </div>
      <ol className="landing-workflow">
        {WORKFLOW_STEPS.map((step) => (
          <li key={step.title} className="landing-workflow__step">
            <span className="landing-workflow__time">{step.time}</span>
            <h3>{step.title}</h3>
            <p>{step.body}</p>
            <span className="landing-workflow__action">{step.action}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}
