import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderLanding } from './renderLanding'

vi.mock('../../lib/api', () => ({
  api: {
    get: vi.fn().mockRejectedValue(new Error('unauthenticated')),
  },
}))

describe('landing hash and demo navigation', () => {
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

  it('opens the contact page when Request a walkthrough is clicked', async () => {
    const user = userEvent.setup()
    renderLanding('/')

    await user.click(screen.getAllByRole('button', { name: /request a walkthrough/i })[0])

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /book a walkthrough/i })).toBeInTheDocument()
    })
  })

  it('redirects legacy /#research to the research page', async () => {
    renderLanding('/#research')

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /tight labour markets/i })).toBeInTheDocument()
    })
  })

  it('navigates from privacy to research without a blank page', async () => {
    const user = userEvent.setup()
    renderLanding('/privacy')

    expect(screen.getByRole('heading', { level: 1, name: /privacy policy/i })).toBeInTheDocument()

    const researchLinks = screen.getAllByRole('link', { name: /^research$/i })
    await user.click(researchLinks[researchLinks.length - 1])

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /tight labour markets/i })).toBeInTheDocument()
    })
  })

  it('renders the full privacy policy from the top', () => {
    renderLanding('/privacy')

    expect(screen.getByRole('heading', { level: 1, name: /privacy policy/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: /data we collect/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: /your rights/i })).toBeInTheDocument()
  })
})
