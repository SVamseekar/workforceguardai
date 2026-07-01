import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import {
  GitCompare, MessageSquare, ArrowRight, Database, Sparkles, ChevronRight,
} from 'lucide-react'
import { Seo } from '../seo/Seo'
import { buildHomeJsonLd, DEFAULT_DESCRIPTION, DEFAULT_TITLE } from '../../lib/seo'
import { AnalystDemoTheater } from './components/AnalystDemoTheater'
import { ComplianceMappingSection } from './components/ComplianceMappingSection'
import { ContactSection } from './components/ContactSection'
import { LiveProofBand } from './components/LiveProofBand'
import { OnboardingSupportSection } from './components/OnboardingSupportSection'
import { ProblemSection } from './components/ProblemSection'
import { ProductTour } from './components/ProductTour'
import { LandingShell, useLandingDemo } from './LandingShell'
import { LANDING_FACTS } from './landingFacts'
import { RESEARCH_PAPER_LABEL, RESEARCH_PAPER_URL } from './site'

import { useScrollReveal } from './useScrollReveal'
import './landing.css'

const { market, research } = LANDING_FACTS

const FAQS = [
  {
    q: 'Is this a substitute for legal advice on the Pay Transparency Directive?',
    a: 'No. WorkforceGuard is an analytics and evidence platform. Final compliance determinations should be reviewed by qualified legal counsel in your member state.',
  },
  {
    q: 'What happens to uploaded payroll data?',
    a: 'Payroll is modelled in a tenant-isolated DuckDB schema (tag:internal in dbt). It never blends into the shared EU reference layer unless you explicitly run company-specific benchmarks.',
  },
  {
    q: 'Is the methodology published?',
    a: `Yes — ${RESEARCH_PAPER_LABEL} documents a ${research.panelCountries}-country, ${research.panelSectors}-sector Eurostat panel (${market.yearRange}) with an open dbt/DuckDB pipeline.`,
  },
  {
    q: 'Can I open the dashboard without a demo?',
    a: 'Sign in with Google or Microsoft if your organisation is provisioned. New teams should request a demo so we can seed the right tenant and walk through pay transparency workflows.',
  },
  {
    q: 'How do I reach support?',
    a: 'Email workforceguardai@souravamseekar.com for demo follow-ups, technical questions, or GDPR requests. We aim to reply within one business day.',
  },
]

function ProductShowcase() {
  return (
    <div className="landing-showcase">
      <div className="landing-showcase__frame">
        <div className="landing-showcase__chrome">
          <span className="landing-showcase__dot" />
          <span className="landing-showcase__dot" />
          <span className="landing-showcase__dot" />
          <span className="landing-showcase__url">workforceguardai.souravamseekar.com/app</span>
        </div>
        <div className="landing-showcase__viewport">
          <video
            src="/demos/product_walkthrough.mp4"
            poster="/screenshots/command-centre.png"
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            aria-label="WorkforceGuard AI product walkthrough: command centre, market intelligence, compare, pay analysis, and governance log for Czechia financial and insurance activities"
          />
        </div>
      </div>
    </div>
  )
}

