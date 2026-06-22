export type DemoRequestPayload = {
  firstName: string
  lastName: string
  workEmail: string
  phone?: string
  jobTitle: string
  companyName: string
  companyWebsite?: string
  companySize: string
  industry: string
  country: string
  headquartersCity?: string
  reportingObligation: string
  primaryInterests: string[]
  esgTeamSize: string
  payrollCountries?: string
  currentTools?: string
  timeline: string
  budgetRange?: string
  referralSource: string
  message?: string
  marketingConsent: boolean
  privacyConsent: boolean
  website?: string
  formStartedAt?: number
}

export type DemoRequestMeta = {
  submittedAt: string
  userAgent?: string
  referer?: string
  ip?: string
}