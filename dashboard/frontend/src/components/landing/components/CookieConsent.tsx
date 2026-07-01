import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

const STORAGE_KEY = 'wfg-cookie-consent'

export function CookieConsent() {
  const [visible, setVisible] = useState(false)
  const [entered, setEntered] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return

    const showTimer = window.setTimeout(() => {
      setVisible(true)
      window.requestAnimationFrame(() => setEntered(true))
    }, 800)

    return () => window.clearTimeout(showTimer)
  }, [])

  if (!visible) return null

  const accept = (choice: 'all' | 'essential') => {
    localStorage.setItem(STORAGE_KEY, choice)
    setEntered(false)
    window.setTimeout(() => setVisible(false), 280)
  }

  return (
    <div className={`landing-cookie${entered ? ' is-visible' : ''}`} role="dialog" aria-modal="true" aria-label="Cookie consent">
      <div className="landing-cookie__backdrop" aria-hidden="true" />
      <div className="landing-cookie__panel">
        <div className="landing-cookie__inner">
          <div className="landing-cookie__copy">
            <h3>We use cookies</h3>
            <p>
              WorkforceGuard uses essential cookies for organisation sign-in and optional analytics
              cookies (Google Analytics) on public pages to understand how visitors use the site.
              Read our <Link to="/privacy">Privacy Policy</Link> for full details.
            </p>
          </div>
          <div className="landing-cookie__actions">
            <button type="button" className="landing-cta landing-cta--ghost" onClick={() => accept('essential')}>
              Reject non-essential
            </button>
            <button type="button" className="landing-cta landing-cta--primary" onClick={() => accept('all')}>
              Accept all cookies
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
