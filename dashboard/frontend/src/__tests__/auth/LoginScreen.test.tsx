import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { LoginScreen } from '../../components/auth/LoginScreen'

function renderLogin(initialEntry = '/app') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/app" element={<LoginScreen />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('LoginScreen', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows a friendly message when auth_error is present in the URL', async () => {
    renderLogin('/app?auth_error=cancelled')

    expect(
      screen.getByRole('alert'),
    ).toHaveTextContent(/sign-in was cancelled/i)
  })

  it('shows a network error when the sign-in service is unreachable', async () => {
    const user = userEvent.setup()
    vi.spyOn(global, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'))

    renderLogin()

    await user.click(screen.getByRole('button', { name: /continue with google/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/could not reach the sign-in service/i)
    })
    expect(screen.getByRole('button', { name: /continue with google/i })).toBeEnabled()
  })

  it('redirects to the provider when the API responds with an OAuth redirect', async () => {
    const user = userEvent.setup()
    const assign = vi.fn()
    vi.stubGlobal('location', { ...window.location, assign })
    vi.spyOn(global, 'fetch').mockResolvedValue({
      status: 302,
      type: 'basic',
    } as Response)

    renderLogin()

    await user.click(screen.getByRole('button', { name: /continue with microsoft/i }))

    await waitFor(() => {
      expect(assign).toHaveBeenCalledWith('/api/auth/login/microsoft')
    })
  })

  it('dismisses the alert when the user clicks Dismiss', async () => {
    const user = userEvent.setup()
    renderLogin('/app?auth_error=sign_in_failed')

    expect(screen.getByRole('alert')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /dismiss/i }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})