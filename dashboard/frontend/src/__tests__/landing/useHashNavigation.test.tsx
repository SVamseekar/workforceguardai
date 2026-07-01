import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HelmetProvider } from 'react-helmet-async'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LandingPage } from '../../components/landing/LandingPage'
import { PrivacyPage } from '../../components/landing/PrivacyPage'

vi.mock('../../lib/api', () => ({
  api: {
    get: vi.fn().mockRejectedValue(new Error('unauthenticated')),
  },
}))

function renderRoutes(initialEntry = '/') {
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
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
    renderRoutes()

    await user.click(screen.getAllByRole('button', { name: /request a demo/i })[0])

    await waitFor(() => {
      expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalled()
    })
  })

  it('scrolls to compliance when See compliance mapping is clicked', async () => {
    const user = userEvent.setup()
    renderRoutes()

    await user.click(screen.getByRole('button', { name: /see compliance mapping/i }))

    await waitFor(() => {
      expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalled()
    })
  })

  it('navigates from privacy to home research section without a blank page', async () => {
    const user = userEvent.setup()
    renderRoutes('/privacy')

    expect(screen.getByRole('heading', { level: 1, name: /privacy policy/i })).toBeInTheDocument()

    const researchLinks = screen.getAllByRole('link', { name: /^research$/i })
    await user.click(researchLinks[researchLinks.length - 1])

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2, name: /tight labour markets/i })).toBeInTheDocument()
    })
    expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalled()
  })

  it('renders the full privacy policy from the top', () => {
    renderRoutes('/privacy')

    expect(screen.getByRole('heading', { level: 1, name: /privacy policy/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: /data we collect/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: /your rights/i })).toBeInTheDocument()
  })
})
