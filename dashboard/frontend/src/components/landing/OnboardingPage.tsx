import { LandingShell } from './LandingShell'
import { MarketingPage } from './MarketingPage'
import { OnboardingSupportSection } from './components/OnboardingSupportSection'

const TITLE = 'Getting started — WorkforceGuard AI'
const DESCRIPTION =
  'How a WorkforceGuard walkthrough works: job-group mapping, payroll CSV, pay-gap heat, and optional tenant sign-in.'

export function OnboardingPage() {
  return (
    <LandingShell>
      <MarketingPage
        title={TITLE}
        description={DESCRIPTION}
        path="/onboarding"
        eyebrow="Getting started"
        heading="A walkthrough first. A tenant only if you need one."
        lede="We can run heat with you locally or in a provisioned workspace. Either way you map equal-value groups; we do not invent them."
      >
        <OnboardingSupportSection />
      </MarketingPage>
    </LandingShell>
  )
}
