import React from 'react'
import { waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { renderInRouter } from './test-utils'
import { http, HttpResponse } from 'msw'
import { server, MOCK_OVERVIEW } from './handlers.js'
import { HomeSection } from '../components/sections/HomeSection.jsx'
import { MarketSection } from '../components/sections/MarketSection.jsx'
import { PayAnalysisSection } from '../components/sections/PayAnalysisSection.jsx'
import { GovernSection } from '../components/sections/GovernSection.jsx'

const BANNED_TERMS = [
  'observed_gap',
  'unresolved_review_item',
  'justified_difference',
  'internal mart active',
  'internal mart inactive',
  'external-only answers',
  'evidence_basis',
  'snapshot_date',
  'source_id',
  'eurostat_lfs',
  'eurostat_jvs',
  'eurostat_ses',
]

const RICH_OVERVIEW = {
  ...MOCK_OVERVIEW,
  internal_data: { available: true, note: 'internal mart active' },
  company_benchmark: {
    available: true,
    internal_value: 11.2,
    market_value: 13.4,
    female_count: 120,
    male_count: 130,
    headcount: 250,
    confidence: 'low',
    coverage_status: 'partial',
    evidence_basis: 'blended',
    snapshot_date: '2024-12-31',
    delta_label: '2.2 pts below market',
    worker_category: { label: 'All employees' },
    note: 'Blended basis.',
  },
  pay_transparency: {
    available: true,
    summary: { unresolved_review_item_count: 1 },
    categories: [
      { id: 'cat-1', label: 'Senior engineers', gap_value: 8.2, review_state: 'unresolved_review_item', note: '' },
      { id: 'cat-2', label: 'Junior staff', gap_value: 2.1, review_state: 'justified_difference', note: '' },
    ],
  },
  governance: {
    logged_events: [
      { action_code: 'approved', target_type: 'pay_category', target_id: 'cat-1', actor: 'dashboard-user', recorded_at: '2026-04-01T10:00:00Z' },
    ],
    available_actions: [],
  },
}

function renderSection(Section: React.ComponentType) {
  const { container } = renderInRouter(<Section />)
  return container
}

describe('Copy standards — no backend terms in user-facing text', () => {
  beforeEach(() => {
    server.use(http.get('/api/overview', () => HttpResponse.json(RICH_OVERVIEW)))
  })

  for (const Section of [HomeSection, MarketSection, PayAnalysisSection, GovernSection]) {
    it(`${Section.name}: renders without exposing backend terms`, async () => {
      const container = renderSection(Section)

      await waitFor(() => {
        const text = container.textContent ?? ''
        expect(text).not.toMatch(/Loading…/)
      })

      const text = container.textContent ?? ''

      for (const term of BANNED_TERMS) {
        expect(text, `"${term}" found in ${Section.name} output`).not.toContain(term)
      }
    })
  }
})
