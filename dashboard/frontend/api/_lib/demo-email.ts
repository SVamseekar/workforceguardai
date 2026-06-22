import type { DemoRequestMeta, DemoRequestPayload } from './demo-types'

const DEFAULT_TO = 'martisoura@gmail.com'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function row(label: string, value: string | undefined): string {
  if (!value?.trim()) return ''
  return `<tr><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:13px;width:38%;vertical-align:top;">${escapeHtml(label)}</td><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#0f172a;font-size:13px;">${escapeHtml(value)}</td></tr>`
}

function buildEmailHtml(payload: DemoRequestPayload, meta: DemoRequestMeta): string {
  const interests = payload.primaryInterests.length
    ? payload.primaryInterests.join(', ')
    : 'Not specified'

  const rows = [
    row('Name', `${payload.firstName} ${payload.lastName}`),
    row('Work email', payload.workEmail),
    row('Phone', payload.phone),
    row('Job title', payload.jobTitle),
    row('Company', payload.companyName),
    row('Company website', payload.companyWebsite),
    row('Company size', payload.companySize),
    row('Industry', payload.industry),
    row('Country', payload.country),
    row('HQ city', payload.headquartersCity),
    row('Reporting obligation', payload.reportingObligation),
    row('Primary interests', interests),
    row('ESG / HR team size', payload.esgTeamSize),
    row('Payroll countries', payload.payrollCountries),
    row('Current tools', payload.currentTools),
    row('Timeline', payload.timeline),
    row('Budget range', payload.budgetRange),
    row('How they heard about us', payload.referralSource),
    row('Message', payload.message),
    row('Marketing consent', payload.marketingConsent ? 'Yes' : 'No'),
    row('Submitted at', meta.submittedAt),
    row('Referer', meta.referer),
    row('User agent', meta.userAgent),
    row('IP', meta.ip),
  ].filter(Boolean).join('')

  return `<!DOCTYPE html><html><body style="margin:0;padding:24px;background:#f8fafc;font-family:Inter,Arial,sans-serif;">
    <div style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
      <div style="padding:20px 24px;background:linear-gradient(135deg,#2563eb,#0d9488);color:#fff;">
        <h1 style="margin:0;font-size:20px;">New WorkforceGuard demo request</h1>
        <p style="margin:8px 0 0;font-size:14px;opacity:0.9;">${escapeHtml(payload.companyName)} · ${escapeHtml(payload.workEmail)}</p>
      </div>
      <table style="width:100%;border-collapse:collapse;">${rows}</table>
    </div>
  </body></html>`
}

function buildEmailText(payload: DemoRequestPayload, meta: DemoRequestMeta): string {
  const lines = [
    'New WorkforceGuard demo request',
    '',
    `Name: ${payload.firstName} ${payload.lastName}`,
    `Work email: ${payload.workEmail}`,
    `Phone: ${payload.phone || '—'}`,
    `Job title: ${payload.jobTitle}`,
    `Company: ${payload.companyName}`,
    `Company website: ${payload.companyWebsite || '—'}`,
    `Company size: ${payload.companySize}`,
    `Industry: ${payload.industry}`,
    `Country: ${payload.country}`,
    `HQ city: ${payload.headquartersCity || '—'}`,
    `Reporting obligation: ${payload.reportingObligation}`,
    `Primary interests: ${payload.primaryInterests.join(', ') || '—'}`,
    `ESG / HR team size: ${payload.esgTeamSize}`,
    `Payroll countries: ${payload.payrollCountries || '—'}`,
    `Current tools: ${payload.currentTools || '—'}`,
    `Timeline: ${payload.timeline}`,
    `Budget range: ${payload.budgetRange || '—'}`,
    `Referral source: ${payload.referralSource}`,
    `Message: ${payload.message || '—'}`,
    `Marketing consent: ${payload.marketingConsent ? 'Yes' : 'No'}`,
    '',
    `Submitted at: ${meta.submittedAt}`,
    `Referer: ${meta.referer || '—'}`,
    `User agent: ${meta.userAgent || '—'}`,
    `IP: ${meta.ip || '—'}`,
  ]
  return lines.join('\n')
}

async function sendViaResend(
  to: string,
  from: string,
  subject: string,
  html: string,
  text: string,
  replyTo?: string,
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) throw new Error('RESEND_API_KEY is not configured')

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      html,
      text,
      reply_to: replyTo,
    }),
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`Resend API error (${response.status}): ${detail}`)
  }
}

async function sendViaSmtp(
  to: string,
  from: string,
  subject: string,
  html: string,
  text: string,
  replyTo?: string,
): Promise<void> {
  const host = process.env.SMTP_HOST ?? 'smtp.gmail.com'
  const port = Number(process.env.SMTP_PORT ?? 587)
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS

  if (!user || !pass) {
    throw new Error('SMTP_USER and SMTP_PASS are required when RESEND_API_KEY is not set')
  }

  const nodemailer = await import('nodemailer')
  const transport = nodemailer.default ?? nodemailer
  const transporter = transport.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  })

  await transporter.sendMail({
    from,
    to,
    replyTo: replyTo || user,
    subject,
    html,
    text,
  })
}

export async function sendDemoRequestEmail(
  payload: DemoRequestPayload,
  meta: DemoRequestMeta,
): Promise<void> {
  const to = process.env.DEMO_REQUEST_TO ?? DEFAULT_TO
  const from = process.env.DEMO_REQUEST_FROM
    ?? (process.env.SMTP_USER ? `WorkforceGuard AI <${process.env.SMTP_USER}>` : 'WorkforceGuard AI <onboarding@resend.dev>')

  const subject = `[Demo request] ${payload.companyName} — ${payload.firstName} ${payload.lastName}`
  const html = buildEmailHtml(payload, meta)
  const text = buildEmailText(payload, meta)

  if (process.env.RESEND_API_KEY) {
    await sendViaResend(to, from, subject, html, text, payload.workEmail)
    return
  }

  await sendViaSmtp(to, from, subject, html, text, payload.workEmail)
}