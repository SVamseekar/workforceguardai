import { Link } from 'react-router-dom'
import { ArrowRight, ShieldCheck } from 'lucide-react'
import { Seo } from '../seo/Seo'
import {
  buildOrganizationSchema,
  buildWebPageSchema,
  buildWebSiteSchema,
} from '../../lib/seo'
import { LandingShell } from './LandingShell'
import { SUPPORT_EMAIL } from './site'
import { useScrollReveal } from './useScrollReveal'
import './landing.css'

const PAGE_TITLE = 'Security & Trust — WorkforceGuard AI'
const PAGE_DESCRIPTION =
  'How WorkforceGuard AI protects payroll and compliance data: tenant isolation, hash-chained governance logging, authentication, and what we do not yet claim.'

function SecurityContent() {
  useScrollReveal()

  return (
    <>
      <Seo
        title={PAGE_TITLE}
        description={PAGE_DESCRIPTION}
        path="/security"
        jsonLd={[
          buildOrganizationSchema(),
          buildWebSiteSchema(),
          buildWebPageSchema({
            title: PAGE_TITLE,
            description: PAGE_DESCRIPTION,
            path: '/security',
          }),
        ]}
      />

      <section className="mission-hero landing-reveal">
        <div className="mission-hero__inner">
          <p className="mission-hero__eyebrow">
            <ShieldCheck size={14} />
            Security &amp; trust
          </p>
          <h1>What we protect, and what we do not yet claim</h1>
          <p className="mission-hero__lede">
            WorkforceGuard AI handles employer payroll and pay-equity data used for regulatory
            compliance under Directive (EU) 2023/970. This page describes how the platform
            protects that data today — including the parts that are still in progress.
          </p>
        </div>
      </section>

      <section className="landing-section landing-reveal">
        <div className="landing-section__header">
          <h2>Data protection &amp; encryption</h2>
          <p className="landing-section__lede">
            Public and API traffic uses HTTPS. Session cookies are HttpOnly with SameSite
            protection. Company payroll is modelled in a tenant-scoped layer, separate from the
            public Eurostat reference warehouse.
          </p>
        </div>
      </section>

      <section className="landing-section landing-section--alt landing-reveal">
        <div className="landing-section__header">
          <h2>Tenant isolation</h2>
          <p className="landing-section__lede">
            Each organisation has its own DuckDB schema. Unqualified queries resolve against that
            schema first. A dedicated isolation test suite exists because an earlier implementation
            could fall back to the shared warehouse schema — that path is now guarded.
          </p>
        </div>
      </section>

      <section className="landing-section landing-reveal">
        <div className="landing-section__header">
          <h2>Governance log</h2>
          <p className="landing-section__lede">
            Approve, override, reverse, and export actions append to a SHA-256 hash-chained event
            log. Changing a past event breaks the chain from that point forward and is detectable
            on read. The log is tamper-<em>evident</em>, not tamper-proof: there is no external
            timestamp anchor and no separate signing key. A fully compromised host could rewrite
            the chain from genesis.
          </p>
        </div>
      </section>

      <section className="landing-section landing-section--alt landing-reveal">
        <div className="landing-section__header">
          <h2>Authentication &amp; access control</h2>
          <p className="landing-section__lede">
            Access requires OAuth sign-in. Sessions are stored server-side. Uploading payroll,
            writing a governance event, promoting trusted internal data, and creating automation
            schedules require an authenticated session with the appropriate role. An internal
            security review in June 2026 found unauthenticated endpoints; those mutating routes
            now require a session. The written audit is a historical snapshot, not a description
            of the live system.
          </p>
        </div>
      </section>

      <section className="landing-section landing-reveal">
        <div className="landing-section__header">
          <h2>Data residency</h2>
          <p className="landing-section__lede">
            WorkforceGuard AI processes tenant application data on a Google Compute Engine
            virtual machine in us-central1-f (Iowa, United States). The DuckDB analytics
            warehouse is a file on that VM&apos;s disk; auth and session Postgres runs as a
            Docker container on the same host, not Cloud SQL. The marketing frontend is served
            by Vercel and cached at the edge globally; that does not change where warehouse or
            session data is stored. Because that processing location is in the United States,
            an EU-to-US transfer of personal data engages GDPR Chapter V international-transfer
            rules and requires a valid transfer mechanism.
          </p>
        </div>
      </section>

      <section className="landing-section landing-section--alt landing-reveal">
        <div className="landing-section__header">
          <h2>Compliance &amp; certifications</h2>
          <p className="landing-section__lede">
            WorkforceGuard AI does not currently hold SOC 2, ISO 27001, or any other third-party
            security certification. If and when we pursue one, this page will be updated. We are
            not describing certifications as in progress.
          </p>
        </div>
      </section>

      <section className="landing-section landing-reveal">
        <div className="landing-section__header">
          <h2>Vendors</h2>
          <p className="landing-section__lede">
            Infrastructure runs on Google Cloud Platform (API and analytics warehouse) and Vercel
            (frontend hosting and edge routing).
          </p>
        </div>
      </section>

      <section className="landing-section landing-section--alt landing-reveal">
        <div className="landing-section__header">
          <h2>Reporting a concern</h2>
          <p className="landing-section__lede">
            If you believe you have found a security issue, email{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
          </p>
          <p>
            <Link to="/" className="landing-cta landing-cta--secondary">
              Return home <ArrowRight size={14} />
            </Link>
          </p>
        </div>
      </section>
    </>
  )
}

export function SecurityPage() {
  return (
    <LandingShell>
      <SecurityContent />
    </LandingShell>
  )
}
