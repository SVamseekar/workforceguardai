import { screen, waitFor } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server, MOCK_OVERVIEW } from '../handlers.js'
import { PayAnalysisSection } from '../../components/sections/PayAnalysisSection.jsx'
import { renderInRouter } from '../test-utils'

describe('PayAnalysisSection', () => {
  it('renders Pay Analysis heading after data loads', async () => {
    renderInRouter(<PayAnalysisSection />)
    await waitFor(() => expect(screen.getByText('Pay Analysis')).toBeInTheDocument())
  })

  it('shows "No company data loaded" chip when internal data unavailable', async () => {
    renderInRouter(<PayAnalysisSection />)
    await waitFor(() =>
      expect(screen.getAllByText('No company data loaded').length).toBeGreaterThan(0),
    )
  })

  it('shows representative example notice when internal data unavailable', async () => {
    renderInRouter(<PayAnalysisSection />)
    await waitFor(() =>
      expect(screen.getByText('Representative example')).toBeInTheDocument(),
    )
    expect(screen.getByText(/Upload your data/)).toBeInTheDocument()
  })

  it('renders compliance table when pay_transparency is available', async () => {
    server.use(
      http.get('/api/overview', () =>
        HttpResponse.json({
          ...MOCK_OVERVIEW,
          internal_data: { available: true },
          pay_transparency: {
            available: true,
            summary: { unresolved_review_item_count: 1 },
            categories: [
              { id: 'cat-1', label: 'Senior engineers', gap_value: 8.2, review_state: 'unresolved_review_item', note: 'Requires review.' },
            ],
          },
          governance: {
            available_actions: [{ code: 'approved', label: 'Approve' }],
            logged_events: [],
          },
        }),
      ),
    )

    renderInRouter(<PayAnalysisSection />)
    await waitFor(() =>
      expect(screen.getByText('Pay transparency compliance')).toBeInTheDocument(),
    )
    expect(screen.getByText('Senior engineers')).toBeInTheDocument()
    expect(screen.getByText('Needs review')).toBeInTheDocument()
    expect(screen.queryByText('unresolved_review_item')).not.toBeInTheDocument()
  })

  it('renders Égapro panel when egapro_peer_benchmark is available', async () => {
    server.use(
      http.get('/api/overview', () =>
        HttpResponse.json({
          ...MOCK_OVERVIEW,
          egapro_peer_benchmark: {
            available: true,
            company_count: 120,
            p25_score: 72,
            p50_score: 82,
            p75_score: 91,
            note: 'Sector: Manufacturing.',
          },
        }),
      ),
    )

    renderInRouter(<PayAnalysisSection />)
    await waitFor(() =>
      expect(screen.getByText('France Égapro Index')).toBeInTheDocument(),
    )
    expect(screen.getByText('120 companies')).toBeInTheDocument()
  })
})
