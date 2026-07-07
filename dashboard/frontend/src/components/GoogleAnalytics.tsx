import { useEffect } from 'react'
import {
  COOKIE_CONSENT_EVENT,
  hasAnalyticsConsent,
} from '../lib/cookie-consent'

const GA_MEASUREMENT_ID =
  import.meta.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() || ''

function loadGoogleAnalytics() {
  if (!GA_MEASUREMENT_ID || !import.meta.env.PROD || !hasAnalyticsConsent()) return

  const src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`
  if (document.querySelector(`script[src="${src}"]`)) return

  const gtagScript = document.createElement('script')
  gtagScript.async = true
  gtagScript.src = src
  document.head.appendChild(gtagScript)

  const configScript = document.createElement('script')
  configScript.textContent = `
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', '${GA_MEASUREMENT_ID}');
  `
  document.head.appendChild(configScript)
}

export function GoogleAnalytics() {
  useEffect(() => {
    loadGoogleAnalytics()

    const onConsent = () => loadGoogleAnalytics()
    window.addEventListener(COOKIE_CONSENT_EVENT, onConsent)
    return () => window.removeEventListener(COOKIE_CONSENT_EVENT, onConsent)
  }, [])

  return null
}
