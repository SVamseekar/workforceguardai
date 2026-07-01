import { BookOpen, Headphones, Rocket, Shield, Upload, Users } from 'lucide-react'
import { SectionLabel } from './SectionLabel'
import { SupportEmailLink } from './SupportEmailLink'
import { useLandingDemo } from '../LandingShell'

const STEPS = [
  {
    icon: Rocket,
    title: 'Request a tailored demo',
    desc: 'We map your reporting countries, worker categories, and Directive timeline — then walk through Pay Analysis and evidence export live.',
  },
  {
    icon: Shield,
    title: 'Provisioned tenant & sign-in',
    desc: 'Organisation access via Google or Microsoft. Payroll data stays tenant-isolated from the public EU reference layer.',
  },
  {
    icon: Upload,
    title: 'Payroll & job architecture upload',
    desc: 'Upload CSV payroll and job architecture files — or we seed a demo scenario with your countries in scope.',
  },
  {
    icon: Users,
    title: 'Team onboarding',
    desc: 'Admin, reviewer, and viewer roles. We help compliance, people analytics, and HR leaders align on review workflows.',
  },
  {
    icon: BookOpen,
    title: 'Methodology briefing',
    desc: 'Optional session on composite indices, Eurostat provenance, and how benchmark confidence gates company-specific claims.',
  },
  {
    icon: Headphones,
    title: 'Ongoing support',
    desc: 'Email us for upload issues, evidence export, or workflow questions. We aim to reply within one business day.',
  },
]

export function OnboardingSupportSection() {
  const { openDemo } = useLandingDemo()

  return (
    <section className="landing-section landing-section--alt landing-reveal">
      <div id="onboarding" className="landing-anchor" tabIndex={-1} />
      <div className="landing-section__header">
        <SectionLabel>Onboarding &amp; support</SectionLabel>
        <h2>From first demo to a compliance-ready workspace</h2>
        <p className="landing-section__lede">
          Enterprise-led onboarding — no self-serve signup. We provision your tenant, guide payroll setup,
          and stay available through your first reporting cycle.
        </p>
      </div>
      <div className="landing-onboarding-grid">
        {STEPS.map(({ icon: Icon, title, desc }) => (
          <article key={title} className="landing-onboarding-card">
            <div className="landing-onboarding-card__icon"><Icon size={20} /></div>
            <h3>{title}</h3>
            <p>{desc}</p>
          </article>
        ))}
      </div>
      <div className="landing-onboarding-cta">
        <button type="button" className="landing-cta landing-cta--primary" onClick={openDemo}>
          Request a demo
        </button>
        <p>
          Questions before booking? Email <SupportEmailLink />
        </p>
      </div>
    </section>
  )
}
