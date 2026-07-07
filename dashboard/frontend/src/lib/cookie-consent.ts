export const COOKIE_CONSENT_STORAGE_KEY = 'wfg-cookie-consent'

export type CookieConsentChoice = 'all' | 'essential'

export function getCookieConsent(): CookieConsentChoice | null {
  const stored = localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY)
  if (stored === 'all' || stored === 'essential') return stored
  return null
}

export function hasAnalyticsConsent(): boolean {
  return getCookieConsent() === 'all'
}

export const COOKIE_CONSENT_EVENT = 'workforceguard:cookie-consent'
