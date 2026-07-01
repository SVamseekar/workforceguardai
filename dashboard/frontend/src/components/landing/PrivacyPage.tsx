import { Link } from 'react-router-dom'
import { Seo } from '../seo/Seo'
import { LandingShell } from './LandingShell'
import { SUPPORT_EMAIL } from './site'
import { useScrollReveal } from './useScrollReveal'
import './landing.css'

const TITLE = 'Privacy Policy — WorkforceGuard AI'
const DESCRIPTION = 'How WorkforceGuard AI collects, uses, and protects personal data submitted via demo requests and organisation sign-in.'

function PrivacyContent() {
  useScrollReveal()

  return (
    <>
      <Seo title={TITLE} description={DESCRIPTION} path="/privacy" />
      <section className="landing-section landing-reveal" style={{ paddingTop: 120 }}>
        <div className="landing-section__header landing-section__header--left">
          <p className="landing-section__eyebrow">Legal</p>
          <h1>Privacy Policy</h1>
          <p className="landing-section__lede">Last updated: 1 July 2026</p>
        </div>
        <div className="mission-prose">
          <p>
            WorkforceGuard AI (&quot;we&quot;, &quot;us&quot;) operates the workforceguardai.souravamseekar.com
            website and provisioned analytics dashboard for EU pay-transparency compliance workflows.
          </p>
          <h2>Data we collect</h2>
          <ul>
            <li><strong>Demo requests:</strong> name, work email, job title, company details, and compliance scope you submit via the contact form.</li>
            <li><strong>Organisation sign-in:</strong> identity attributes from Google or Microsoft OAuth (email, display name) and tenant membership.</li>
            <li><strong>Payroll uploads:</strong> compensation data uploaded by authorised admins within your provisioned tenant.</li>
            <li><strong>Usage:</strong> aggregated analytics via Google Analytics on public pages.</li>
          </ul>
          <h2>How we use data</h2>
          <p>
            Demo request data is used to respond to your enquiry and schedule a walkthrough. Payroll data is
            processed to compute company-level benchmarks inside your tenant-isolated storage layer. We do not
            sell personal data.
          </p>
          <h2>Retention and security</h2>
          <p>
            Tenant payroll and governance data remain under your organisation&apos;s provisioned environment.
            Demo enquiries are retained only as long as needed to respond and follow up.
          </p>
          <h2>Your rights</h2>
          <p>
            Under GDPR you may request access, correction, or deletion of personal data we hold about you.
            Contact us at <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
          </p>
          <h2>Contact</h2>
          <p>
            Questions about this policy: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
          </p>
        </div>
        <p style={{ marginTop: 32 }}>
          <Link to="/" className="landing-cta landing-cta--ghost">Back to home</Link>
        </p>
      </section>
    </>
  )
}

export function PrivacyPage() {
  return (
    <LandingShell>
      <PrivacyContent />
    </LandingShell>
  )
}
