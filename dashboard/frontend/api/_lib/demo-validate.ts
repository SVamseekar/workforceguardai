import type { DemoRequestPayload } from './demo-types'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const REQUIRED_STRING_FIELDS: Array<keyof DemoRequestPayload> = [
  'firstName',
  'lastName',
  'workEmail',
  'jobTitle',
  'companyName',
  'companySize',
  'industry',
  'country',
  'reportingObligation',
  'esgTeamSize',
  'timeline',
  'referralSource',
]

const MAX_LENGTH: Partial<Record<keyof DemoRequestPayload, number>> = {
  firstName: 80,
  lastName: 80,
  workEmail: 254,
  phone: 40,
  jobTitle: 120,
  companyName: 160,
  companyWebsite: 200,
  headquartersCity: 120,
  payrollCountries: 300,
  currentTools: 300,
  message: 4000,
  website: 200,
}

export type ValidationResult =
  | { ok: true; data: DemoRequestPayload }
  | { ok: false; error: string }

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function asBoolean(value: unknown): boolean {
  return value === true || value === 'true' || value === 1 || value === '1'
}

export function validateDemoRequest(body: unknown): ValidationResult {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Invalid request body' }
  }

  const raw = body as Record<string, unknown>

  if (asString(raw.website)) {
    return { ok: false, error: 'Submission rejected' }
  }

  const formStartedAt = Number(raw.formStartedAt)
  if (formStartedAt && Date.now() - formStartedAt < 3000) {
    return { ok: false, error: 'Please take a moment to complete the form' }
  }

  for (const field of REQUIRED_STRING_FIELDS) {
    if (!asString(raw[field])) {
      return { ok: false, error: `Missing required field: ${field}` }
    }
  }

  const workEmail = asString(raw.workEmail)
  if (!EMAIL_RE.test(workEmail)) {
    return { ok: false, error: 'Invalid work email address' }
  }

  if (!asBoolean(raw.privacyConsent)) {
    return { ok: false, error: 'Privacy consent is required' }
  }

  const primaryInterests = Array.isArray(raw.primaryInterests)
    ? raw.primaryInterests.filter((item): item is string => typeof item === 'string').map((s) => s.trim()).filter(Boolean)
    : []

  if (primaryInterests.length === 0) {
    return { ok: false, error: 'Select at least one area of interest' }
  }

  if (primaryInterests.length > 12) {
    return { ok: false, error: 'Too many interests selected' }
  }

  const data: DemoRequestPayload = {
    firstName: asString(raw.firstName),
    lastName: asString(raw.lastName),
    workEmail,
    phone: asString(raw.phone) || undefined,
    jobTitle: asString(raw.jobTitle),
    companyName: asString(raw.companyName),
    companyWebsite: asString(raw.companyWebsite) || undefined,
    companySize: asString(raw.companySize),
    industry: asString(raw.industry),
    country: asString(raw.country),
    headquartersCity: asString(raw.headquartersCity) || undefined,
    reportingObligation: asString(raw.reportingObligation),
    primaryInterests,
    esgTeamSize: asString(raw.esgTeamSize),
    payrollCountries: asString(raw.payrollCountries) || undefined,
    currentTools: asString(raw.currentTools) || undefined,
    timeline: asString(raw.timeline),
    budgetRange: asString(raw.budgetRange) || undefined,
    referralSource: asString(raw.referralSource),
    message: asString(raw.message) || undefined,
    marketingConsent: asBoolean(raw.marketingConsent),
    privacyConsent: true,
    formStartedAt: Number.isFinite(formStartedAt) ? formStartedAt : undefined,
  }

  for (const [field, max] of Object.entries(MAX_LENGTH)) {
    const value = data[field as keyof DemoRequestPayload]
    if (typeof value === 'string' && value.length > max) {
      return { ok: false, error: `${field} is too long` }
    }
  }

  return { ok: true, data }
}