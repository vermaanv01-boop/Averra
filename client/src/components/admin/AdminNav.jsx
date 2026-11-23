import { NavLink } from 'react-router-dom'
import { cn } from '../../utils/cn.js'

const links = [
  { to: '/app/admin', label: 'Overview', end: true },
  { to: '/app/admin/users', label: 'Users' },
  { to: '/app/admin/reviews', label: 'Reviews' },
  { to: '/app/admin/reports', label: 'Reports' },
  { to: '/app/admin/audit-logs', label: 'Audit logs' }
]

const linkClass = ({ isActive }) =>
  cn(
    'shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors duration-200',
    isActive
      ? 'bg-ink-900 text-white shadow-soft'
      : 'text-ink-600 hover:bg-ivory-100 hover:text-ink-900'
  )

export default function AdminNav() {
  return (
    <nav
      aria-label="Administration"
      className="flex gap-1 overflow-x-auto rounded-card border border-ink-200/80 bg-white p-1.5 shadow-soft"
    >
      {links.map((link) => (
        <NavLink key={link.to} to={link.to} end={link.end} className={linkClass}>
          {link.label}
        </NavLink>
      ))}
    </nav>
  )
}
