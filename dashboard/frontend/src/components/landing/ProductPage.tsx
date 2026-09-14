import { LandingShell } from './LandingShell'
import { MarketingPage } from './MarketingPage'
import { ProductTour } from './components/ProductTour'

const TITLE = 'Product — WorkforceGuard AI'
const DESCRIPTION =
  'Command centre, Eurostat market intelligence, country comparison, pay-gap heat, and a hash-chained review log.'

export function ProductPage() {
  return (
    <LandingShell>
      <MarketingPage
        title={TITLE}
        description={DESCRIPTION}
        path="/product"
        eyebrow="Product"
        heading="One workspace for market context, pay-gap heat, and evidence"
        lede="Five views from the live dashboard. Heat is a review map. It does not decide Directive compliance."
      >
        <ProductTour />
      </MarketingPage>
    </LandingShell>
  )
}
