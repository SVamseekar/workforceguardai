import type { VercelRequest, VercelResponse } from '@vercel/node'
import { sendDemoRequestEmail } from './_lib/demo-email'
import { validateDemoRequest } from './_lib/demo-validate'

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000
const RATE_LIMIT_MAX = 5
const ipHits = new Map<string, { count: number; resetAt: number }>()

function getClientIp(req: VercelRequest): string | undefined {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string') return forwarded.split(',')[0]?.trim()
  if (Array.isArray(forwarded)) return forwarded[0]
  return req.socket?.remoteAddress
}

function isRateLimited(ip: string | undefined): boolean {
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
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

  const parsed = validateDemoRequest(req.body)
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