import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import Brand from '../common/Brand.jsx'
import PageContainer from '../common/PageContainer.jsx'
import { buttonStyles } from '../ui/Button.jsx'
import { cn } from '../../utils/cn.js'

function navClass({ isActive }) {
  return cn(
    'text-sm transition-colors duration-200',
    isActive ? 'text-ink-900' : 'text-ink-600 hover:text-ink-900'
  )
}

export default function PublicNavbar() {
  const [open, setOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    setOpen(false)
  }, [location.pathname])

  return (
    <header className="sticky top-0 z-40 border-b border-ink-200/70 bg-ivory-50">
      <PageContainer className="flex h-16 items-center justify-between gap-4">
        <Brand />

        <nav aria-label="Primary" className="hidden items-center gap-6 md:flex">
          <NavLink to="/" end className={navClass}>
            Home
          </NavLink>
          <Link to="/login" className="text-sm text-ink-600 transition-colors hover:text-ink-900">
            Sign in
          </Link>
          <Link to="/register" className={buttonStyles({ variant: 'subtle', size: 'sm' })}>
            Get started
          </Link>
        </nav>

        <button
          type="button"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-ink-200 text-ink-700 transition-colors hover:bg-ivory-100 md:hidden"
          aria-expanded={open}
          aria-controls="public-mobile-nav"
          aria-label={open ? 'Close navigation' : 'Open navigation'}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </PageContainer>

      {open && (
        <nav
          id="public-mobile-nav"
          aria-label="Mobile navigation"
          className="animate-fade-in border-t border-ink-200 bg-ivory-50 md:hidden"
        >
          <PageContainer className="flex flex-col gap-1 py-3">
            <NavLink to="/" end className={({ isActive }) => cn(navClass({ isActive }), 'rounded-lg px-3 py-2.5')}>
              Home
            </NavLink>
            <Link to="/login" className="rounded-lg px-3 py-2.5 text-sm text-ink-600 hover:bg-ivory-100">
              Sign in
            </Link>
            <Link to="/register" className={buttonStyles({ variant: 'subtle', size: 'sm', className: 'mt-1' })}>
              Get started
            </Link>
          </PageContainer>
        </nav>
      )}
    </header>
  )
}
