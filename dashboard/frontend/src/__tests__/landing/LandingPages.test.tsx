import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderLanding } from './renderLanding'

vi.mock('../../lib/api', () => ({
  api: {
    get: vi.fn().mockRejectedValue(new Error('unauthenticated')),
  },
}))

describe('marketing pages', () => {
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

  it('home is a hub, not a long-scroll of every section', () => {
    renderLanding('/')
    expect(screen.getByRole('heading', { level: 1, name: /pay-gap heat for human review/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: /each topic on its own page/i })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 2, name: /most member states still lack/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 2, name: /what we calculate vs what only counsel/i })).not.toBeInTheDocument()
  })

  it('pay-gap heat page states the calculator limits', () => {
    renderLanding('/pay-gap-heat')
    expect(screen.getByRole('heading', { level: 1, name: /first look/i })).toBeInTheDocument()
    expect(screen.getByText(/you assign job codes to worker categories/i)).toBeInTheDocument()
    expect(screen.getByText(/never read as/i)).toBeInTheDocument()
  })

  it('directive page refuses a compliance certificate', () => {
    renderLanding('/directive')
    expect(screen.getByText(/not in the product/i)).toBeInTheDocument()
    expect(screen.getByText(/no output says you are or are not compliant/i)).toBeInTheDocument()
  })

  it('transposition tracker lives on its own route', () => {
    renderLanding('/transposition')
    expect(screen.getAllByText('Transposition tracker').length).toBeGreaterThan(0)
    expect(
      screen.getByRole('heading', {
        level: 2,
        name: /most member states still lack national pay-transparency law/i,
      }),
    ).toBeInTheDocument()
    expect(screen.getByRole('table')).toBeInTheDocument()
  })

  it('research page keeps the Eurostat panel claim', () => {
    renderLanding('/research')
    expect(screen.getByRole('heading', { level: 1, name: /tight labour markets/i })).toBeInTheDocument()
  })

  it('faq answers the compliance question honestly', () => {
    renderLanding('/faq')
    expect(screen.getByText(/does workforceguard say my company is directive-compliant/i)).toBeInTheDocument()
  })

  it('navigates from home hub to pay-gap heat', async () => {
    const user = userEvent.setup()
    renderLanding('/')
    await user.click(screen.getAllByRole('link', { name: /pay-gap heat/i })[0])
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /first look/i })).toBeInTheDocument()
    })
  })
})
