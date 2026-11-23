import { Star } from 'lucide-react'
import { cn } from '../../utils/cn.js'
import { REVIEW_RATINGS } from '../../utils/reviews.js'

export default function StarRating({ name, label, value, onChange, error, disabled = false }) {
  const current = Number(value) || 0

  return (
    <fieldset disabled={disabled}>
      <legend className="text-sm font-medium text-ink-800">{label}</legend>
      <div className="mt-2 flex items-center gap-1">
        {REVIEW_RATINGS.map((rating) => (
          <label
            key={rating}
            className="cursor-pointer rounded-md p-0.5 transition-transform duration-200 hover:scale-105"
          >
            <input
              type="radio"
              name={name}
              value={rating}
              checked={current === rating}
              onChange={() => onChange(rating)}
              className="peer sr-only"
              aria-label={`${rating} out of 5 stars for ${label}`}
            />
            <Star
              className={cn(
                'h-6 w-6 transition-colors duration-200 peer-focus-visible:ring-2 peer-focus-visible:ring-lavender-400 peer-focus-visible:ring-offset-2',
                rating <= current ? 'fill-amber-400 text-amber-500' : 'text-ink-300 hover:text-amber-400'
              )}
              aria-hidden="true"
            />
          </label>
        ))}
      </div>
      {error && (
        <p className="mt-1.5 text-xs text-red-700" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  )
}
