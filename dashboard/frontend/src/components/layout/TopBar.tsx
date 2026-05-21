import { useSearchParams } from 'react-router-dom'
import { Sun, Moon } from 'lucide-react'
import logo from '../../assets/logos/workforceguard_logo_letters_1773817682347.png'

interface TopBarProps {
  theme: 'light' | 'dark'
  onToggleTheme: () => void
}

export function TopBar({ theme, onToggleTheme }: TopBarProps) {
  const [searchParams] = useSearchParams()

  const country = searchParams.get('country') ?? 'All countries'
  const sector = searchParams.get('sector') ?? 'All sectors'
  const period = searchParams.get('period') ?? 'Latest'

  const context = `${country} · ${sector} · ${period}`

  return (
    <header className="topbar">
      <div className="topbar__brand">
        <img src={logo} alt="WorkforceGuard" className="topbar__logo" />
      </div>
      <div className="topbar__company">
        <span className="topbar__company-name">WorkforceGuard AI</span>
      </div>
      <div className="topbar__actions">
        <div className="topbar__context">
          <span className="topbar__context-label">{context}</span>
        </div>
        <button className="theme-toggle-btn" onClick={onToggleTheme} aria-label="Toggle Theme">
          {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
        </button>
      </div>
    </header>
  )
}
