import { createContext, useEffect, useState, type ReactNode } from 'react'
import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api'

export interface AuthUser {
  id: string
  tenantId: string
  role: 'admin' | 'member'
}

export interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  refresh: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  refresh: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = async () => {
    setLoading(true)
    try {
      const response = await axios.get(`${API_BASE}/auth/me`, { withCredentials: true })
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
  }

  useEffect(() => {
    refresh()
  }, [])

  return <AuthContext.Provider value={{ user, loading, refresh }}>{children}</AuthContext.Provider>
}