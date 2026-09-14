import { LandingShell, useLandingDemo } from './LandingShell'
import { MarketingPage } from './MarketingPage'
import { FAQS } from './faqs'
import { buildFaqSchema, buildOrganizationSchema, buildWebSiteSchema } from '../../lib/seo'

const TITLE = 'FAQ — WorkforceGuard AI'
const DESCRIPTION =
  'Does WorkforceGuard determine Directive compliance? What is pay-gap heat? What happens to payroll?'

export function FaqPage() {
  const { openDemo } = useLandingDemo()

  return (
    <LandingShell>
      <MarketingPage
        title={TITLE}
        description={DESCRIPTION}
        path="/faq"
        eyebrow="FAQ"
        heading="Common questions"
        lede="Legal scope, heat, payroll isolation, and access."
        jsonLd={[
          buildOrganizationSchema(),
          buildWebSiteSchema(),
          buildFaqSchema(FAQS),
        ]}
      >
        <section className="landing-section landing-section--alt landing-reveal">
          <div className="landing-faq-list">
            {FAQS.map((item) => (
              <details className="landing-faq-item" key={item.q}>
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
          <div className="landing-cta-section__actions" style={{ marginTop: 32 }}>
            <button type="button" className="landing-cta landing-cta--primary" onClick={openDemo}>
              Request a walkthrough
            </button>
          </div>
        </section>
      </MarketingPage>
    </LandingShell>
  )
}
