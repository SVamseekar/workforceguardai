import { render, screen } from '@testing-library/react'
import { HelmetProvider } from 'react-helmet-async'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DisclaimerPage } from '../../components/landing/DisclaimerPage'
import { RefundsPage } from '../../components/landing/RefundsPage'
import { TermsPage } from '../../components/landing/TermsPage'

vi.mock('../../lib/api', () => ({
  api: {
    get: vi.fn().mockRejectedValue(new Error('unauthenticated')),
  },
}))

function renderLegalPage(page: React.ReactElement) {
  return render(
    <HelmetProvider>
      <MemoryRouter>{page}</MemoryRouter>
    </HelmetProvider>,
  )
}

describe('legal pages', () => {
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
  })

  it('renders terms of service', () => {
    renderLegalPage(<TermsPage />)
    expect(screen.getByRole('heading', { level: 1, name: /terms of service/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: /service scope/i })).toBeInTheDocument()
  })

  it('renders disclaimer with methodology reference', () => {
    renderLegalPage(<DisclaimerPage />)
    expect(screen.getByRole('heading', { level: 1, name: /disclaimer/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: /not legal advice/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /MPRA Paper/i })).toBeInTheDocument()
  })

  it('renders refunds policy', () => {
    renderLegalPage(<RefundsPage />)
    expect(screen.getByRole('heading', { level: 1, name: /refunds policy/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: /demo requests/i })).toBeInTheDocument()
  })
})
