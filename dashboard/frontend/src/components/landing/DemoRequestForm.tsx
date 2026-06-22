import { useMemo, useState, type FormEvent } from 'react'
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { submitDemoRequest, type DemoRequestInput } from '../../lib/demo-request'
import {
  BUDGET_RANGES,
  COMPANY_SIZES,
  ESG_TEAM_SIZES,
  EU_COUNTRIES,
  INDUSTRIES,
  PRIMARY_INTERESTS,
  REFERRAL_SOURCES,
  REPORTING_OBLIGATIONS,
  TIMELINES,
} from './demo-form-options'

const EMPTY_FORM: DemoRequestInput = {
  firstName: '',
  lastName: '',
  workEmail: '',
  phone: '',
  jobTitle: '',
  companyName: '',
  companyWebsite: '',
  companySize: '',
  industry: '',
  country: '',
  headquartersCity: '',
  reportingObligation: '',
  primaryInterests: [],
  esgTeamSize: '',
  payrollCountries: '',
  currentTools: '',
  timeline: '',
  budgetRange: '',
  referralSource: '',
  message: '',
  marketingConsent: false,
  privacyConsent: false,
  website: '',
  formStartedAt: Date.now(),
}

type DemoRequestFormProps = {
  onSuccess?: () => void
}

