import { screen, waitFor } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server, MOCK_OVERVIEW } from '../handlers.js'
import { HomeSection } from '../../components/sections/HomeSection.jsx'
import { renderInRouter } from '../test-utils'

describe('HomeSection', () => {
  it('shows loading state initially', () => {
    renderInRouter(<HomeSection />)
    expect(screen.getByRole('status', { name: 'Loading data' })).toBeInTheDocument()
  })

  it('renders Command Centre heading after data loads', async () => {
    renderInRouter(<HomeSection />)
    await waitFor(() => expect(screen.getByText('Command Centre')).toBeInTheDocument())
  })

  it('renders a metric card for each metric in the response', async () => {
    renderInRouter(<HomeSection />)
    await waitFor(() => {
      expect(screen.getByText('Unemployment rate')).toBeInTheDocument()
      expect(screen.getByText('Employment rate')).toBeInTheDocument()
    })
  })

  it('renders Executive Brief section with headline', async () => {
    renderInRouter(<HomeSection />)
    await waitFor(() =>
      expect(screen.getByText('Labour market stable with vacancy pressure')).toBeInTheDocument(),
    )
    expect(screen.getByText('Executive Brief')).toBeInTheDocument()
  })

  it('shows Needs Attention section when watch signals exist', async () => {
    renderInRouter(<HomeSection />)
    await waitFor(() =>
      expect(screen.getByText('Needs Attention')).toBeInTheDocument(),
    )
    expect(screen.getByText('Vacancy rate rising in manufacturing')).toBeInTheDocument()
  })

  it('shows error panel when API fails', async () => {
    server.use(
      http.get('/api/overview', () => HttpResponse.json({ detail: 'err' }, { status: 500 })),
    )

    renderInRouter(<HomeSection />)
    await waitFor(() =>
      expect(screen.getByText('Could not load data')).toBeInTheDocument(),
    )
  })

  it('shows "Unavailable" for a null semantic metric, never a fabricated 0/100', async () => {
    server.use(
      http.get('/api/overview', () => {
        return HttpResponse.json({
          ...MOCK_OVERVIEW,
          semantic_metrics: [
            {
              id: 'transition_readiness',
              title: 'Transition Readiness',
              value: null,
              unit: 'status',
              definition: 'Composite readiness score.',
              implementation_status: 'unavailable',
              evidence_summary: [
                'Selected geography: Germany',
                'Sector scope: All sectors',
                'Underlying hiring pressure or labour resilience unavailable; transition readiness not scored.',
              ],
            },
          ],
        })
      }),
    )

    renderInRouter(<HomeSection />)
    await waitFor(() => expect(screen.getByText('Transition Readiness')).toBeInTheDocument())

    expect(screen.getByText('Unavailable')).toBeInTheDocument()
    expect(screen.queryByText('0/100')).not.toBeInTheDocument()
    expect(
      screen.getByText('Underlying hiring pressure or labour resilience unavailable; transition readiness not scored.'),
    ).toBeInTheDocument()
  })
})
