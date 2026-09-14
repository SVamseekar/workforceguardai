import { LandingShell } from './LandingShell'
import { MarketingPage } from './MarketingPage'
import { CountryExposureViz } from './components/CountryExposureViz'
import { ProblemSection } from './components/ProblemSection'

const TITLE = 'The problem — WorkforceGuard AI'
const DESCRIPTION =
  'Why spreadsheet gender pay gaps fail Directive timelines: missing hours, no small-n rule, and late 5% triggers.'

export function ProblemPage() {
  return (
    <LandingShell>
      <MarketingPage
        title={TITLE}
        description={DESCRIPTION}
        path="/problem"
        eyebrow="The problem"
        heading="Pay gaps hide in hours, bonuses, and small groups"
        lede="Annual salaries without hours are not comparable. Categories with three women are not a publishable gap. Heat makes those facts visible before a filing deadline."
      >
        <ProblemSection />
        <CountryExposureViz />
      </MarketingPage>
    </LandingShell>
  )
}
