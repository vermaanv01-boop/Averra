import { Star } from 'lucide-react'
import { cn } from '../../utils/cn.js'
import { REVIEW_RATINGS } from '../../utils/reviews.js'

const SIZES = {
  sm: 'h-3.5 w-3.5',
  md: 'h-4 w-4',
  lg: 'h-5 w-5'
}

export default function Stars({ rating, size = 'md', label, className }) {
  const value = Math.round(Number(rating) || 0)
  return (
    <span
      className={cn('inline-flex items-center gap-0.5', className)}
      aria-label={label || `${value} out of 5 stars`}
    >
      {REVIEW_RATINGS.map((item) => (
        <Star
          key={item}
          className={cn(SIZES[size] || SIZES.md, item <= value ? 'fill-amber-400 text-amber-500' : 'text-ink-300')}
          aria-hidden="true"
        />
      ))}
    </span>
  )
}
