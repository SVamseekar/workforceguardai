import { render, screen } from '@testing-library/react'
import { HelmetProvider } from 'react-helmet-async'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SecurityPage } from '../../components/landing/SecurityPage'
import { TranspositionPage } from '../../components/landing/TranspositionPage'

vi.mock('../../lib/api', () => ({
  api: {
    get: vi.fn().mockRejectedValue(new Error('unauthenticated')),
  },
}))

describe('landing trust sections', () => {
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

  it('renders transposition tracker on its own page', () => {
    render(
      <HelmetProvider>
        <MemoryRouter>
          <TranspositionPage />
        </MemoryRouter>
      </HelmetProvider>,
    )

    expect(screen.getAllByText('Transposition tracker').length).toBeGreaterThan(0)
    expect(
      screen.getByRole('heading', {
        level: 2,
        name: /most member states still lack national pay-transparency law/i,
      }),
    ).toBeInTheDocument()
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByText(/Belgium \(Wallonia-Brussels\)/i)).toBeInTheDocument()
  })

  it('renders the security trust centre', () => {
    render(
      <HelmetProvider>
        <MemoryRouter>
          <SecurityPage />
        </MemoryRouter>
      </HelmetProvider>,
    )

    expect(screen.getByRole('heading', { level: 1, name: /what we protect/i })).toBeInTheDocument()
    expect(screen.getByText(/SHA-256/i)).toBeInTheDocument()
  })
})
