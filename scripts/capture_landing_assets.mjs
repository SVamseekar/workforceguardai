#!/usr/bin/env node
/**
 * Capture landing page screenshots from a running dev stack.
 * Prerequisites: backend :8001, frontend :5173, demo tenant seeded.
 *
 *   npm install -D playwright
 *   npx playwright install chromium
 *   DATABASE_URL=... SESSION_SECRET=... node scripts/capture_landing_assets.mjs
 */
import { chromium } from 'playwright'
import { execFileSync } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'dashboard/frontend/public/screenshots')
const BASE = process.env.WG_CAPTURE_BASE ?? 'http://localhost:5173'
const FILTER_QUERY = '?country=CZ&geography=CZ&sector=K&period=latest'

const ROUTES = [
  { file: 'command-centre.png', path: `/app${FILTER_QUERY}`, wait: '[data-testid="overview-loaded"], .app-shell' },
  { file: 'market-intelligence.png', path: `/app/market${FILTER_QUERY}`, wait: '.app-main' },
  { file: 'compare.png', path: `/app/compare${FILTER_QUERY}`, wait: '.app-main' },
  { file: 'pay-analysis.png', path: `/app/pay-analysis${FILTER_QUERY}`, wait: '.app-main, [data-testid="pay-analysis-loaded"]' },
  { file: 'govern-export.png', path: `/app/govern${FILTER_QUERY}`, wait: '.app-main' },
  { file: 'ai-analyst.png', path: `/app${FILTER_QUERY}`, wait: '.app-shell', openCopilot: true },
]

function loadCaptureSession() {
  if (!process.env.DATABASE_URL) {
    console.warn('DATABASE_URL not set — capturing without auth (login screens expected)')
    return null
  }

  const python = process.env.WG_CAPTURE_PYTHON
    ?? path.join(ROOT, 'dashboard/backend/.venv/bin/python')
  const output = execFileSync(python, [path.join(ROOT, 'scripts/seed_capture_session.py')], {
    cwd: ROOT,
    env: process.env,
    encoding: 'utf8',
  })
  return JSON.parse(output.trim())
}

async function main() {
  await mkdir(OUT, { recursive: true })
  const session = loadCaptureSession()

  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })

  if (session) {
    const backendOrigin = new URL(process.env.WG_CAPTURE_API_BASE ?? 'http://127.0.0.1:8001')
    await context.addCookies([
      {
        name: session.cookie_name,
        value: session.cookie_value,
        domain: backendOrigin.hostname,
        path: '/',
        httpOnly: true,
        secure: false,
        sameSite: 'Lax',
      },
      {
        name: session.cookie_name,
        value: session.cookie_value,
        domain: new URL(BASE).hostname,
        path: '/',
        httpOnly: true,
        secure: false,
        sameSite: 'Lax',
      },
    ])
    console.log(`Authenticated as demo tenant ${session.tenant_id}`)
  }

  const page = await context.newPage()

  for (const route of ROUTES) {
    await page.goto(`${BASE}${route.path}`, { waitUntil: 'networkidle', timeout: 90000 })
    await page.waitForSelector(route.wait, { timeout: 45000 }).catch(() => {})
    if (route.openCopilot) {
      const copilotToggle = page.locator('.sidebar__copilot')
      if (await copilotToggle.count()) {
        await copilotToggle.first().click()
        await page.waitForSelector('.copilot-panel', { timeout: 15000 }).catch(() => {})
        const suggestion = page.locator('.analyst-console__chip').first()
        if (await suggestion.count()) {
          await suggestion.click()
          await page.waitForSelector('.analyst-console__response', { timeout: 20000 }).catch(() => {})
        }
        await page.waitForTimeout(1200)
      }
    }
    await page.waitForTimeout(1800)
    await page.screenshot({ path: path.join(OUT, route.file), fullPage: false })
    console.log(`Wrote ${route.file}`)
  }

  await browser.close()
  console.log('Done.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
