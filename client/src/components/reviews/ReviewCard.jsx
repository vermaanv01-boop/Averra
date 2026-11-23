import { Link } from 'react-router-dom'
import Avatar from '../ui/Avatar.jsx'
import Badge from '../ui/Badge.jsx'
import Stars from './Stars.jsx'
import { cn } from '../../utils/cn.js'
import {
  entityId,
  formatReviewDate,
  reviewerSummary,
  shortId
} from '../../utils/reviews.js'

const STATUS_TONES = {
  visible: 'success',
  flagged: 'warning',
  hidden: 'neutral'
}

export default function ReviewCard({ review, highlighted = false, compact = false }) {
  const reviewer = reviewerSummary(review)
  const name = reviewer.username ? `@${reviewer.username}` : reviewer.name
  const status = review?.moderationStatus || 'visible'

  return (
    <article
      id={`review-${entityId(review)}`}
      className={cn(
        'scroll-mt-24 rounded-card border border-ink-200/80 bg-white p-4 transition-colors duration-200 sm:p-5',
        highlighted && 'border-lavender-300 bg-lavender-50/50 shadow-soft',
        compact && 'border-ink-100 bg-ivory-50/60'
      )}
    >
      <div className="flex gap-3">
        <Avatar name={reviewer.name} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              {reviewer.username ? (
                <Link
                  to={`/app/users/${encodeURIComponent(reviewer.username)}`}
                  className="text-sm font-medium text-ink-900 hover:text-lavender-700"
                >
                  {name}
                </Link>
              ) : (
                <p className="text-sm font-medium text-ink-900">{name}</p>
              )}
              <p className="mt-0.5 text-xs text-ink-500">
                {formatReviewDate(review?.createdAt) || 'Recently'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Stars rating={review?.overallRating} size="sm" />
              <span className="text-sm font-medium text-ink-900">
                {Number(review?.overallRating) || 0}/5
              </span>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-600">
            <span className="inline-flex items-center gap-1.5">
              Teaching <Stars rating={review?.teachingRating} size="sm" />
            </span>
            <span className="inline-flex items-center gap-1.5">
              Learning <Stars rating={review?.learningRating} size="sm" />
            </span>
            <span>Exchange {shortId(review?.exchangeRequest)}</span>
            {status !== 'visible' && <Badge tone={STATUS_TONES[status] || 'neutral'}>{status}</Badge>}
          </div>

          <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-ink-700">
            {review?.comment}
          </p>
        </div>
      </div>
    </article>
  )
}