function LandingHomeContent() {
  const { openDemo, goToHash } = useLandingDemo()
  useScrollReveal()

  return (
    <>
      <Seo
        title={DEFAULT_TITLE}
        description={DEFAULT_DESCRIPTION}
        path="/"
        jsonLd={buildHomeJsonLd(FAQS)}
      />

      <section className="landing-hero">
        <div className="landing-hero__inner">
          <div className="landing-hero__copy">
            <div className="landing-hero__badge">
              <Sparkles size={14} />
              <span>Directive (EU) 2023/970</span>
              <span className="landing-hero__badge-sep" />
              <span className="landing-hero__badge-deadline">Transposition · 7 Jun 2026</span>
            </div>
            <h1>
              Pay transparency compliance,
              <em> built on Eurostat data</em>
              {' '}and a hash-chained audit trail
            </h1>
            <p className="landing-hero__lede">
              {market.dbtModels} dbt models over DuckDB turn Eurostat LFS, JVS, and SES into composite
              indices and pay transparency review — with tenant-isolated payroll and regulator-ready
              evidence export.
            </p>
            <p className="landing-hero__proof">
              <Database size={14} aria-hidden="true" />
              {' '}
              {market.euMemberStates} member states · {market.naceSectors} NACE sectors · {market.yearRange}
              {' '}· {market.compositeIndices.length} composite indices
            </p>
          </div>
          <div className="landing-hero__visual">
            <ProductShowcase />
          </div>
          <div className="landing-hero__bar">
            <div className="landing-hero__actions">
              <button
                type="button"
                className="landing-cta landing-cta--primary landing-cta--large"
                onClick={openDemo}
              >
                Request a demo <ArrowRight size={18} />
              </button>
              <Link
                to="/app"
                className="landing-cta landing-cta--secondary landing-cta--large"
                title="Organisation sign-in via Google or Microsoft"
              >
                Sign in to dashboard
              </Link>
              <button
                type="button"
                className="landing-cta landing-cta--ghost landing-cta--large"
                onClick={() => goToHash('#compliance')}
              >
                See compliance mapping
              </button>
            </div>
            <p className="landing-hero__action-note">
              Organisation sign-in is for provisioned teams only. New to WorkforceGuard? Start with a demo above.
            </p>
          </div>
        </div>
      </section>

      <LiveProofBand />
      <ProblemSection />
      <ProductTour />
      <ComplianceMappingSection />
      <AnalystDemoTheater />

      <section className="landing-section landing-reveal">
        <div id="research" className="landing-anchor" tabIndex={-1} />
        <div className="landing-research">
          <div className="landing-research__copy">
            <p className="landing-section__eyebrow">Research-backed</p>
            <h2>Tight labour markets have not closed gender pay gaps</h2>
            <p>
              Our Eurostat panel ({research.panelCountries} countries, {research.panelSectors} sectors,{' '}
              {market.yearRange}) finds employment rate and gender pay gap correlate positively
              (r ≈ {research.employmentGapCorrelation}) — the five tightest labour markets in the
              sample all record gaps above the EU27 average of {research.eu27UnadjustedGapPct}%.
            </p>
            <p>
              WorkforceGuard implements Hiring Pressure, Labour Resilience, Equity Risk, and Transition
              Readiness indices in an open dbt/DuckDB pipeline — the same methodology cited in our{' '}
              <a href={RESEARCH_PAPER_URL} target="_blank" rel="noopener noreferrer">
                {RESEARCH_PAPER_LABEL}
              </a>
              {' '}preprint.
            </p>
          </div>
          <div className="landing-research__panel">
            <div className="landing-research__quadrant" aria-hidden="true">
              <span className="landing-research__axis landing-research__axis--y">Equity Risk</span>
              <span className="landing-research__axis landing-research__axis--x">Hiring Pressure</span>
              <span className="landing-research__dot landing-research__dot--a" />
              <span className="landing-research__dot landing-research__dot--b" />
              <span className="landing-research__dot landing-research__dot--c" />
              <span className="landing-research__zone">High exposure zone</span>
            </div>
            <GitCompare size={18} />
            <h3>Combined Risk Quadrant</h3>
            <p>
              Czechia finance (NACE K): SES gap {research.czFinanceSectorGapPct2023}% with HPI{' '}
              {LANDING_FACTS.demo.czFinanceSignals.hiringPressureIndex} and ERS{' '}
              {LANDING_FACTS.demo.czFinanceSignals.equityRiskScore} in live semantic metrics.
            </p>
            <Link to="/app/compare" className="landing-cta landing-cta--secondary">
              Explore the comparison <ChevronRight size={14} />
            </Link>
          </div>
        </div>
      </section>

      <OnboardingSupportSection />
      <ContactSection />

      <section className="landing-section landing-section--alt landing-reveal">
        <div id="faq" className="landing-anchor" tabIndex={-1} />
        <div className="landing-section__split">
          <div className="landing-section__header landing-section__header--left">
            <p className="landing-section__eyebrow">FAQ</p>
            <h2>Common questions</h2>
            <p className="landing-section__lede">
              Legal scope, payroll isolation, methodology, and access.
            </p>
          </div>
          <div className="landing-faq-list">
            {FAQS.map((item) => (
              <details className="landing-faq-item" key={item.q}>
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-cta-section landing-reveal">
        <div className="landing-cta-section__inner">
          <div className="landing-cta-section__glow" aria-hidden="true" />
          <MessageSquare size={28} />
          <h2>See where your organisation stands</h2>
          <p>
            Book a walkthrough on the Meridian CZ demo tenant ({LANDING_FACTS.demo.payrollRows} payroll
            rows, {LANDING_FACTS.demo.reviewCategories.length} flagged categories), or sign in if your
            organisation already has access.
          </p>
          <div className="landing-cta-section__actions">
            <button
              type="button"
              className="landing-cta landing-cta--primary landing-cta--large"
              onClick={openDemo}
            >
              Request a demo <ArrowRight size={18} />
            </button>
            <Link
              to="/app"
              className="landing-cta landing-cta--ghost landing-cta--large"
              title="Organisation sign-in via Google or Microsoft"
            >
              Sign in to dashboard
            </Link>
          </div>
        </div>
      </section>

    </>
  )
}

export function LandingPage() {
  const navigate = useNavigate()

  useEffect(() => {
    api.get('/auth/me')
      .then(() => navigate('/app', { replace: true }))
      .catch(() => {})
  }, [navigate])

  return (
    <LandingShell>
      <LandingHomeContent />
    </LandingShell>
  )
}
