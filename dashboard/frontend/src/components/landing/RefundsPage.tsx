import { LandingShell } from './LandingShell'
import { LegalArticle } from './components/LegalArticle'
import { SUPPORT_EMAIL } from './site'
import './landing.css'

const TITLE = 'Refunds Policy — WorkforceGuard AI'
const DESCRIPTION =
  'Refund and cancellation terms for WorkforceGuard AI enterprise subscriptions and professional services.'

function RefundsContent() {
  return (
    <LegalArticle title={TITLE} description={DESCRIPTION} path="/refunds" updated="1 July 2026">
      <p>
        WorkforceGuard AI is sold to organisations on an enterprise basis following a tailored demo and
        scoping conversation. Pricing, term length, and data-processing arrangements are set out in your
        order form or statement of work.
      </p>
      <h2>Subscription services</h2>
      <p>
        Annual or multi-year subscriptions are invoiced according to your agreement. If you wish to
        cancel, notify us in writing at{' '}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> before the next renewal date. Fees
        already paid for the current term are generally non-refundable unless your agreement states
        otherwise.
      </p>
      <h2>Professional services</h2>
      <p>
        Onboarding, methodology briefings, and custom data-integration work are non-refundable once
        delivery has started, except where required by applicable consumer or B2B contract law in your
        jurisdiction.
      </p>
      <h2>Service issues</h2>
      <p>
        If the platform is unavailable for a material period due to a fault on our side, we will work
        with you on service credits or term extensions proportional to the impact — as described in your
        enterprise agreement.
      </p>
      <h2>Demo requests</h2>
      <p>
        Product demonstrations and research briefings are provided free of charge. No payment is taken
        at the demo-request stage.
      </p>
      <h2>How to request a review</h2>
      <p>
        Email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> with your organisation name,
        agreement reference, and reason for the request. We aim to respond within five business days.
      </p>
    </LegalArticle>
  )
}

export function RefundsPage() {
  return (
    <LandingShell>
      <RefundsContent />
    </LandingShell>
  )
}
