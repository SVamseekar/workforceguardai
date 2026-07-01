#!/usr/bin/env node
/**
 * Capture landing page screenshots from a running dev stack.
 * Prerequisites: backend :8000, frontend :5173, demo tenant seeded.
 *
 *   npm install -D playwright
 *   npx playwright install chromium
 *   node scripts/capture_landing_assets.mjs
 */
import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'dashboard/frontend/public/screenshots')
const BASE = process.env.WG_CAPTURE_BASE ?? 'http://localhost:5173'

const ROUTES = [
  { file: 'command-centre.png', path: '/app', wait: '[data-testid="overview-loaded"], .app-shell' },
  { file: 'market-intelligence.png', path: '/app/market', wait: '.app-main' },
  { file: 'compare.png', path: '/app/compare', wait: '.app-main' },
  { file: 'pay-analysis.png', path: '/app/pay-analysis', wait: '.app-main' },
  { file: 'govern-export.png', path: '/app/govern', wait: '.app-main' },
]

async function main() {
  await mkdir(OUT, { recursive: true })
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

  for (const route of ROUTES) {
    await page.goto(`${BASE}${route.path}`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForSelector(route.wait, { timeout: 30000 }).catch(() => {})
    await page.waitForTimeout(1500)
    await page.screenshot({ path: path.join(OUT, route.file), fullPage: false })
    console.log(`Wrote ${route.file}`)
  }

  await browser.close()
  console.log('Done. AI analyst screenshot: open copilot manually and re-run with an extended script.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
