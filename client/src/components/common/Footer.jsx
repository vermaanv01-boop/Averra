import { Link } from 'react-router-dom'
import PageContainer from './PageContainer.jsx'

export default function Footer({ compact = false }) {
  return (
    <footer className="border-t border-ink-200/70 bg-ivory-100">
      <PageContainer className="flex flex-col gap-3 py-6 text-sm text-ink-500 sm:flex-row sm:items-center sm:justify-between">
        <p>© {new Date().getFullYear()} Averra. Built for thoughtful skill exchange.</p>
        <nav aria-label="Footer" className="flex flex-wrap items-center gap-5">
          <Link to="/" className="transition-colors hover:text-ink-900">
            Home
          </Link>
          {!compact && (
            <Link to="/login" className="transition-colors hover:text-ink-900">
              Sign in
            </Link>
          )}
        </nav>
      </PageContainer>
    </footer>
  )
}
