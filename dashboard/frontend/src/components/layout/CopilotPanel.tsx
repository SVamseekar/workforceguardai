import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import axios from 'axios'
import { X, Send } from 'lucide-react'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api'

const SUGGESTED_QUESTIONS = [
  'How does this market compare to the EU average?',
  'Which peer countries look most similar?',
  'What changed versus the prior period?',
  'Which signal is worsening fastest?',
  'How confident is this benchmark?',
  'What limits this comparison?',
]

export function CopilotPanel({ onClose }) {
  const [searchParams] = useSearchParams()
  const [question, setQuestion] = useState('')
  const [response, setResponse] = useState(null)
  const [asking, setAsking] = useState(false)

  const filterContext = {
    country: searchParams.get('country') ?? 'ALL',
    geography: searchParams.get('geography') ?? 'EU27_AVG',
    sector: searchParams.get('sector') ?? 'ALL',
    period: searchParams.get('period') ?? 'latest',
    benchmark_geography: searchParams.get('benchmark_geography') ?? null,
    benchmark_sector: searchParams.get('benchmark_sector') ?? null,
  }

  async function submitQuestion(q) {
    const prompt = q.trim()
    if (!prompt || asking) return
    setAsking(true)
    try {
      const result = await axios.post(`${API_BASE}/ask`, { question: prompt, ...filterContext })
      setResponse(result.data)
    } catch {
      setResponse({ answer: 'Could not get a response. Please try again.' })
    } finally {
      setAsking(false)
    }
  }

  function handleSubmit(e) {
    e.preventDefault()
    submitQuestion(question)
  }

  return (
    <>
      <div
        className="evidence-drawer__backdrop"
        onClick={onClose}
        role="button"
        aria-label="Close AI Analyst"
      />
      <aside className="copilot-panel">
        <div className="copilot-panel__header">
          <div>
            <p className="panel__eyebrow">AI Analyst</p>
            <h2>Ask about this view</h2>
          </div>
          <button className="evidence-drawer__close" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <form className="copilot-panel__form" onSubmit={handleSubmit}>
          <div className="analyst-console__controls">
            <input
              className="analyst-console__input"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask a question about the current data…"
              disabled={asking}
            />
            <button className="analyst-console__button" type="submit" disabled={asking}>
              <Send size={16} />
            </button>
          </div>
        </form>

        {!response && (
          <div className="analyst-console__suggestions">
            {SUGGESTED_QUESTIONS.map((q) => (
              <button
                key={q}
                className="analyst-console__chip"
                onClick={() => submitQuestion(q)}
                disabled={asking}
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {response && (
          <div className="analyst-console__response">
            <p className="analyst-console__question">Response</p>
            <h3 className="analyst-console__response-top">{response.answer}</h3>
            {response.follow_ups?.length > 0 && (
              <div className="analyst-console__follow-ups">
                {response.follow_ups.slice(0, 3).map((fq) => (
                  <button
                    key={fq}
                    className="analyst-console__follow-up"
                    onClick={() => submitQuestion(fq)}
                    disabled={asking}
                  >
                    {fq}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </aside>
    </>
  )
}
