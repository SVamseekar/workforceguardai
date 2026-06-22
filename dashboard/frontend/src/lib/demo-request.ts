export type DemoRequestInput = {
  firstName: string
  lastName: string
  workEmail: string
  phone: string
  jobTitle: string
  companyName: string
  companyWebsite: string
  companySize: string
  industry: string
  country: string
  headquartersCity: string
  reportingObligation: string
  primaryInterests: string[]
  esgTeamSize: string
  payrollCountries: string
  currentTools: string
  timeline: string
  budgetRange: string
  referralSource: string
  message: string
  marketingConsent: boolean
  privacyConsent: boolean
  website: string
  formStartedAt: number
}

export async function submitDemoRequest(payload: DemoRequestInput): Promise<void> {
  const response = await fetch('/api/request-demo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  const data = await response.json().catch(() => ({})) as { error?: string }

  if (!response.ok) {
    throw new Error(data.error ?? 'Failed to submit demo request')
  }
}