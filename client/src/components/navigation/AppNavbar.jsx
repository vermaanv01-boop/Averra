import { useEffect, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { LogOut, Menu, X } from 'lucide-react'
import Brand from '../common/Brand.jsx'
import PageContainer from '../common/PageContainer.jsx'
import Avatar from '../ui/Avatar.jsx'
import Button from '../ui/Button.jsx'
import { useAuth } from '../../hooks/useAuth.js'
import { cn } from '../../utils/cn.js'

function navClass({ isActive }) {
  return cn(
    'text-sm transition-colors duration-200',
    isActive ? 'text-ink-900' : 'text-ink-600 hover:text-ink-900'
  )
}

export default function AppNavbar() {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout, logoutLoading } = useAuth()

  useEffect(() => {
    setOpen(false)
  }, [location.pathname])

  async function handleSignOut() {
    await logout()
    navigate('/', { replace: true })
  }

  return (
    <header className="sticky top-0 z-40 border-b border-ink-200/70 bg-white">
      <PageContainer className="flex h-16 items-center justify-between gap-4">
        <div className="flex items-center gap-8">
          <Brand to="/app" />
          <nav aria-label="Application" className="hidden items-center gap-6 md:flex">
            <NavLink to="/app" end className={navClass}>
              Overview
            </NavLink>
            <NavLink to="/app/discovery" className={navClass}>
              Discover
            </NavLink>
            <NavLink to="/app/profile" className={navClass}>
              Profile
            </NavLink>
            <NavLink to="/app/skills" className={navClass}>
              Skills
            </NavLink>
          </nav>
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <div className="flex items-center gap-2.5">
            <Avatar name={user?.name} size="sm" />
            <div className="leading-tight">
              <p className="text-sm font-medium text-ink-900">{user?.name || 'Your account'}</p>
              <p className="text-xs text-ink-500">@{user?.username || 'member'}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" loading={logoutLoading} onClick={handleSignOut}>
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Sign out
          </Button>
        </div>

        <button
          type="button"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-ink-200 text-ink-700 transition-colors hover:bg-ivory-100 md:hidden"
          aria-expanded={open}
          aria-controls="app-mobile-nav"
          aria-label={open ? 'Close navigation' : 'Open navigation'}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </PageContainer>

      {open && (
        <nav
          id="app-mobile-nav"
          aria-label="Mobile application navigation"
          className="animate-fade-in border-t border-ink-200 bg-white md:hidden"
        >
          <PageContainer className="flex flex-col gap-3 py-4">
            <NavLink to="/app" end className={({ isActive }) => cn(navClass({ isActive }), 'rounded-lg px-3 py-2.5')}>
              Overview
            </NavLink>
            <NavLink to="/app/discovery" className={({ isActive }) => cn(navClass({ isActive }), 'rounded-lg px-3 py-2.5')}>
              Discover
            </NavLink>
            <NavLink to="/app/profile" className={({ isActive }) => cn(navClass({ isActive }), 'rounded-lg px-3 py-2.5')}>
              Profile
            </NavLink>
            <NavLink to="/app/skills" className={({ isActive }) => cn(navClass({ isActive }), 'rounded-lg px-3 py-2.5')}>
              Skills
            </NavLink>
            <div className="flex items-center gap-2.5 border-t border-ink-100 pt-3">
              <Avatar name={user?.name} size="sm" />
              <div className="min-w-0 leading-tight">
                <p className="truncate text-sm font-medium text-ink-900">{user?.name || 'Your account'}</p>
                <p className="truncate text-xs text-ink-500">@{user?.username || 'member'}</p>
              </div>
            </div>
            <Button variant="secondary" size="sm" fullWidth loading={logoutLoading} onClick={handleSignOut}>
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Sign out
            </Button>
          </PageContainer>
        </nav>
      )}
    </header>
  )
}
