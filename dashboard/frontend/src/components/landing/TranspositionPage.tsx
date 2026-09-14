import { LandingShell } from './LandingShell'
import { MarketingPage } from './MarketingPage'
import { TranspositionStatusSection } from './components/TranspositionStatusSection'

const TITLE = 'Transposition tracker — WorkforceGuard AI'
const DESCRIPTION =
  'Which EU member states have transposed Directive (EU) 2023/970, and which still lack national pay-transparency law.'

export function TranspositionPage() {
  return (
    <LandingShell>
      <MarketingPage
        title={TITLE}
        description={DESCRIPTION}
        path="/transposition"
        eyebrow="Member states"
        heading="National law is uneven. The Directive text still applies."
        lede="Use this tracker as context, not legal advice. Employers in countries without a national act still need counsel on the EU text."
      >
        <TranspositionStatusSection />
      </MarketingPage>
    </LandingShell>
  )
}
