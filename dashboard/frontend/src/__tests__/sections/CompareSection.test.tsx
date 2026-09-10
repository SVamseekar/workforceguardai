import { screen, waitFor } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server, MOCK_OVERVIEW } from '../handlers.js'
import { CompareSection } from '../../components/sections/CompareSection.jsx'
import { renderInRouter } from '../test-utils'

describe('CompareSection', () => {
  it('renders a coverage note for a metric with unavailable coverage, never a silent 0.0%', async () => {
    server.use(
      http.get('/api/overview', () =>
        HttpResponse.json({
          ...MOCK_OVERVIEW,
          metrics: [
            {
              id: 'vacancy_rate',
              title: 'Vacancy rate',
              value: null,
              unit: '%',
              period: 'Q4 2024',
              coverage: {
                status: 'unavailable',
                grain: 'country',
                note: 'No observed data is available for the current filter state.',
              },
            },
          ],
        }),
      ),
    )

    renderInRouter(<CompareSection />)

    await waitFor(() => expect(screen.getAllByText('Vacancy rate').length).toBeGreaterThan(0))
    expect(screen.getAllByText(/^—$/).length).toBeGreaterThan(0)
    expect(
      screen.getAllByText(/Unavailable: No observed data is available for the current filter state\./).length,
    ).toBeGreaterThan(0)
  })

  it('renders a partial-coverage note for an EU27 proxy-average metric', async () => {
    server.use(
      http.get('/api/overview', () =>
        HttpResponse.json({
          ...MOCK_OVERVIEW,
          metrics: [
            {
              id: 'unemployment_rate',
              title: 'Unemployment rate',
              value: 6.2,
              unit: '%',
              period: 'Q4 2024',
              coverage: {
                status: 'partial',
                grain: 'country',
                note: 'EU-wide scope is shown as a proxy average across country observations.',
              },
            },
          ],
        }),
      ),
    )

    renderInRouter(<CompareSection />)

    await waitFor(() => expect(screen.getAllByText('Unemployment rate').length).toBeGreaterThan(0))
    expect(
      screen.getAllByText(/Partial coverage: EU-wide scope is shown as a proxy average/).length,
    ).toBeGreaterThan(0)
  })
})
