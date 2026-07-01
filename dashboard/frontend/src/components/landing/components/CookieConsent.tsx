import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

const STORAGE_KEY = 'wfg-cookie-consent'

export function CookieConsent() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) setVisible(true)
  }, [])

  if (!visible) return null

  const accept = (choice: 'all' | 'essential') => {
    localStorage.setItem(STORAGE_KEY, choice)
    setVisible(false)
  }

  return (
    <div className="landing-cookie" role="dialog" aria-label="Cookie preferences">
      <div className="landing-cookie__inner">
        <p>
          We use essential cookies for sign-in sessions and optional analytics on public pages
          (Google Analytics). See our{' '}
          <Link to="/privacy">Privacy Policy</Link> for details.
        </p>
        <div className="landing-cookie__actions">
          <button type="button" className="landing-cta landing-cta--ghost" onClick={() => accept('essential')}>
            Essential only
          </button>
          <button type="button" className="landing-cta landing-cta--secondary" onClick={() => accept('all')}>
            Accept all
          </button>
        </div>
      </div>
    </div>
  )
}
