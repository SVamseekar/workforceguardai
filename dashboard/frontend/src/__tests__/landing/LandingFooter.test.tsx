import { render, screen } from '@testing-library/react'
import { HelmetProvider } from 'react-helmet-async'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LandingPage } from '../../components/landing/LandingPage'
import { SITE_TAGLINE } from '../../components/landing/site'

vi.mock('../../lib/api', () => ({
  api: {
    get: vi.fn().mockRejectedValue(new Error('unauthenticated')),
  },
}))

describe('landing footer', () => {
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

  it('shows tagline, platform sections, and legal bar', () => {
    render(
      <HelmetProvider>
        <MemoryRouter>
          <LandingPage />
        </MemoryRouter>
      </HelmetProvider>,
    )

    expect(screen.getByText(SITE_TAGLINE)).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 4, name: /platform/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 4, name: /company/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 4, name: /support/i })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 4, name: /stay informed/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /^about$/i })).not.toBeInTheDocument()
    expect(screen.getByText(/All rights reserved/i)).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /^terms$/i }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: /^disclaimer$/i }).length).toBeGreaterThan(0)
  })
})
