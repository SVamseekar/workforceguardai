import { NavLink } from 'react-router-dom'
import { BarChart2, Home, Scale, ShieldCheck, MessageSquare, GitCompare } from 'lucide-react'

const NAV_ITEMS = [
  { to: '/', label: 'Home', Icon: Home, end: true },
  { to: '/market', label: 'Market Intelligence', Icon: BarChart2 },
  { to: '/compare', label: 'Compare', Icon: GitCompare },
  { to: '/pay-analysis', label: 'Pay Analysis', Icon: Scale },
  { to: '/govern', label: 'Govern & Export', Icon: ShieldCheck },
]

export function Sidebar({ onCopilotOpen }: { onCopilotOpen: () => void }) {
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
            </NavLink>
          </li>
        ))}
      </ul>
      <div className="sidebar__footer">
        <button className="sidebar__copilot" onClick={onCopilotOpen}>
          <MessageSquare size={18} />
          <span>AI Analyst</span>
        </button>
      </div>
    </nav>
  )
}
