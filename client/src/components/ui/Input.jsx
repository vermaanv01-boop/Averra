import { forwardRef, useId } from 'react'
import { cn } from '../../utils/cn.js'

const Input = forwardRef(function Input(
  { label, error, helperText, className, id, ...props },
  ref
) {
  const generatedId = useId()
  const inputId = id || generatedId
  const describedBy = [
    error ? `${inputId}-error` : null,
    helperText ? `${inputId}-help` : null
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-ink-800">
          {label}
        </label>
      )}
      <input
        {...props}
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={cn(
          'block h-10 w-full rounded-lg border bg-white px-3 text-sm text-ink-900 transition-colors duration-200 placeholder:text-ink-400',
          error
            ? 'border-red-300 focus:border-red-400'
            : 'border-ink-200 hover:border-ink-300 focus:border-lavender-400'
        )}
      />
      {error && (
        <p id={`${inputId}-error`} className="text-xs text-red-700">
          {error}
        </p>
      )}
      {!error && helperText && (
        <p id={`${inputId}-help`} className="text-xs text-ink-500">
          {helperText}
        </p>
      )}
    </div>
  )
})

export default Input
