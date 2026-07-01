import { useEffect, useState } from 'react'
import { Bot } from 'lucide-react'
import { ANALYST_DEMO_LINES } from '../constants'
import { SectionLabel } from './SectionLabel'
import { SupportEmailLink } from './SupportEmailLink'

export function AnalystDemoTheater() {
  const [index, setIndex] = useState(0)
  const [line, setLine] = useState(0)
  const scene = ANALYST_DEMO_LINES[index]

  useEffect(() => {
    const timer = window.setInterval(() => {
      setLine((prev) => {
        if (prev + 1 >= scene.length) {
          setIndex((i) => (i + 1) % ANALYST_DEMO_LINES.length)
          return 0
        }
        return prev + 1
      })
    }, 2800)
    return () => window.clearInterval(timer)
  }, [scene.length])

  return (
    <section id="demo" className="landing-section landing-reveal">
      <div className="landing-section__header">
        <SectionLabel>See it live</SectionLabel>
        <h2>AI Analyst answers with evidence, not guesswork</h2>
        <p className="landing-section__lede">
          Natural-language questions return sourced metrics, benchmark context, and coverage notes.
        </p>
      </div>

      <div className="landing-demo-theater">
        <div className="landing-demo-theater__header">
          <Bot size={18} />
          <span>AI Analyst · live session</span>
        </div>
        <div className="landing-demo-theater__feed">
          {scene.slice(0, line + 1).map((row, i) => (
            <p key={`${index}-${i}`} className={i === 0 ? 'landing-demo-theater__q' : 'landing-demo-theater__a'}>
              {row}
            </p>
          ))}
        </div>
        <p className="landing-demo-theater__footer">
          Questions? Email <SupportEmailLink className="landing-demo-theater__email" />
        </p>
      </div>
    </section>
  )
}
