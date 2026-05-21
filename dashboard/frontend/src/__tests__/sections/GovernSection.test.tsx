import { screen, waitFor } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server, MOCK_OVERVIEW } from '../handlers.js'
import { GovernSection } from '../../components/sections/GovernSection.jsx'
import { renderInRouter } from '../test-utils'

describe('GovernSection', () => {
  it('renders Govern & Export heading after data loads', async () => {
    renderInRouter(<GovernSection />)
    await waitFor(() => expect(screen.getByText('Govern & Export')).toBeInTheDocument())
  })

  it('renders governance log with "Reviewed by" column header — not "Actor"', async () => {
    server.use(
      http.get('/api/overview', () =>
        HttpResponse.json({
          ...MOCK_OVERVIEW,
          governance: {
            logged_events: [
              {
                action_code: 'approved',
                target_type: 'pay_category',
                target_id: 'cat-1',
                actor: 'dashboard-user',
                recorded_at: '2026-04-01T10:00:00Z',
              },
            ],
            available_actions: [],
          },
        }),
      ),
    )

    renderInRouter(<GovernSection />)
    await waitFor(() => expect(screen.getByText('Reviewed by')).toBeInTheDocument())
    expect(screen.queryByRole('columnheader', { name: 'Actor' })).not.toBeInTheDocument()
    expect(screen.getByText('Approved')).toBeInTheDocument()
  })

  it('shows empty state message when no events logged', async () => {
    renderInRouter(<GovernSection />)
    await waitFor(() =>
      expect(screen.getByText(/No decisions logged yet/)).toBeInTheDocument(),
    )
  })

  it('renders evidence pack download button', async () => {
    renderInRouter(<GovernSection />)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Download Evidence Pack/i })).toBeInTheDocument(),
    )
  })

  it('renders workflow automation section when workflows exist', async () => {
    server.use(
      http.get('/api/overview', () =>
        HttpResponse.json({
          ...MOCK_OVERVIEW,
          automation: {
            configured_schedules: [{ id: 'wf-1', label: 'Weekly brief', status: 'active', cadence: 'weekly' }],
            scheduled_briefs: [],
            pending_handoffs: [],
          },
        }),
      ),
    )

    renderInRouter(<GovernSection />)
    await waitFor(() => expect(screen.getByText('Scheduled workflows')).toBeInTheDocument())
    expect(screen.getByText('Weekly brief')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Run now/i })).toBeInTheDocument()
  })
})
