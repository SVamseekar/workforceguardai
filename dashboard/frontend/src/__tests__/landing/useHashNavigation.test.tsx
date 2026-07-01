import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HelmetProvider } from 'react-helmet-async'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LandingPage } from '../../components/landing/LandingPage'

vi.mock('../../lib/api', () => ({
  api: {
    get: vi.fn().mockRejectedValue(new Error('unauthenticated')),
  },
}))

function renderLanding(initialEntry = '/') {
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
        </Routes>
      </MemoryRouter>
    </HelmetProvider>,
  )
}

describe('landing hash navigation', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
    })
    vi.stubGlobal('matchMedia', vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('dark'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })))
    vi.stubGlobal(
      'IntersectionObserver',
      vi.fn().mockImplementation(() => ({
        observe: vi.fn(),
        unobserve: vi.fn(),
        disconnect: vi.fn(),
      })),
    )
    if (!HTMLElement.prototype.scrollIntoView) {
      HTMLElement.prototype.scrollIntoView = () => {}
    }
    vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(() => {})
  })

  it('scrolls to contact when Request a demo is clicked', async () => {
    const user = userEvent.setup()
    renderLanding()

    await user.click(screen.getAllByRole('button', { name: /request a demo/i })[0])

    await waitFor(() => {
      expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalled()
    })
  })

  it('scrolls to compliance when See compliance mapping is clicked', async () => {
    const user = userEvent.setup()
    renderLanding()

    await user.click(screen.getByRole('button', { name: /see compliance mapping/i }))

    await waitFor(() => {
      expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalled()
    })
  })
})
