import { LandingShell } from './LandingShell'
import { LegalArticle } from './components/LegalArticle'
import { SUPPORT_EMAIL } from './site'
import './landing.css'

const TITLE = 'Terms of Service — WorkforceGuard AI'
const DESCRIPTION =
  'Terms governing access to the WorkforceGuard AI website, demo requests, and provisioned pay-transparency analytics workspaces.'

function TermsContent() {
  return (
    <LegalArticle title={TITLE} description={DESCRIPTION} path="/terms" updated="1 July 2026">
      <p>
        These Terms of Service (&quot;Terms&quot;) govern your use of the WorkforceGuard AI website
        and any provisioned analytics workspace made available to your organisation. By requesting a
        demo, signing in, or using the platform, you agree to these Terms.
      </p>
      <h2>Service scope</h2>
      <p>
        WorkforceGuard AI provides EU workforce intelligence and pay-transparency compliance analytics.
        The platform helps HR, people analytics, and compliance teams benchmark against Eurostat data,
        review payroll against Directive (EU) 2023/970 workflows, and export evidence with provenance.
        It is an analytics tool — not legal advice.
      </p>
      <h2>Organisation access</h2>
      <p>
        Dashboard access is provisioned per organisation via Google or Microsoft sign-in. You are
        responsible for ensuring only authorised colleagues access your tenant and for the accuracy of
        payroll and job-architecture data you upload.
      </p>
      <h2>Acceptable use</h2>
      <ul>
        <li>Use the service only for lawful workforce and compliance analysis within your organisation.</li>
        <li>Do not attempt to bypass tenant isolation, tamper with governance logs, or reverse-engineer the service.</li>
        <li>Do not upload data you are not authorised to process under applicable employment and data-protection law.</li>
      </ul>
      <h2>Intellectual property</h2>
      <p>
        WorkforceGuard AI, its composite indices, interface, and documentation remain our property or
        that of our licensors. Your organisation retains ownership of payroll and governance data you
        upload. Aggregated EU benchmark data is derived from public Eurostat sources as described in our
        methodology.
      </p>
      <h2>Availability and changes</h2>
      <p>
        We may update features, data pipelines, or these Terms as the Pay Transparency Directive
        transposition timeline evolves. Material changes will be reflected on this page with an updated
        date.
      </p>
      <h2>Limitation of liability</h2>
      <p>
        The service is provided on an &quot;as is&quot; basis to the extent permitted by law. Final
        compliance determinations remain your organisation&apos;s responsibility and should be reviewed
        with qualified legal counsel in relevant member states. See our{' '}
        <a href="/disclaimer">Disclaimer</a> for further detail.
      </p>
      <h2>Contact</h2>
      <p>
        Questions about these Terms: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
      </p>
    </LegalArticle>
  )
}

export function TermsPage() {
  return (
    <LandingShell>
      <TermsContent />
    </LandingShell>
  )
}
