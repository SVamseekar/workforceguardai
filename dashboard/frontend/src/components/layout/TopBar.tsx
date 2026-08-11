import { useSearchParams } from 'react-router-dom'
import { Sun, Moon, LogOut } from 'lucide-react'
import { LogoMark } from '../shared/LogoMark'
import { useAuth } from '../../hooks/useAuth'

interface TopBarProps {
  theme: 'light' | 'dark'
  onToggleTheme: () => void
}

export function TopBar({ theme, onToggleTheme }: TopBarProps) {
  const [searchParams] = useSearchParams()
  const { user, logout, isAdmin } = useAuth()

  const country = searchParams.get('country') ?? 'All countries'
  const sector = searchParams.get('sector') ?? 'All sectors'
  const period = searchParams.get('period') ?? 'Latest'

  const context = `${country} · ${sector} · ${period}`

  return (
    <header className="topbar">
      <div className="topbar__brand">
        <LogoMark size={24} className="topbar__logo" title="WorkforceGuard" />
      </div>
      <div className="topbar__company">
        <span className="topbar__company-name">WorkforceGuard AI</span>
      </div>
      <div className="topbar__actions">
        <div className="topbar__context">
          <span className="topbar__context-label">{context}</span>
        </div>
        {user && (
          <div
            className="topbar__identity"
            title={`Tenant ${user.tenantId}${
              user.linkedProviders.length
                ? ` · Linked: ${user.linkedProviders.join(', ')}`
                : ''
            }`}
          >
            <span className="topbar__identity-name">
              {user.displayName || user.email || 'Signed in'}
            </span>
            {user.email && user.displayName ? (
              <span className="topbar__identity-email">{user.email}</span>
            ) : null}
            <span className="topbar__identity-meta">
              {isAdmin ? 'Admin' : 'Member'}
              {user.authProvider
                ? ` · via ${user.authProvider === 'google' ? 'Google' : 'Microsoft'}`
                : ''}
            </span>
          </div>
        )}
        <button className="theme-toggle-btn" onClick={onToggleTheme} aria-label="Toggle Theme">
          {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
        </button>
        {user && (
          <button className="topbar__logout" onClick={() => logout()} aria-label="Sign out">
            <LogOut size={16} />
            <span>Sign out</span>
          </button>
        )}
      </div>
    </header>
  )
}
