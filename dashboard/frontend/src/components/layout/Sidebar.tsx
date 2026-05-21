import { NavLink } from 'react-router-dom'
import { BarChart2, Home, Scale, ShieldCheck, MessageSquare, GitCompare } from 'lucide-react'
import { useSidebarData } from './SidebarContext'

const NAV_ITEMS = [
  { to: '/', label: 'Home', Icon: Home, end: true },
  { to: '/market', label: 'Market Intelligence', Icon: BarChart2 },
  { to: '/compare', label: 'Compare', Icon: GitCompare },
  { to: '/pay-analysis', label: 'Pay Analysis', Icon: Scale },
  { to: '/govern', label: 'Govern & Export', Icon: ShieldCheck },
]

const TONE_DOT: Record<string, string> = {
  good: 'var(--tone-good)',
  watch: 'var(--tone-watch)',
  neutral: 'var(--text-muted)',
}

export function Sidebar({ onCopilotOpen }: { onCopilotOpen: () => void }) {
  const { geographyLabel, topSignal, governanceEventCount } = useSidebarData()

  return (
    <nav className="sidebar">
      <ul className="sidebar__nav">
        {NAV_ITEMS.map(({ to, label, Icon, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                `sidebar__link${isActive ? ' sidebar__link--active' : ''}`
              }
            >
              <Icon size={18} />
              <span>{label}</span>
              {to === '/govern' && governanceEventCount > 0 && (
                <span className="sidebar__badge">{governanceEventCount}</span>
              )}
            </NavLink>
          </li>
        ))}
      </ul>

      {(geographyLabel || topSignal) && (
        <div className="sidebar__pulse">
          {geographyLabel && (
            <p className="sidebar__pulse-label">Viewing</p>
          )}
          {geographyLabel && (
            <p className="sidebar__pulse-geo">{geographyLabel}</p>
          )}
          {topSignal && (
            <div className="sidebar__pulse-signal">
              <span
                className="sidebar__pulse-dot"
                style={{ background: TONE_DOT[topSignal.tone] ?? 'var(--text-muted)' }}
              />
              <span className="sidebar__pulse-text">{topSignal.title}</span>
              <span className="sidebar__pulse-tone" style={{ color: TONE_DOT[topSignal.tone] ?? 'var(--text-muted)' }}>
                {topSignal.tone === 'good' ? 'Good' : topSignal.tone === 'watch' ? 'Watch' : 'Neutral'}
              </span>
            </div>
          )}
        </div>
      )}

      <div className="sidebar__footer">
        <button className="sidebar__copilot" onClick={onCopilotOpen}>
          <MessageSquare size={18} />
          <span>AI Analyst</span>
        </button>
      </div>
    </nav>
  )
}
