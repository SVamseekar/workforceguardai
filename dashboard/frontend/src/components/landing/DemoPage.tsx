import { LandingShell } from './LandingShell'
import { MarketingPage } from './MarketingPage'
import { AnalystDemoTheater } from './components/AnalystDemoTheater'

const TITLE = 'See it live — WorkforceGuard AI'
const DESCRIPTION =
  'A sample walkthrough of pay-gap heat, Eurostat context, and a hash-chained evidence bundle.'

export function DemoPage() {
  return (
    <LandingShell>
      <MarketingPage
        title={TITLE}
        description={DESCRIPTION}
        path="/demo"
        eyebrow="See it live"
        heading="How a review conversation actually goes"
        lede="Illustrative figures from public Eurostat series and a synthetic tenant. Your numbers appear only after you map job groups and load payroll."
      >
        <AnalystDemoTheater />
      </MarketingPage>
    </LandingShell>
  )
}
