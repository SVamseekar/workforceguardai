import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  COOKIE_CONSENT_STORAGE_KEY,
  getCookieConsent,
  hasAnalyticsConsent,
} from '../../lib/cookie-consent'

describe('cookie consent helpers', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
    })
  })

  it('returns null when consent has not been stored', () => {
    expect(getCookieConsent()).toBeNull()
    expect(hasAnalyticsConsent()).toBe(false)
  })

  it('treats essential-only consent as no analytics', () => {
    vi.mocked(localStorage.getItem).mockReturnValue('essential')
    expect(getCookieConsent()).toBe('essential')
    expect(hasAnalyticsConsent()).toBe(false)
  })

  it('allows analytics only after accept all', () => {
    vi.mocked(localStorage.getItem).mockReturnValue('all')
    expect(getCookieConsent()).toBe('all')
    expect(hasAnalyticsConsent()).toBe(true)
    expect(localStorage.getItem).toHaveBeenCalledWith(COOKIE_CONSENT_STORAGE_KEY)
  })
})
