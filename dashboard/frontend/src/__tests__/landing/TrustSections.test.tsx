import { render, screen } from '@testing-library/react'
import { HelmetProvider } from 'react-helmet-async'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LandingPage } from '../../components/landing/LandingPage'

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
    vi.stubGlobal(
      'IntersectionObserver',
      vi.fn().mockImplementation(() => ({
        observe: vi.fn(),
        unobserve: vi.fn(),
        disconnect: vi.fn(),
      })),
    )
  })

  it('renders transposition tracker, partner proof, and security trust sections', () => {
    render(
      <HelmetProvider>
        <MemoryRouter>
          <LandingPage />
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
    expect(screen.getByText(/published research/i)).toBeInTheDocument()
    expect(
      screen.getByRole('heading', {
        level: 2,
        name: /built for sensitive payroll and compliance workflows/i,
      }),
    ).toBeInTheDocument()
    expect(screen.getByText(/SHA-256 governance chain/i)).toBeInTheDocument()
  })
})
