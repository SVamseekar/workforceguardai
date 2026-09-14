import { LandingShell } from './LandingShell'
import { MarketingPage } from './MarketingPage'
import { ComplianceMappingSection } from './components/ComplianceMappingSection'

const TITLE = 'Directive mapping — WorkforceGuard AI'
const DESCRIPTION =
  'How WorkforceGuard pay-gap heat relates to Directive (EU) 2023/970 — and what only legal counsel can decide.'

export function DirectivePage() {
  return (
    <LandingShell>
      <MarketingPage
        title={TITLE}
        description={DESCRIPTION}
        path="/directive"
        eyebrow="Directive (EU) 2023/970"
        heading="What the law asks, and what this calculator does"
        lede="Transposition is 7 June 2026. First 250+ reports cover 2026 data, due 7 June 2027. Heat helps you see gaps early. It is not a compliance certificate."
      >
        <ComplianceMappingSection />
      </MarketingPage>
    </LandingShell>
  )
}
