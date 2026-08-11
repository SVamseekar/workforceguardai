import { createContext, useCallback, useEffect, useState, type ReactNode } from 'react'
import { api, setOnUnauthorized } from '../lib/api'

export type AuthProviderName = 'google' | 'microsoft'

export interface AuthUser {
  id: string
  tenantId: string
  role: 'admin' | 'member'
  email: string
  displayName: string
  /** Provider used for the current browser session, if known. */
  authProvider: AuthProviderName | null
  /** All OAuth providers linked to this account. */
  linkedProviders: AuthProviderName[]
}

export interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  refresh: () => Promise<void>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  refresh: async () => {},
  logout: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const response = await api.get('/auth/me')
      const linked = Array.isArray(response.data.linked_providers)
        ? (response.data.linked_providers as string[]).filter(
            (p): p is AuthProviderName => p === 'google' || p === 'microsoft',
          )
        : []
      const authProvider =
        response.data.auth_provider === 'google' || response.data.auth_provider === 'microsoft'
          ? response.data.auth_provider
          : null
      setUser({
        id: response.data.user_id,
        tenantId: response.data.tenant_id,
        role: response.data.role,
        email: response.data.email ?? '',
        displayName: response.data.display_name ?? '',
        authProvider,
        linkedProviders: linked,
      })
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout')
    } catch {
      // Clear local state even if the server call fails
    }
    setUser(null)
  }, [])

  useEffect(() => {
    setOnUnauthorized(() => setUser(null))
    refresh()
  }, [refresh])

  return (
    <AuthContext.Provider value={{ user, loading, refresh, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
