import { Link } from 'react-router-dom'
import {
  ArrowRight,
  BookOpen,
  Eye,
  GitBranch,
  HeartHandshake,
  Scale,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { Seo } from '../seo/Seo'
import {
  buildOrganizationSchema,
  buildWebPageSchema,
  buildWebSiteSchema,
} from '../../lib/seo'
import { LandingShell, useLandingDemo } from './LandingShell'

import { useScrollReveal } from './useScrollReveal'
import './landing.css'

const BELIEFS = [
  {
    icon: Eye,
    title: 'Transparency must be provable',
    body: 'A pay gap figure without provenance is an opinion. Every number in WorkforceGuard traces to a Eurostat dataset, version, and formula — so compliance teams can show their work, not just their conclusion.',
  },
  {
    icon: Scale,
    title: 'Equity and labour markets are coupled',
    body: 'Tight hiring conditions do not automatically close gender pay gaps. Our 27-country Eurostat panel (r ≈ +0.44 employment–GPG correlation) shows the opposite in many cases. Intelligence must connect hiring pressure to equity risk, not treat them as separate dashboards.',
  },
  {
    icon: ShieldCheck,
    title: 'Compliance is a workflow, not a checkbox',
    body: 'Directive (EU) 2023/970 asks employers to justify differences, run joint assessments, and retain evidence. That requires approve, override, and reverse decisions with context — recorded in a log regulators can verify years later.',
  },
  {
    icon: BookOpen,
    title: 'Methodology belongs in the open',
    body: 'Composite indices, benchmark formulas, and governance design are documented in our research. Employers should not have to trust a black box for obligations that carry legal weight.',
  },
]

const COMMITMENTS = [
  {
    label: 'Evidence before narrative',
    detail:
      'AI-written summaries sit on top of sourced metrics — never instead of them. Benchmark confidence and provenance travel with every answer.',
  },
  {
    label: 'Payroll stays separated',
    detail:
      'Uploaded compensation data is modelled independently from the public EU reference layer. Your payroll never blends into market tables without explicit intent.',
  },
  {
    label: 'Integrity you can verify',
    detail:
      'Governance events are written to a SHA-256 hash-chained log. Chain integrity is checked on every API call — tampering is detectable, not merely discouraged.',
  },
  {
    label: 'Built for the deadline',
    detail:
      'Member states must transpose the Pay Transparency Directive by 7 June 2026. The platform is shaped around that timeline — reporting, threshold flagging, and exportable evidence packs.',
  },
]

const MISSION_TITLE = 'Our Mission — WorkforceGuard AI'
const MISSION_DESCRIPTION =
  'WorkforceGuard AI exists to make EU pay transparency operational: provable benchmarks, payroll-aware review workflows, and audit-ready evidence under Directive (EU) 2023/970.'

function MissionContent() {
  const { openDemo } = useLandingDemo()
  useScrollReveal()


  return (
    <>
      <Seo
        title={MISSION_TITLE}
        description={MISSION_DESCRIPTION}
        path="/mission"
        jsonLd={[
          buildOrganizationSchema(),
          buildWebSiteSchema(),
          buildWebPageSchema({
            title: MISSION_TITLE,
            description: MISSION_DESCRIPTION,
            path: '/mission',
          }),
        ]}
      />

      <section className="mission-hero landing-reveal">
        <div className="mission-hero__inner">
          <p className="mission-hero__eyebrow">
            <Sparkles size={14} />
            Our mission
          </p>
          <h1>
            Make pay transparency
            <em> enforceable</em>
            — not just reportable
          </h1>
          <p className="mission-hero__lede">
            Equal pay for work of equal value is one of the EU&apos;s founding promises. The Pay
            Transparency Directive turns that promise into an operational obligation: measure gaps,
            justify differences, assess them jointly, and leave a trace that survives scrutiny from
            regulators, employees, and the people who hold the budgets.
          </p>
          <p className="mission-hero__lede mission-hero__lede--secondary">
            WorkforceGuard AI exists to close the gap between the law&apos;s intent and what
            employers can actually defend — by turning public EU labour-market evidence and your own
            payroll into decisions backed by provenance, not spreadsheets assembled under pressure.
          </p>
        </div>
      </section>

      <section className="mission-quote landing-reveal" aria-label="Mission statement">
        <blockquote className="mission-quote__inner">
          <p>
            We are not building another HR dashboard. We are building the evidentiary layer that
            makes pay transparency credible — for compliance teams who will be asked to prove their
            numbers, and for workers whose livelihoods depend on those numbers being fair.
          </p>
        </blockquote>
      </section>

      <section className="landing-section landing-reveal">
        <div className="landing-section__header landing-section__header--left">
          <p className="landing-section__eyebrow">Why we exist</p>
          <h2>The directive changed the question employers must answer</h2>
        </div>
        <div className="mission-prose">
          <p>
            For decades, gender pay gaps were discussed as a statistical fact — averaged, debated,
            and too often filed away. Directive (EU) 2023/970 changes the question. It is no longer
            enough to know that a gap exists. Employers must show whether differences are justified
            by objective, gender-neutral criteria, act when thresholds are crossed, and document
            what was decided and why.
          </p>
          <p>
            Yet the EU27 average unadjusted gap remains 11.1%. In several of the tightest labour
            markets — where competitive pressure was supposed to compress inequality — gaps run
            higher, not lower. Netherlands, Germany, Czechia, Hungary, and Estonia all sit above the
            bloc average despite acute hiring pressure. Disclosure alone has not closed the distance
            between principle and practice.
          </p>
          <p>
            That is the problem we built for. Not to replace legal counsel or national transposition
            nuance, but to give HR, people analytics, and compliance teams a workspace where
            Eurostat-backed benchmarks, payroll-aware review, and hash-chained governance live in
            one place — ready when the first reporting cycle arrives.
          </p>
        </div>
      </section>

      <section className="landing-section landing-section--alt landing-reveal">
        <div className="landing-section__header">
          <p className="landing-section__eyebrow">What we believe</p>
          <h2>Four convictions that shape every feature</h2>
        </div>
        <div className="mission-beliefs">
          {BELIEFS.map(({ icon: Icon, title, body }) => (
            <article key={title} className="mission-belief-card">
              <div className="mission-belief-card__icon">
                <Icon size={22} />
              </div>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section landing-reveal">
        <div className="mission-commit">
          <div className="mission-commit__copy">
            <p className="landing-section__eyebrow">How we work</p>
            <h2>Commitments we hold ourselves to</h2>
            <p className="landing-section__lede">
              Product decisions are filtered through obligations that carry legal and human weight.
              These are not marketing lines — they are constraints on how the platform is built.
            </p>
          </div>
          <ol className="mission-commit__list">
            {COMMITMENTS.map((item) => (
              <li key={item.label} className="mission-commit__item">
                <span className="mission-commit__label">{item.label}</span>
                <p>{item.detail}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="landing-section landing-section--alt landing-reveal">
        <div className="mission-horizon">
          <div className="mission-horizon__icon" aria-hidden="true">
            <HeartHandshake size={28} />
          </div>
          <div className="mission-horizon__copy">
            <p className="landing-section__eyebrow">What we are building toward</p>
            <h2>A Europe where pay equity can be measured, reviewed, and trusted</h2>
            <p>
              June 2026 is a regulatory milestone, not a finish line. Our aim is a durable
              intelligence layer: live Eurostat ingestion, open methodology, tenant-isolated payroll
              analysis, and governance exports that still make sense when auditors ask questions three
              years from now.
            </p>
            <p>
              We publish our methodology — peer-reviewed indices and a research preprint — because the
              standard of proof the Directive implies should not depend on proprietary opacity.
              Employers deserve tools as serious as the obligation they face.
            </p>
            <div className="mission-horizon__links">
              <Link to="/#research" className="landing-cta landing-cta--secondary">
                Read the research <GitBranch size={14} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-cta-section landing-reveal">
        <div className="landing-cta-section__inner">
          <div className="landing-cta-section__glow" aria-hidden="true" />
          <Scale size={28} />
          <h2>Bring this mission into your organisation</h2>
          <p>
            Request a demo for a walkthrough tailored to your reporting obligations and payroll
            countries in scope — or sign in if your team is already provisioned.
          </p>
          <div className="landing-cta-section__actions">
            <Link to="/" className="landing-cta landing-cta--ghost landing-cta--large">
              Back to home
            </Link>
            <Link to="/app" className="landing-cta landing-cta--secondary landing-cta--large">
              Sign in to dashboard
            </Link>
            <button
              type="button"
              className="landing-cta landing-cta--primary landing-cta--large"
              onClick={openDemo}
            >
              Request a demo <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </section>
    </>
  )
}

export function MissionPage() {
  return (
    <LandingShell>
      <MissionContent />
    </LandingShell>
  )
}
