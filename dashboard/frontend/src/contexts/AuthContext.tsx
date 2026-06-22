import { createContext, useCallback, useEffect, useState, type ReactNode } from 'react'
import { api, setOnUnauthorized } from '../lib/api'

export interface AuthUser {
  id: string
  tenantId: string
  role: 'admin' | 'member'
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
      setUser({
        id: response.data.user_id,
        tenantId: response.data.tenant_id,
        role: response.data.role,
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