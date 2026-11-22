import { Link } from 'react-router-dom'
import { cn } from '../../utils/cn.js'

export default function Brand({ to = '/', compact = false, className }) {
  const content = (
    <>
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-ink-900 text-sm font-semibold text-white shadow-soft">
        A
      </span>
      {!compact && (
        <span className="font-display text-lg tracking-tight text-ink-900">Averra</span>
      )}
    </>
  )

  if (!to) {
    return <span className={cn('inline-flex items-center gap-2.5', className)}>{content}</span>
  }

  return (
    <Link
      to={to}
      aria-label="Averra home"
      className={cn('inline-flex items-center gap-2.5 rounded-lg transition-opacity hover:opacity-80', className)}
    >
      {content}
    </Link>
  )
}
