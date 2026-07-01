import { useEffect, useState } from 'react'
import { ArrowRight, Bot, Database, ShieldCheck, Sparkles } from 'lucide-react'
import { AI_ANALYST_HIGHLIGHTS, ANALYST_DEMO_SCENES } from '../constants'
import { LANDING_FACTS } from '../landingFacts'
import { SectionLabel } from './SectionLabel'
import { ScreenshotPanel } from './ScreenshotPanel'
import { useLandingDemo } from '../LandingShell'

const PERSONAS = [
  { icon: ShieldCheck, label: 'Compliance & legal' },
  { icon: Database, label: 'People analytics' },
  { icon: Sparkles, label: 'HR & reward' },
]

export function AnalystDemoTheater() {
  const { openDemo } = useLandingDemo()
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(0)
  const scene = ANALYST_DEMO_SCENES[index]

  useEffect(() => {
    setRevealed(0)
    let step = 0
    const maxSteps = 1 + scene.provenance.length + (scene.action ? 1 : 0)
    const timer = window.setInterval(() => {
      step += 1
      if (step <= maxSteps) {
        setRevealed(step)
        return
      }
      window.clearInterval(timer)
      window.setTimeout(() => {
        setIndex((i) => (i + 1) % ANALYST_DEMO_SCENES.length)
      }, 2200)
    }, 900)
    return () => window.clearInterval(timer)
  }, [index, scene.action, scene.provenance.length])

  return (
    <section className="landing-section landing-reveal">
      <div id="demo" className="landing-anchor" tabIndex={-1} />
      <div className="landing-section__header">
        <SectionLabel>See it live</SectionLabel>
        <h2>Ask compliance questions — get sourced answers, not summaries</h2>
        <p className="landing-section__lede">
          Built for compliance leads, people analytics, and HR reward teams preparing for Directive
          (EU) 2023/970. The AI Analyst copilot answers in natural language — with datasets,
          benchmark confidence, and next actions on every response.
        </p>
      </div>

      <div className="landing-demo-stage">
        <div className="landing-demo-stage__chat">
          <div className="landing-demo-stage__chrome">
            <Bot size={16} />
            <span>AI Analyst</span>
            <span className="landing-demo-stage__live">Live · {LANDING_FACTS.demo.tenantLabel}</span>
          </div>

          <div className="landing-demo-stage__personas" aria-label="Typical users">
            {PERSONAS.map(({ icon: Icon, label }) => (
              <span key={label} className="landing-demo-stage__persona">
                <Icon size={14} />
                {label}
              </span>
            ))}
          </div>

          <div className="landing-demo-stage__thread" key={index}>
            <div className="landing-demo-stage__bubble landing-demo-stage__bubble--user">
              <span className="landing-demo-stage__role">{scene.persona}</span>
              <p>{scene.question}</p>
            </div>

            {revealed >= 1 && (
              <div className="landing-demo-stage__bubble landing-demo-stage__bubble--assistant">
                <p>{scene.answer}</p>
                <div className="landing-demo-stage__provenance">
                  {scene.provenance.slice(0, Math.max(0, revealed - 1)).map((row) => (
                    <span key={row.label} className="landing-demo-stage__chip">
                      <strong>{row.label}:</strong> {row.value}
                    </span>
                  ))}
                </div>
                {scene.action && revealed >= scene.provenance.length + 1 && (
                  <p className="landing-demo-stage__action">
                    <ArrowRight size={14} />
                    {scene.action}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="landing-demo-stage__preview">
          <ScreenshotPanel
            src="/screenshots/ai-analyst.png"
            alt="AI Analyst panel with provenance-backed answer"
            label="AI Analyst"
            accentColor="#c9a84c"
            icon={Bot}
          />
          <p className="landing-demo-stage__caption">
            Copilot sits alongside your dashboard filters — answers inherit country, sector, and
            payroll context automatically.
          </p>
          <button type="button" className="landing-cta landing-cta--secondary" onClick={openDemo}>
            See it on your data <ArrowRight size={14} />
          </button>
        </div>
      </div>

      <div className="landing-demo-stage__highlights" aria-label="AI Analyst capabilities">
        {AI_ANALYST_HIGHLIGHTS.map(({ icon: Icon, title, detail }) => (
          <article key={title} className="landing-demo-stage__highlight">
            <div className="landing-demo-stage__highlight-icon">
              <Icon size={18} />
            </div>
            <h3>{title}</h3>
            <p>{detail}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
