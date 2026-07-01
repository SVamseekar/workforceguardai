import { Headphones, Rocket, Shield } from 'lucide-react'
import { SectionLabel } from './SectionLabel'
import { useLandingDemo } from '../LandingShell'

const STEPS = [
  {
    icon: Rocket,
    title: 'Request a demo',
    desc: 'We walk through your reporting obligations, payroll countries in scope, and team setup.',
  },
  {
    icon: Shield,
    title: 'Provisioned tenant',
    desc: 'Organisation sign-in via Google or Microsoft. Payroll layer stays separated from EU reference data.',
  },
  {
    icon: Headphones,
    title: 'Ongoing support',
    desc: 'We reply within one business day on compliance workflows, uploads, and evidence export.',
  },
]

export function GettingStartedSection() {
  const { openDemo } = useLandingDemo()

  return (
    <section id="getting-started" className="landing-section landing-reveal">
      <div className="landing-section__header">
        <SectionLabel>Getting started</SectionLabel>
        <h2>From first demo to compliance-ready workspace</h2>
      </div>
      <div className="landing-getting-started">
        {STEPS.map(({ icon: Icon, title, desc }) => (
          <article key={title} className="landing-getting-started__card">
            <div className="landing-getting-started__icon"><Icon size={22} /></div>
            <h3>{title}</h3>
            <p>{desc}</p>
          </article>
        ))}
      </div>
      <div className="landing-getting-started__cta">
        <button type="button" className="landing-cta landing-cta--secondary" onClick={openDemo}>
          Request a demo
        </button>
      </div>
    </section>
  )
}
