import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const nodemailer = require('nodemailer')

const DEFAULT_TO = 'martisoura@gmail.com'
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000
const RATE_LIMIT_MAX = 5
const ipHits = new Map()

function asString(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function asBoolean(value) {
  return value === true || value === 'true' || value === 1 || value === '1'
}

function parseBody(body) {
  if (typeof body === 'string') {
    try {
      return JSON.parse(body)
    } catch {
      return body
    }
  }
  return body
}

function validateDemoRequest(body) {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Invalid request body' }
  }

  if (asString(body.website)) {
    return { ok: false, error: 'Submission rejected' }
  }

  const formStartedAt = Number(body.formStartedAt)
  if (formStartedAt && Date.now() - formStartedAt < 3000) {
    return { ok: false, error: 'Please take a moment to complete the form' }
  }

  const required = [
    'firstName', 'lastName', 'workEmail', 'jobTitle', 'companyName',
    'companySize', 'industry', 'country', 'reportingObligation',
    'esgTeamSize', 'timeline', 'referralSource',
  ]

  for (const field of required) {
    if (!asString(body[field])) {
      return { ok: false, error: `Missing required field: ${field}` }
    }
  }

  const workEmail = asString(body.workEmail)
  if (!EMAIL_RE.test(workEmail)) {
    return { ok: false, error: 'Invalid work email address' }
  }

  if (!asBoolean(body.privacyConsent)) {
    return { ok: false, error: 'Privacy consent is required' }
  }

  const primaryInterests = Array.isArray(body.primaryInterests)
    ? body.primaryInterests.filter((item) => typeof item === 'string').map((s) => s.trim()).filter(Boolean)
    : []

  if (primaryInterests.length === 0) {
    return { ok: false, error: 'Select at least one area of interest' }
  }

  return {
    ok: true,
    data: {
      firstName: asString(body.firstName),
      lastName: asString(body.lastName),
      workEmail,
      phone: asString(body.phone) || undefined,
      jobTitle: asString(body.jobTitle),
      companyName: asString(body.companyName),
      companyWebsite: asString(body.companyWebsite) || undefined,
      companySize: asString(body.companySize),
      industry: asString(body.industry),
      country: asString(body.country),
      headquartersCity: asString(body.headquartersCity) || undefined,
      reportingObligation: asString(body.reportingObligation),
      primaryInterests,
      esgTeamSize: asString(body.esgTeamSize),
      payrollCountries: asString(body.payrollCountries) || undefined,
      currentTools: asString(body.currentTools) || undefined,
      timeline: asString(body.timeline),
      budgetRange: asString(body.budgetRange) || undefined,
      referralSource: asString(body.referralSource),
      message: asString(body.message) || undefined,
      marketingConsent: asBoolean(body.marketingConsent),
    },
  }
}

function buildEmailText(payload, meta) {
  return [
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
    `Primary interests: ${payload.primaryInterests.join(', ')}`,
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
  ].join('\n')
}

async function sendDemoRequestEmail(payload, meta) {
  const to = process.env.DEMO_REQUEST_TO || DEFAULT_TO
  const from = process.env.DEMO_REQUEST_FROM
    || `WorkforceGuard AI <${process.env.SMTP_USER || to}>`

  const subject = `[Demo request] ${payload.companyName} — ${payload.firstName} ${payload.lastName}`
  const text = buildEmailText(payload, meta)

  const host = process.env.SMTP_HOST || 'smtp.gmail.com'
  const port = Number(process.env.SMTP_PORT || 587)
  const user = (process.env.SMTP_USER || '').trim()
  const pass = (process.env.SMTP_PASS || '').replace(/\s+/g, '')

  if (!user || !pass) {
    throw new Error('SMTP_USER and SMTP_PASS are required')
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    tls: { minVersion: 'TLSv1.2' },
  })

  await transporter.sendMail({
    from,
    to,
    replyTo: payload.workEmail,
    subject,
    text,
  })
}

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string') return forwarded.split(',')[0]?.trim()
  if (Array.isArray(forwarded)) return forwarded[0]
  return req.socket?.remoteAddress
}

function isRateLimited(ip) {
  if (!ip) return false
  const now = Date.now()
  const entry = ipHits.get(ip)
  if (!entry || now > entry.resetAt) {
    ipHits.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return false
  }
  entry.count += 1
  return entry.count > RATE_LIMIT_MAX
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    return res.status(204).end()
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const ip = getClientIp(req)
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'Too many requests. Please try again later.' })
  }

  const parsed = validateDemoRequest(parseBody(req.body))
  if (!parsed.ok) {
    return res.status(400).json({ error: parsed.error })
  }

  try {
    await sendDemoRequestEmail(parsed.data, {
      submittedAt: new Date().toISOString(),
      userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
      referer: typeof req.headers.referer === 'string' ? req.headers.referer : undefined,
      ip,
    })
    return res.status(200).json({ ok: true })
  } catch (error) {
    console.error('Demo request email failed:', error)
    return res.status(503).json({
      error: 'Unable to send your request right now. Please email martisoura@gmail.com directly.',
    })
  }
}