import { LandingShell } from './LandingShell'
import { LegalArticle } from './components/LegalArticle'
import { RESEARCH_PAPER_LABEL, RESEARCH_PAPER_URL, SUPPORT_EMAIL } from './site'
import './landing.css'

const TITLE = 'Disclaimer — WorkforceGuard AI'
const DESCRIPTION =
  'Important limitations on WorkforceGuard AI analytics, benchmarks, and compliance outputs under Directive (EU) 2023/970.'

function DisclaimerContent() {
  return (
    <LegalArticle title={TITLE} description={DESCRIPTION} path="/disclaimer" updated="1 July 2026">
      <p>
        WorkforceGuard AI is a workforce intelligence and pay-transparency analytics platform. The
        information, benchmarks, and exports it produces are intended to support — not replace — your
        organisation&apos;s own compliance judgement and qualified legal advice.
      </p>
      <h2>Not legal advice</h2>
      <p>
        Nothing on this website or in the dashboard constitutes legal advice on Directive (EU)
        2023/970, national transposition, collective bargaining obligations, or employment law in any
        member state. Thresholds, reporting duties, and worker-category definitions may differ once
        national legislation is in force. Consult counsel before relying on outputs for regulatory
        filings or employee communications.
      </p>
      <h2>Benchmarks and methodology</h2>
      <p>
        EU market benchmarks are built from Eurostat and related public labour-market sources using
        methodology documented in our{' '}
        <a href={RESEARCH_PAPER_URL} target="_blank" rel="noopener noreferrer">
          {RESEARCH_PAPER_LABEL}
        </a>
        . Composite indices (Hiring Pressure, Labour Resilience, Equity Risk, Transition Readiness)
        summarise statistical relationships; they are not predictions of enforcement outcomes or
        litigation risk for your organisation.
      </p>
      <h2>Payroll and company-specific analysis</h2>
      <p>
        Company-level pay-gap figures depend on the completeness and accuracy of payroll and
        job-architecture data you provide. WorkforceGuard surfaces confidence and provenance to help
        reviewers challenge weak inputs — but cannot verify source HRIS records on your behalf.
      </p>
      <h2>AI-assisted summaries</h2>
      <p>
        Natural-language explanations in the product are generated on top of sourced metrics. They may
        omit nuance or misread context if filters are incomplete. Treat AI output as a draft for human
        review, not an authoritative compliance statement.
      </p>
      <h2>Third-party data</h2>
      <p>
        Eurostat and other public datasets are subject to revision, coverage limits, and sector
        classification changes (NACE). We refresh ingestion pipelines regularly but do not warrant
        real-time accuracy of upstream official statistics.
      </p>
      <h2>Contact</h2>
      <p>
        Questions about this disclaimer: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
      </p>
    </LegalArticle>
  )
}

export function DisclaimerPage() {
  return (
    <LandingShell>
      <DisclaimerContent />
    </LandingShell>
  )
}
