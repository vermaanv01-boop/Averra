import { cn } from '../../utils/cn.js'

const sizes = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base'
}

export default function Avatar({ name = '', size = 'md', className }) {
  const initials =
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join('') || 'A'

  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full border border-lavender-200 bg-lavender-100 font-semibold text-lavender-700',
        sizes[size] || sizes.md,
        className
      )}
    >
      {initials}
    </span>
  )
}
