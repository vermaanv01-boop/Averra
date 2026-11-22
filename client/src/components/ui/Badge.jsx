import { cn } from '../../utils/cn.js'

const tones = {
  neutral: 'border-ink-200 bg-ivory-100 text-ink-700',
  lavender: 'border-lavender-200 bg-lavender-50 text-lavender-700',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  danger: 'border-red-200 bg-red-50 text-red-700'
}

export default function Badge({ tone = 'neutral', className, children }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium leading-none',
        tones[tone] || tones.neutral,
        className
      )}
    >
      {children}
    </span>
  )
}
