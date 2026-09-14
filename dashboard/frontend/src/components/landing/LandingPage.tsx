import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import { ArrowRight, Database, MessageSquare, Sparkles } from 'lucide-react'
import { Seo } from '../seo/Seo'
import { buildHomeJsonLd, DEFAULT_DESCRIPTION, DEFAULT_TITLE } from '../../lib/seo'
import { LiveProofBand } from './components/LiveProofBand'
import { PartnerProofStrip } from './components/PartnerProofStrip'
import { LandingShell, useLandingDemo } from './LandingShell'
import { LANDING_FACTS } from './landingFacts'
import { HUB_PAGES, SANDBOX_CTA_ENABLED } from './site'
import { FAQS } from './faqs'
import { useScrollReveal } from './useScrollReveal'
import './landing.css'

const { market } = LANDING_FACTS

function ProductShowcase() {
  return (
    <div className="landing-showcase landing-hero-enter landing-hero-enter--visual">
      <div className="landing-showcase__glow" aria-hidden="true" />
      <div className="landing-showcase__frame">
        <div className="landing-showcase__shine" aria-hidden="true" />
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
            aria-label="WorkforceGuard AI product walkthrough: command centre, market intelligence, compare, pay analysis, and governance log across EU member states"
          />
        </div>
      </div>
    </div>
  )
}

function LandingHomeContent() {
  const { openDemo } = useLandingDemo()
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
            <div className="landing-hero__badge landing-hero-enter landing-hero-enter--1">
              <Sparkles size={14} className="landing-hero__badge-icon" />
              <span>Directive (EU) 2023/970</span>
              <span className="landing-hero__badge-sep" />
              <span className="landing-hero__badge-deadline">Heat for review · not a verdict</span>
            </div>
            <h1 className="landing-hero-enter landing-hero-enter--2">
              Pay-gap heat for human review,
              <em> built on Eurostat</em>
              {' '}and the job groups you map
            </h1>
            <p className="landing-hero__lede landing-hero-enter landing-hero-enter--3">
              Convert payroll to hourly pay, compute mean and median gaps, suppress small cells, and
              flag 5% and 10% categories. WorkforceGuard does not say you are — or are not —
              Directive-compliant.
            </p>
            <p className="landing-hero__proof landing-hero-enter landing-hero-enter--4">
              <Database size={14} aria-hidden="true" />
              {' '}
              {market.euMemberStates} member states · {market.naceSectors} NACE sectors · {market.yearRange}
              {' '}· {market.compositeIndices.length} composite indices
            </p>
          </div>
          <div className="landing-hero__visual">
            <ProductShowcase />
          </div>
          <div className="landing-hero__bar landing-hero-enter landing-hero-enter--5">
            <div className="landing-hero__actions">
              <button
                type="button"
                className="landing-cta landing-cta--primary landing-cta--large landing-cta--shimmer"
                onClick={openDemo}
              >
                Request a walkthrough <ArrowRight size={18} className="landing-cta__arrow" />
              </button>
              {SANDBOX_CTA_ENABLED ? (
                <Link
                  to="/sandbox"
                  className="landing-cta landing-cta--secondary landing-cta--large"
                >
                  Try the demo
                </Link>
              ) : null}
              <Link
                to="/pay-gap-heat"
                className="landing-cta landing-cta--ghost landing-cta--large"
              >
                How heat works
              </Link>
              <Link
                to="/app"
                className="landing-cta landing-cta--ghost landing-cta--large"
                title="Organisation sign-in via Google or Microsoft"
              >
                Sign in to dashboard
              </Link>
            </div>
            <p className="landing-hero__action-note">
              Organisation sign-in is for provisioned teams only. New to WorkforceGuard? Start with a walkthrough.
            </p>
          </div>
        </div>
      </section>

      <LiveProofBand />
      <PartnerProofStrip />

      <section className="landing-section landing-reveal">
        <div className="landing-section__header">
          <p className="landing-section__eyebrow">Explore</p>
          <h2>Each topic on its own page</h2>
          <p className="landing-section__lede">
            The old one-page scroll is split so you can send a colleague a single URL.
          </p>
        </div>
        <div className="landing-hub">
          {HUB_PAGES.map((page) => (
            <Link key={page.to} to={page.to} className="landing-hub__card">
              <h3>{page.title}</h3>
              <p>{page.lede}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="landing-cta-section landing-reveal">
        <div className="landing-cta-section__inner">
          <div className="landing-cta-section__glow" aria-hidden="true" />
          <div className="landing-cta-section__ring" aria-hidden="true" />
          <MessageSquare size={28} />
          <h2>See where the heat sits</h2>
          <p>
            Book a walkthrough for your reporting countries and worker categories, or sign in
            if your organisation already has access.
          </p>
          <div className="landing-cta-section__actions">
            <button
              type="button"
              className="landing-cta landing-cta--primary landing-cta--large landing-cta--shimmer"
              onClick={openDemo}
            >
              Request a walkthrough <ArrowRight size={18} className="landing-cta__arrow" />
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
