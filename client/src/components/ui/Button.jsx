import { LoaderCircle } from 'lucide-react'
import { cn } from '../../utils/cn.js'

const variants = {
  primary: 'border-ink-900 bg-ink-900 text-white shadow-soft hover:border-ink-800 hover:bg-ink-800',
  secondary: 'border-ink-200 bg-white text-ink-900 hover:border-lavender-300 hover:bg-lavender-50',
  ghost: 'border-transparent bg-transparent text-ink-700 hover:bg-ink-100 hover:text-ink-900',
  subtle: 'border-lavender-200 bg-lavender-50 text-lavender-700 hover:border-lavender-300 hover:bg-lavender-100',
  danger: 'border-red-200 bg-white text-red-700 hover:border-red-300 hover:bg-red-50'
}

const sizes = {
  sm: 'h-9 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-11 px-5 text-sm'
}

export function buttonStyles({
  variant = 'primary',
  size = 'md',
  className,
  loading = false,
  fullWidth = false
} = {}) {
  return cn(
    'inline-flex items-center justify-center gap-2 rounded-lg font-medium tracking-tight transition-all duration-200 ease-out',
    'disabled:pointer-events-none disabled:opacity-55',
    variants[variant] || variants.primary,
    sizes[size] || sizes.md,
    fullWidth && 'w-full',
    loading && 'cursor-wait',
    className
  )
}

export default function Button({
  variant = 'primary',
  size = 'md',
  className,
  loading = false,
  fullWidth = false,
  disabled = false,
  type = 'button',
  children,
  ...props
}) {
  return (
    <button
      {...props}
      type={type}
      className={buttonStyles({ variant, size, className, loading, fullWidth })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {loading && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  )
}
