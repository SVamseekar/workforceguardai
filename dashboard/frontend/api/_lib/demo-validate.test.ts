import { describe, expect, it } from 'vitest'
import { validateDemoRequest } from './demo-validate'

const validPayload = {
  firstName: 'Alex',
  lastName: 'Morgan',
  workEmail: 'alex@acme.eu',
  jobTitle: 'Head of HR',
  companyName: 'Acme GmbH',
  companySize: '250–999 employees',
  industry: 'Financial services & insurance',
  country: 'Germany',
  reportingObligation: 'EU Pay Transparency Directive (2023/970)',
  primaryInterests: ['Gender pay gap benchmarking (EU27)'],
  esgTeamSize: '2–5 people',
  timeline: 'Within 1–3 months',
  referralSource: 'Google search',
  privacyConsent: true,
  marketingConsent: false,
  website: '',
  formStartedAt: Date.now() - 5000,
}

describe('validateDemoRequest', () => {
  it('accepts a complete payload', () => {
    const result = validateDemoRequest(validPayload)
    expect(result.ok).toBe(true)
  })

  it('rejects honeypot submissions', () => {
    const result = validateDemoRequest({ ...validPayload, website: 'https://spam.test' })
    expect(result.ok).toBe(false)
  })

  it('requires at least one interest', () => {
    const result = validateDemoRequest({ ...validPayload, primaryInterests: [] })
    expect(result.ok).toBe(false)
  })
})