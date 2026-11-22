import { forwardRef, useId } from 'react'
import { cn } from '../../utils/cn.js'

const Textarea = forwardRef(function Textarea(
  { label, error, helperText, className, id, rows = 4, ...props },
  ref
) {
  const generatedId = useId()
  const textareaId = id || generatedId
  const describedBy = [
    error ? `${textareaId}-error` : null,
    helperText ? `${textareaId}-help` : null
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <label htmlFor={textareaId} className="block text-sm font-medium text-ink-800">
          {label}
        </label>
      )}
      <textarea
        {...props}
        ref={ref}
        id={textareaId}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={cn(
          'block w-full resize-y rounded-lg border bg-white px-3 py-2.5 text-sm leading-6 text-ink-900 transition-colors duration-200 placeholder:text-ink-400',
          error
            ? 'border-red-300 focus:border-red-400'
            : 'border-ink-200 hover:border-ink-300 focus:border-lavender-400'
        )}
      />
      {error ? (
        <p id={`${textareaId}-error`} className="text-xs text-red-700">
          {error}
        </p>
      ) : (
        helperText && (
          <p id={`${textareaId}-help`} className="text-xs text-ink-500">
            {helperText}
          </p>
        )
      )}
    </div>
  )
})

export default Textarea