export function DemoRequestForm({ onSuccess }: DemoRequestFormProps) {
  const [form, setForm] = useState<DemoRequestInput>(EMPTY_FORM)
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  const interestSet = useMemo(() => new Set(form.primaryInterests), [form.primaryInterests])

  const updateField = <K extends keyof DemoRequestInput>(key: K, value: DemoRequestInput[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const toggleInterest = (interest: string) => {
    setForm((prev) => {
      const next = new Set(prev.primaryInterests)
      if (next.has(interest)) next.delete(interest)
      else next.add(interest)
      return { ...prev, primaryInterests: [...next] }
    })
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setStatus('submitting')
    setErrorMessage('')

    try {
      await submitDemoRequest(form)
      setStatus('success')
      onSuccess?.()
    } catch (error) {
      setStatus('error')
      setErrorMessage(error instanceof Error ? error.message : 'Something went wrong')
    }
  }

  if (status === 'success') {
    return (
      <div className="demo-form__success" role="status">
        <CheckCircle2 size={32} />
        <h3>Request received</h3>
        <p>
          Thanks — we&apos;ll review your details and get back to you at{' '}
          <strong>{form.workEmail}</strong> within one business day.
        </p>
      </div>
    )
  }

  return (
    <form className="demo-form" onSubmit={handleSubmit} noValidate>
      <p className="demo-form__intro">
        Tell us about your organisation and compliance goals. The more detail you share,
        the better we can tailor your walkthrough.
      </p>

      <fieldset className="demo-form__section">
        <legend>Contact</legend>
        <div className="demo-form__grid demo-form__grid--2">
          <label className="demo-form__field">
            <span>First name <em>*</em></span>
            <input
              required
              autoComplete="given-name"
              value={form.firstName}
              onChange={(e) => updateField('firstName', e.target.value)}
            />
          </label>
          <label className="demo-form__field">
            <span>Last name <em>*</em></span>
            <input
              required
              autoComplete="family-name"
              value={form.lastName}
              onChange={(e) => updateField('lastName', e.target.value)}
            />
          </label>
          <label className="demo-form__field">
            <span>Work email <em>*</em></span>
            <input
              required
              type="email"
              autoComplete="email"
              value={form.workEmail}
              onChange={(e) => updateField('workEmail', e.target.value)}
            />
          </label>
          <label className="demo-form__field">
            <span>Phone</span>
            <input
              type="tel"
              autoComplete="tel"
              placeholder="+49 30 1234567"
              value={form.phone}
              onChange={(e) => updateField('phone', e.target.value)}
            />
          </label>
          <label className="demo-form__field demo-form__field--full">
            <span>Job title <em>*</em></span>
            <input
              required
              autoComplete="organization-title"
              placeholder="e.g. Head of People Analytics"
              value={form.jobTitle}
              onChange={(e) => updateField('jobTitle', e.target.value)}
            />
          </label>
        </div>
      </fieldset>

      <fieldset className="demo-form__section">
        <legend>Organisation</legend>
        <div className="demo-form__grid demo-form__grid--2">
          <label className="demo-form__field">
            <span>Company name <em>*</em></span>
            <input
              required
              autoComplete="organization"
              value={form.companyName}
              onChange={(e) => updateField('companyName', e.target.value)}
            />
          </label>
          <label className="demo-form__field">
            <span>Company website</span>
            <input
              type="url"
              placeholder="https://"
              value={form.companyWebsite}
              onChange={(e) => updateField('companyWebsite', e.target.value)}
            />
          </label>
          <label className="demo-form__field">
            <span>Company size <em>*</em></span>
            <select
              required
              value={form.companySize}
              onChange={(e) => updateField('companySize', e.target.value)}
            >
              <option value="">Select…</option>
              {COMPANY_SIZES.map((size) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </label>
          <label className="demo-form__field">
            <span>Industry <em>*</em></span>
            <select
              required
              value={form.industry}
              onChange={(e) => updateField('industry', e.target.value)}
            >
              <option value="">Select…</option>
              {INDUSTRIES.map((industry) => (
                <option key={industry} value={industry}>{industry}</option>
              ))}
            </select>
          </label>
          <label className="demo-form__field">
            <span>Primary country <em>*</em></span>
            <select
              required
              value={form.country}
              onChange={(e) => updateField('country', e.target.value)}
            >
              <option value="">Select…</option>
              {EU_COUNTRIES.map((country) => (
                <option key={country} value={country}>{country}</option>
              ))}
            </select>
          </label>
          <label className="demo-form__field">
            <span>HQ city</span>
            <input
              placeholder="e.g. Frankfurt"
              value={form.headquartersCity}
              onChange={(e) => updateField('headquartersCity', e.target.value)}
            />
          </label>
        </div>
      </fieldset>

      <fieldset className="demo-form__section">
        <legend>Compliance &amp; scope</legend>
        <div className="demo-form__grid">
          <label className="demo-form__field">
            <span>Primary reporting obligation <em>*</em></span>
            <select
              required
              value={form.reportingObligation}
              onChange={(e) => updateField('reportingObligation', e.target.value)}
            >
              <option value="">Select…</option>
              {REPORTING_OBLIGATIONS.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
          <div className="demo-form__field demo-form__field--full">
            <span>What would you like to see? <em>*</em></span>
            <div className="demo-form__checks">
              {PRIMARY_INTERESTS.map((interest) => (
                <label key={interest} className="demo-form__check">
                  <input
                    type="checkbox"
                    checked={interestSet.has(interest)}
                    onChange={() => toggleInterest(interest)}
                  />
                  <span>{interest}</span>
                </label>
              ))}
            </div>
          </div>
          <label className="demo-form__field">
            <span>ESG / HR / analytics team size <em>*</em></span>
            <select
              required
              value={form.esgTeamSize}
              onChange={(e) => updateField('esgTeamSize', e.target.value)}
            >
              <option value="">Select…</option>
              {ESG_TEAM_SIZES.map((size) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </label>
          <label className="demo-form__field">
            <span>Payroll countries in scope</span>
            <input
              placeholder="e.g. Germany, France, Poland"
              value={form.payrollCountries}
              onChange={(e) => updateField('payrollCountries', e.target.value)}
            />
          </label>
          <label className="demo-form__field demo-form__field--full">
            <span>Current tools (HRIS, analytics, compliance)</span>
            <input
              placeholder="e.g. Workday, Power BI, custom spreadsheets"
              value={form.currentTools}
              onChange={(e) => updateField('currentTools', e.target.value)}
            />
          </label>
        </div>
      </fieldset>

      <fieldset className="demo-form__section">
        <legend>Project details</legend>
        <div className="demo-form__grid demo-form__grid--2">
          <label className="demo-form__field">
            <span>Timeline <em>*</em></span>
            <select
              required
              value={form.timeline}
              onChange={(e) => updateField('timeline', e.target.value)}
            >
              <option value="">Select…</option>
              {TIMELINES.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="demo-form__field">
            <span>Budget range (optional)</span>
            <select
              value={form.budgetRange}
              onChange={(e) => updateField('budgetRange', e.target.value)}
            >
              <option value="">Select…</option>
              {BUDGET_RANGES.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="demo-form__field">
            <span>How did you hear about us? <em>*</em></span>
            <select
              required
              value={form.referralSource}
              onChange={(e) => updateField('referralSource', e.target.value)}
            >
              <option value="">Select…</option>
              {REFERRAL_SOURCES.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="demo-form__field demo-form__field--full">
            <span>Anything else we should know?</span>
            <textarea
              rows={4}
              placeholder="Specific deadlines, stakeholder concerns, data constraints…"
              value={form.message}
              onChange={(e) => updateField('message', e.target.value)}
            />
          </label>
        </div>
      </fieldset>

      <div className="demo-form__consent">
        <label className="demo-form__check">
          <input
            type="checkbox"
            checked={form.privacyConsent}
            onChange={(e) => updateField('privacyConsent', e.target.checked)}
            required
          />
          <span>
            I agree that WorkforceGuard AI may contact me about this demo request and
            process my details to respond. <em>*</em>
          </span>
        </label>
        <label className="demo-form__check">
          <input
            type="checkbox"
            checked={form.marketingConsent}
            onChange={(e) => updateField('marketingConsent', e.target.checked)}
          />
          <span>Keep me updated on product news and EU pay transparency resources.</span>
        </label>
      </div>

      <label className="demo-form__honeypot" aria-hidden="true">
        Website
        <input
          tabIndex={-1}
          autoComplete="off"
          value={form.website}
          onChange={(e) => updateField('website', e.target.value)}
        />
      </label>

      {status === 'error' && (
        <div className="demo-form__error" role="alert">
          <AlertCircle size={18} />
          <span>{errorMessage}</span>
        </div>
      )}

      <button
        type="submit"
        className="landing-cta landing-cta--primary landing-cta--large demo-form__submit"
        disabled={status === 'submitting'}
      >
        {status === 'submitting' ? (
          <>
            <Loader2 size={18} className="demo-form__spin" />
            Sending…
          </>
        ) : (
          'Request demo'
        )}
      </button>
    </form>
  )
}