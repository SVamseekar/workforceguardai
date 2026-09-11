import { render, screen } from '@testing-library/react'
import { HelmetProvider } from 'react-helmet-async'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SecurityPage } from '../../components/landing/SecurityPage'

describe('SecurityPage', () => {
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

  it('renders honest trust copy including certifications we do not hold', () => {
    render(
      <HelmetProvider>
        <MemoryRouter>
          <SecurityPage />
        </MemoryRouter>
      </HelmetProvider>,
    )

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/do not yet claim/i)
    expect(screen.getByText(/tamper-/i)).toBeInTheDocument()
    expect(screen.getByText(/does not currently hold SOC 2/i)).toBeInTheDocument()
    expect(screen.getByText(/us-central1-f/i)).toBeInTheDocument()
    expect(screen.queryByText(/NEEDS MAINTAINER REVIEW/i)).not.toBeInTheDocument()
  })
})
