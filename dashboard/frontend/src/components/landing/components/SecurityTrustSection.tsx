import { Database, Lock, Shield, Users } from 'lucide-react'
import { SectionLabel } from './SectionLabel'

const TRUST_ITEMS = [
  {
    icon: Shield,
    title: 'GDPR-aligned processing',
    detail:
      'Demo and sign-in data processed under documented retention policies. Payroll stays in your provisioned tenant layer.',
  },
  {
    icon: Users,
    title: 'Tenant isolation',
    detail:
      'Company payroll and governance events are scoped per organisation — separate from public Eurostat benchmarks.',
  },
  {
    icon: Lock,
    title: 'Encryption in transit',
    detail:
      'HTTPS for all public and API traffic. Session cookies are HttpOnly with SameSite protection.',
  },
  {
    icon: Database,
    title: 'SHA-256 governance chain',
    detail:
      'Approve, override, and export actions append to a hash-chained audit log for regulator-ready evidence packs.',
  },
] as const

export function SecurityTrustSection() {
  return (
    <section className="landing-section landing-section--alt landing-reveal">
      <div id="security" className="landing-anchor" tabIndex={-1} />
      <div className="landing-section__header">
        <SectionLabel>Security & trust</SectionLabel>
        <h2>Built for sensitive payroll and compliance workflows</h2>
        <p className="landing-section__lede">
          WorkforceGuard is designed for HR and compliance teams handling gender pay gap review —
          with tenant isolation, audit trails, and transparent methodology.
        </p>
      </div>
      <div className="landing-trust-grid">
        {TRUST_ITEMS.map((item) => (
          <article key={item.title} className="landing-trust-card">
            <div className="landing-trust-card__icon" aria-hidden="true">
              <item.icon size={20} />
            </div>
            <h3>{item.title}</h3>
            <p>{item.detail}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
