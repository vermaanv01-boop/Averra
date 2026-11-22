import { CircleAlert, CircleCheck, Info } from 'lucide-react'
import { cn } from '../../utils/cn.js'

const styles = {
  info: 'border-lavender-200 bg-lavender-50 text-lavender-800',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
  error: 'border-red-200 bg-red-50 text-red-800'
}

const icons = {
  info: Info,
  success: CircleCheck,
  warning: CircleAlert,
  error: CircleAlert
}

export default function Alert({ variant = 'info', title, children, action, className }) {
  const Icon = icons[variant] || icons.info

  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      className={cn('flex gap-3 rounded-lg border px-3.5 py-3 text-sm', styles[variant] || styles.info, className)}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="space-y-1">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className="leading-6">{children}</div>}
      </div>
    </div>
  )
}
