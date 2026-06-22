import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { DemoRequestForm } from '../../components/landing/DemoRequestForm'

describe('DemoRequestForm', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('shows success state after a valid submission', async () => {
    const user = userEvent.setup()
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    } as Response)

    render(<DemoRequestForm />)

    await user.type(screen.getByLabelText(/first name/i), 'Alex')
    await user.type(screen.getByLabelText(/last name/i), 'Morgan')
    await user.type(screen.getByLabelText(/work email/i), 'alex@acme.eu')
    await user.type(screen.getByLabelText(/job title/i), 'Head of HR')
    await user.type(screen.getByLabelText(/company name/i), 'Acme GmbH')
    await user.selectOptions(screen.getByLabelText(/company size/i), '250–999 employees')
    await user.selectOptions(screen.getByLabelText(/^industry/i), 'Financial services & insurance')
    await user.selectOptions(screen.getByLabelText(/primary country/i), 'Germany')
    await user.selectOptions(screen.getByLabelText(/primary reporting obligation/i), 'EU Pay Transparency Directive (2023/970)')
    await user.click(screen.getByRole('checkbox', { name: /gender pay gap benchmarking/i }))
    await user.selectOptions(screen.getByLabelText(/team size/i), '2–5 people')
    await user.selectOptions(screen.getByLabelText(/timeline/i), 'Within 1–3 months')
    await user.selectOptions(screen.getByLabelText(/how did you hear/i), 'Google search')
    await user.click(screen.getByRole('checkbox', { name: /agree that workforceguard/i }))

    await user.click(screen.getByRole('button', { name: /request demo/i }))

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(/request received/i)
    })

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/request-demo',
      expect.objectContaining({ method: 'POST' }),
    )
  })
})