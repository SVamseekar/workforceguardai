// dashboard/frontend/src/__tests__/auth/AuthContext.test.tsx
import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import axios from 'axios'
import { AuthProvider } from '../../contexts/AuthContext'
import { useAuth } from '../../hooks/useAuth'

vi.mock('axios')

function Probe() {
  const { user, loading } = useAuth()
  if (loading) return <div>loading</div>
  return <div>{user ? `signed-in:${user.role}` : 'signed-out'}</div>
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('renders signed-in state when /api/auth/me succeeds', async () => {
    ;(axios.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { user_id: 'u1', tenant_id: 't1', role: 'admin' },
    })

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    )

    await waitFor(() => expect(screen.getByText('signed-in:admin')).toBeInTheDocument())
  })

  it('renders signed-out state when /api/auth/me returns 401', async () => {
    ;(axios.get as ReturnType<typeof vi.fn>).mockRejectedValue({ response: { status: 401 } })

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    )

    await waitFor(() => expect(screen.getByText('signed-out')).toBeInTheDocument())
  })
})