import { forwardRef, useId } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '../../utils/cn.js'

const Select = forwardRef(function Select(
  { label, error, helperText, options = [], placeholder, className, id, ...props },
  ref
) {
  const generatedId = useId()
  const selectId = id || generatedId
  const describedBy = [
    error ? `${selectId}-error` : null,
    helperText ? `${selectId}-help` : null
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <label htmlFor={selectId} className="block text-sm font-medium text-ink-800">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          {...props}
          ref={ref}
          id={selectId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          className={cn(
            'block h-10 w-full appearance-none rounded-lg border bg-white pl-3 pr-9 text-sm text-ink-900 transition-colors duration-200',
            error
              ? 'border-red-300 focus:border-red-400'
              : 'border-ink-200 hover:border-ink-300 focus:border-lavender-400'
          )}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((option) => {
            const item = typeof option === 'string' ? { value: option, label: option } : option
            return (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            )
          })}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500"
          aria-hidden="true"
        />
      </div>
      {error && (
        <p id={`${selectId}-error`} className="text-xs text-red-700">
          {error}
        </p>
      )}
      {!error && helperText && (
        <p id={`${selectId}-help`} className="text-xs text-ink-500">
          {helperText}
        </p>
      )}
    </div>
  )
})

export default Select
