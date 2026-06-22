import { useEffect, useRef, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import {
  ShieldCheck, Scale, BarChart2, GitCompare, MessageSquare,
  CheckCircle2, Sun, Moon, ArrowRight, Lock, Database, FileCheck2,
  Menu, X, ChevronRight, Sparkles,
} from 'lucide-react'
import { LogoMark } from '../shared/LogoMark'
import { DemoRequestModal } from './DemoRequestModal'
import './landing.css'

const SITE_URL = 'https://workforceguardai.souravamseekar.com'

const NAV_LINKS = [
  { href: '#product', label: 'Product' },
  { href: '#compliance', label: 'Compliance' },
  { href: '#research', label: 'Research' },
  { href: '#faq', label: 'FAQ' },
]

const STATS = [
  { value: '11.1%', label: 'EU27 average unadjusted gender pay gap', detail: 'Most employers have not quantified their position against it.' },
  { value: '5%', label: 'Threshold triggering joint pay assessment', detail: 'Under Directive (EU) 2023/970 when the gap is unjustified.' },
  { value: '2027', label: 'First reporting cycle deadline', detail: 'Preparation needs to start before June 2026 transposition.' },
]

const COMPLIANCE_ITEMS = [
  {
    requirement: 'Gender pay gap reporting by gender and worker category',
    feature: 'Pay Transparency Review',
    coverage: 'Pay gap computed across EU27 countries and 13 NACE sectors, sourced from Eurostat SES and blended with uploaded payroll.',
  },
  {
    requirement: 'Joint pay assessment when the gap exceeds 5% and is unjustified',
    feature: 'Threshold flagging',
    coverage: 'Pay Transparency Review surfaces every category crossing the threshold and flags it for HR or legal sign-off.',
  },
  {
    requirement: 'Justification of pay differences with objective, gender-neutral criteria',
    feature: 'Approve / override / reverse',
    coverage: 'Each flagged item carries an evidence basis and benchmark context, with an approve / override / reverse workflow.',
  },
  {
    requirement: 'Audit trail of compliance decisions for regulators',
    feature: 'Governance log',
    coverage: 'Every review decision is written to a SHA-256 hash-chained governance log with verifiable chain integrity.',
  },
  {
    requirement: 'Benchmarking against comparable employers or sectors',
    feature: 'Compare',
    coverage: 'Country x sector comparison with delta tables and AI-written narrative synthesis against EU averages or peer groups.',
  },
  {
    requirement: 'Evidence pack for regulatory filing',
    feature: 'Evidence export',
    coverage: 'One-click export of metrics, provenance, and governance events as a structured compliance evidence bundle.',
  },
]

const PERSONAS = [
  {
    icon: ShieldCheck,
    title: 'Compliance & Legal',
    body: 'Map every requirement of Directive (EU) 2023/970 to a feature in the platform, with a hash-chained audit log ready for regulators ahead of the June 2026 transposition deadline.',
    span: 'wide',
  },
  {
    icon: BarChart2,
    title: 'People Analytics',
    body: 'Track employment, vacancy, and pay-gap trends across all 27 member states and 13 sectors with provenance on every figure — no more reconciling Eurostat tables by hand.',
    span: 'normal',
  },
  {
    icon: Scale,
    title: 'HR & Reward Leaders',
    body: 'Upload payroll once and see it benchmarked against market data instantly, with review items pre-flagged and ranked by exposure ahead of the joint pay assessment.',
    span: 'normal',
  },
]

const FAQS = [
  {
    q: 'Is this a substitute for legal advice on the Pay Transparency Directive?',
    a: 'No. WorkforceGuard is an analytics and evidence platform that maps your data to the requirements of Directive (EU) 2023/970. Final compliance determinations should be reviewed by qualified legal counsel in your member state.',
  },
  {
    q: 'Where does the labour market data come from?',
    a: 'All EU-wide figures are sourced directly from Eurostat — the Labour Force Survey, Job Vacancy Statistics, and Structure of Earnings Survey — covering all 27 member states from 2019 to 2024. Every number shown carries its source dataset and version.',
  },
  {
    q: 'What happens to uploaded payroll data?',
    a: 'Internal payroll is processed to compute company-level benchmarks and is kept separate from the public EU reference layer at every stage of the data pipeline. No payroll data is required to use the market intelligence features.',
  },
  {
    q: 'How is the audit log secured?',
    a: 'Every governance event (approve, override, reverse, export) is written to a SHA-256 hash-chained log. Chain integrity is verified on every API call and shown directly in the dashboard, so tampering is detectable.',
  },
  {
    q: 'Is the methodology published?',
    a: 'Yes. The underlying composite indices (Hiring Pressure Index, Labour Resilience, Equity Risk Score) are documented in an open research paper covering a 20-country, 6-year Eurostat panel, available for review alongside the open-source codebase.',
  },
  {
    q: 'How do I request a demo?',
    a: 'Use Request a demo anywhere on this page. We follow up within one business day with a walkthrough tailored to your reporting obligations, payroll countries in scope, and team setup.',
  },
]

const FEATURES = [
  { id: 'home', icon: BarChart2, title: 'Command Centre', desc: 'Signal scores, AI-written executive brief, and live market indicators in one view.' },
  { id: 'market', icon: BarChart2, title: 'Market Intelligence', desc: 'Employment, unemployment, vacancy, and gender pay gap trends across the EU27.' },
  { id: 'compare', icon: GitCompare, title: 'Compare', desc: 'Side-by-side country and sector benchmarking with narrative synthesis.' },
  { id: 'pay', icon: Scale, title: 'Pay Analysis', desc: 'Company payroll blended against market benchmarks, with review items ranked by exposure.' },
  { id: 'govern', icon: ShieldCheck, title: 'Govern & Export', desc: 'Hash-chained audit log and one-click compliance evidence pack export.' },
  { id: 'ai', icon: MessageSquare, title: 'AI Analyst', desc: 'Ask natural-language questions; answers come with provenance and benchmark confidence.' },
]

const TRUST_ITEMS = [
  { icon: Database, title: 'EU reference data', body: 'Employment, unemployment, vacancies, and gender pay gap across all 27 member states and 13 NACE sectors from Eurostat LFS, JVS, and SES.' },
  { icon: Lock, title: 'Separated payroll layer', body: 'Uploaded payroll is modelled independently of public EU benchmarks and used only for company-specific comparisons.' },
  { icon: FileCheck2, title: 'Evidence on every metric', body: 'Every number traces to its Eurostat source dataset, version, and formula — structural provenance, not an afterthought.' },
  { icon: ShieldCheck, title: 'Hash-chained governance log', body: 'Every approve, override, reverse, and export action is written to a SHA-256 hash-chained event log with live integrity checks.' },
]

const JSON_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      name: 'WorkforceGuard AI',
      url: SITE_URL,
      logo: `${SITE_URL}/og-image.png`,
    },
    {
      '@type': 'SoftwareApplication',
      name: 'WorkforceGuard AI',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      description: 'EU workforce intelligence and pay-transparency compliance platform for HR, people analytics, and compliance teams, built around the EU Pay Transparency Directive (2023/970).',
      url: SITE_URL,
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'EUR',
      },
    },
  ],
}

