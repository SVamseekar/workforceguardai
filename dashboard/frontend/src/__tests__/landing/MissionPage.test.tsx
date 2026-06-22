import { render, screen } from '@testing-library/react'
import { HelmetProvider } from 'react-helmet-async'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MissionPage } from '../../components/landing/MissionPage'

describe('MissionPage', () => {
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

  it('renders the mission headline and convictions', () => {
    render(
      <HelmetProvider>
        <MemoryRouter>
          <MissionPage />
        </MemoryRouter>
      </HelmetProvider>,
    )

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/enforceable/i)
    expect(screen.getByText(/Transparency must be provable/i)).toBeInTheDocument()
    expect(screen.getByText(/Methodology belongs in the open/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /our mission/i })).toHaveAttribute('href', '/mission')
  })
})