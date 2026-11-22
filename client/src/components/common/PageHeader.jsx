import { cn } from '../../utils/cn.js'

export default function PageHeader({ eyebrow, title, description, actions, className }) {
  return (
    <header className={cn('space-y-3', className)}>
      {eyebrow && (
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-lavender-700">
          {eyebrow}
        </p>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-balance text-3xl leading-tight text-ink-900 sm:text-4xl">{title}</h1>
          {description && (
            <p className="max-w-2xl text-sm leading-6 text-ink-600 sm:text-base">{description}</p>
          )}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  )
}
