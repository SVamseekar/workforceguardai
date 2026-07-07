import { BookOpen, Building2, Database } from 'lucide-react'
import { RESEARCH_PAPER_LABEL } from '../site'

const PROOF_ITEMS = [
  {
    icon: BookOpen,
    label: 'Published research',
    detail: RESEARCH_PAPER_LABEL,
  },
  {
    icon: Database,
    label: 'Eurostat-backed benchmarks',
    detail: '16 datasets · 27 EU member states',
  },
  {
    icon: Building2,
    label: 'Provisioned enterprise pilots',
    detail: 'HR & compliance teams preparing for Jun 2027 reporting',
  },
] as const

export function PartnerProofStrip() {
  return (
    <section className="landing-proof-strip landing-reveal" aria-label="Research and deployment proof">
      <div className="landing-proof-strip__inner">
        {PROOF_ITEMS.map((item) => (
          <article key={item.label} className="landing-proof-strip__item">
            <div className="landing-proof-strip__icon" aria-hidden="true">
              <item.icon size={20} />
            </div>
            <div>
              <h3>{item.label}</h3>
              <p>{item.detail}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