function useScrollReveal() {
  useEffect(() => {
    const nodes = document.querySelectorAll('.landing-reveal')
    if (!nodes.length) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible')
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
    )

    nodes.forEach((node) => observer.observe(node))
    return () => observer.disconnect()
  }, [])
}

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

export function LandingPage() {
  const navigate = useNavigate()
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme')
    if (saved === 'light' || saved === 'dark') return saved
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })
  const [navOpen, setNavOpen] = useState(false)
  const [demoOpen, setDemoOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const navRef = useRef<HTMLElement>(null)

  useScrollReveal()

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  useEffect(() => {
    api.get('/auth/me')
      .then(() => navigate('/app', { replace: true }))
      .catch(() => {})
  }, [navigate])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    document.body.style.overflow = navOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [navOpen])

  const toggleTheme = () => setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))
  const closeNav = () => setNavOpen(false)
  const openDemo = () => {
    closeNav()
    setDemoOpen(true)
  }

  return (
    <div className="landing">
      <Helmet>
        <title>WorkforceGuard AI — EU Pay Transparency Compliance & Workforce Intelligence</title>
        <meta
          name="description"
          content="WorkforceGuard AI helps EU employers prepare for Directive (EU) 2023/970 with gender pay gap benchmarking across the EU27, payroll-aware compliance review, and a hash-chained audit log ready for regulators."
        />
        <link rel="canonical" href={SITE_URL + '/'} />
        <meta name="robots" content="index, follow" />

        <meta property="og:type" content="website" />
        <meta property="og:url" content={SITE_URL + '/'} />
        <meta property="og:title" content="WorkforceGuard AI — EU Pay Transparency Compliance & Workforce Intelligence" />
        <meta
          property="og:description"
          content="Benchmark gender pay gaps across the EU27, run payroll-aware compliance reviews under Directive (EU) 2023/970, and export audit-ready evidence packs."
        />
        <meta property="og:image" content={SITE_URL + '/og-image.png'} />

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="WorkforceGuard AI — EU Pay Transparency Compliance & Workforce Intelligence" />
        <meta
          name="twitter:description"
          content="Benchmark gender pay gaps across the EU27, run payroll-aware compliance reviews under Directive (EU) 2023/970, and export audit-ready evidence packs."
        />
        <meta name="twitter:image" content={SITE_URL + '/og-image.png'} />

        <script type="application/ld+json">{JSON.stringify(JSON_LD)}</script>
      </Helmet>

      <div className="landing-bg" aria-hidden="true">
        <div className="landing-bg__mesh" />
        <div className="landing-bg__grid" />
      </div>

      <header ref={navRef} className={`landing-nav ${scrolled ? 'is-scrolled' : ''}`}>
        <div className="landing-nav__inner">
          <div className="landing-nav__brand">
            <LogoMark size={38} className="landing-nav__logo" />
            <span className="landing-nav__wordmark">WorkforceGuard AI</span>
          </div>

          <nav className="landing-nav__links" aria-label="Primary">
            {NAV_LINKS.map((link) => (
              <a key={link.href} href={link.href}>{link.label}</a>
            ))}
          </nav>

          <div className="landing-nav__actions">
            <button className="theme-toggle-btn" onClick={toggleTheme} aria-label="Toggle theme">
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button
              type="button"
              className="landing-cta landing-nav__cta landing-nav__cta--demo"
              onClick={openDemo}
            >
              Request a demo
            </button>
            <Link to="/app" className="landing-cta landing-cta--primary landing-nav__cta">
              Open dashboard <ArrowRight size={15} />
            </Link>
            <button
              className="landing-nav__menu-btn"
              onClick={() => setNavOpen((v) => !v)}
              aria-label={navOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={navOpen}
            >
              {navOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </header>

      <div className={`landing-mobile-nav ${navOpen ? 'is-open' : ''}`} aria-hidden={!navOpen}>
        <nav aria-label="Mobile">
          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href} onClick={closeNav}>{link.label}</a>
          ))}
          <button type="button" className="landing-cta landing-nav__cta--demo" onClick={openDemo}>
            Request a demo
          </button>
          <Link to="/app" className="landing-cta landing-cta--primary" onClick={closeNav}>
            Open dashboard <ArrowRight size={16} />
          </Link>
        </nav>
      </div>

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
              Turn public EU labour-market data and your payroll into decision-ready intelligence —
              gender pay gap benchmarking across all 27 member states, guided compliance review,
              and evidence packs ready for regulators.
            </p>
            <div className="landing-hero__actions">
              <button
                type="button"
                className="landing-cta landing-cta--primary landing-cta--large"
                onClick={openDemo}
              >
                Request a demo <ArrowRight size={18} />
              </button>
              <Link to="/app" className="landing-cta landing-cta--secondary landing-cta--large">
                Open the live dashboard
              </Link>
              <a href="#compliance" className="landing-cta landing-cta--ghost landing-cta--large">
                See compliance mapping
              </a>
            </div>
            <div className="landing-hero__trust">
              <span><Database size={14} /> EU27 · 13 NACE sectors · 2019–2024</span>
              <span><Lock size={14} /> SHA-256 governance log</span>
              <span><FileCheck2 size={14} /> Open methodology</span>
            </div>
          </div>
          <div className="landing-hero__visual">
            <ProductShowcase />
          </div>
        </div>
      </section>

      <section className="landing-stats-band landing-reveal">
        <div className="landing-stats-band__inner">
          {STATS.map((stat) => (
            <div key={stat.value} className="landing-stat">
              <span className="landing-stat__value">{stat.value}</span>
              <span className="landing-stat__label">{stat.label}</span>
              <span className="landing-stat__detail">{stat.detail}</span>
            </div>
          ))}
        </div>
      </section>

      <section id="product" className="landing-section landing-reveal">
        <div className="landing-section__header">
          <p className="landing-section__eyebrow">Product</p>
          <h2>One workspace for intelligence, review, and regulatory evidence</h2>
          <p className="landing-section__lede">
            Six integrated views — from live market signals to hash-chained governance exports —
            designed for compliance teams who need more than a repurposed HR dashboard.
          </p>
        </div>
        <div className="landing-feature-grid">
          {FEATURES.map((feature, i) => (
            <article key={feature.id} className="landing-feature-card">
              <div className="landing-feature-card__body">
                <span className="landing-feature-card__index">{String(i + 1).padStart(2, '0')}</span>
                <feature.icon size={20} className="landing-feature-card__icon" />
                <h3>{feature.title}</h3>
                <p>{feature.desc}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="compliance" className="landing-section landing-section--alt landing-reveal">
        <div className="landing-section__header">
          <p className="landing-section__eyebrow">Compliance mapping</p>
          <h2>Every Directive obligation, mapped to a platform feature</h2>
          <p className="landing-section__lede">
            Directive (EU) 2023/970 is not abstract here — each core requirement has a concrete
            workflow, not a checkbox on a generic HR tool.
          </p>
        </div>
        <div className="landing-compliance-grid">
          {COMPLIANCE_ITEMS.map((item) => (
            <article key={item.requirement} className="landing-compliance-card">
              <p className="landing-compliance-card__requirement">{item.requirement}</p>
              <div className="landing-compliance-card__arrow" aria-hidden="true">
                <ChevronRight size={16} />
              </div>
              <div className="landing-compliance-card__feature">
                <div className="landing-compliance-card__tag">
                  <CheckCircle2 size={14} />
                  <span>{item.feature}</span>
                </div>
                <p>{item.coverage}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section landing-reveal">
        <div className="landing-section__header">
          <p className="landing-section__eyebrow">Built for your team</p>
          <h2>One workspace, three perspectives</h2>
        </div>
        <div className="landing-bento">
          {PERSONAS.map(({ icon: Icon, title, body, span }) => (
            <div key={title} className={`landing-bento__card landing-bento__card--${span}`}>
              <div className="landing-bento__icon"><Icon size={22} /></div>
              <h3>{title}</h3>
              <p>{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="landing-section landing-section--alt landing-reveal">
        <div className="landing-section__header">
          <p className="landing-section__eyebrow">Data &amp; trust</p>
          <h2>EU data sources with provenance on every figure</h2>
        </div>
        <div className="landing-trust-grid">
          {TRUST_ITEMS.map(({ icon: Icon, title, body }) => (
            <div key={title} className="landing-trust-card">
              <div className="landing-trust-card__icon"><Icon size={20} /></div>
              <h3>{title}</h3>
              <p>{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="research" className="landing-section landing-reveal">
        <div className="landing-research">
          <div className="landing-research__copy">
            <p className="landing-section__eyebrow">Research-backed</p>
            <h2>The methodology is published, not proprietary</h2>
            <p>
              WorkforceGuard's composite indices — Hiring Pressure Index, Labour Resilience, and
              Equity Risk Score — are documented in an open research paper analysing a 20-country,
              11-sector, 6-year (2019–2024) Eurostat panel covering the EU27.
            </p>
            <p>
              The five tightest labour markets in the sample all record gender pay gaps above the
              EU27 average of 11.1%. The platform implements these indices over an open dbt/DuckDB
              pipeline ingesting live Eurostat data.
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
              Plots Hiring Pressure Index against Equity Risk Score for 20 EU countries,
              identifying which tight labour markets carry the highest gender pay equity exposure.
            </p>
            <Link to="/app/compare" className="landing-cta landing-cta--secondary">
              Explore the comparison <ChevronRight size={14} />
            </Link>
          </div>
        </div>
      </section>

      <section id="faq" className="landing-section landing-section--alt landing-reveal">
        <div className="landing-section__split">
          <div className="landing-section__header landing-section__header--left">
            <p className="landing-section__eyebrow">FAQ</p>
            <h2>Common questions</h2>
            <p className="landing-section__lede">
              Straight answers about data sources, payroll handling, audit security, and methodology.
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
            Book a tailored walkthrough for your compliance team, or explore live EU labour-market
            data, pay transparency review, and evidence export in the dashboard — no sign-up required.
          </p>
          <div className="landing-cta-section__actions">
            <button
              type="button"
              className="landing-cta landing-cta--primary landing-cta--large"
              onClick={openDemo}
            >
              Request a demo <ArrowRight size={18} />
            </button>
            <Link to="/app" className="landing-cta landing-cta--ghost landing-cta--large">
              Open the live dashboard
            </Link>
          </div>
        </div>
      </section>

      <DemoRequestModal open={demoOpen} onClose={() => setDemoOpen(false)} />

      <footer className="landing-footer">
        <div className="landing-footer__inner">
          <div className="landing-footer__brand">
            <div className="landing-nav__brand">
              <LogoMark size={28} className="landing-nav__logo" />
              <span>WorkforceGuard AI</span>
            </div>
            <p>EU workforce intelligence and pay-transparency compliance for HR, people analytics, and compliance teams.</p>
          </div>
          <div className="landing-footer__cols">
            <div>
              <h4>Product</h4>
              <nav>
                <Link to="/app">Dashboard</Link>
                <Link to="/app/market">Market Intelligence</Link>
                <Link to="/app/pay-analysis">Pay Analysis</Link>
                <Link to="/app/govern">Governance</Link>
              </nav>
            </div>
            <div>
              <h4>Resources</h4>
              <nav>
                <a href="#compliance">Compliance mapping</a>
                <a href="#research">Research</a>
                <a href="#faq">FAQ</a>
                <button type="button" className="landing-footer__link-btn" onClick={openDemo}>Request a demo</button>
                <a href="https://github.com/SVamseekar/workforceguardai" target="_blank" rel="noreferrer">GitHub</a>
              </nav>
            </div>
          </div>
        </div>
        <div className="landing-footer__legal">
          <p>
            WorkforceGuard AI is an analytics and evidence platform. It does not provide legal advice;
            consult qualified counsel for compliance determinations under Directive (EU) 2023/970.
          </p>
        </div>
      </footer>
    </div>
  )
}