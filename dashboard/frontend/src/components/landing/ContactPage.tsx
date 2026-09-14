import { LandingShell } from './LandingShell'
import { MarketingPage } from './MarketingPage'
import { ContactSection } from './components/ContactSection'

const TITLE = 'Contact — WorkforceGuard AI'
const DESCRIPTION =
  'Book a WorkforceGuard walkthrough for your reporting countries and worker categories.'

export function ContactPage() {
  return (
    <LandingShell>
      <MarketingPage
        title={TITLE}
        description={DESCRIPTION}
        path="/contact"
        eyebrow="Contact"
        heading="Book a walkthrough for your team"
        lede="Tell us the countries in scope. We reply within one business day."
      >
        <ContactSection />
      </MarketingPage>
    </LandingShell>
  )
}
