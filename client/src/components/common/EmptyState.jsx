import { cn } from '../../utils/cn.js'

export default function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div
      className={cn(
        'flex flex-col items-center rounded-lg border border-dashed border-ink-200 bg-ivory-50 px-5 py-8 text-center',
        className
      )}
    >
      {Icon && (
        <span className="grid h-10 w-10 place-items-center rounded-full border border-lavender-200 bg-white text-lavender-700">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
      )}
      <p className="mt-3 text-sm font-medium text-ink-900">{title}</p>
      {description && <p className="mt-1 max-w-sm text-xs leading-5 text-ink-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
