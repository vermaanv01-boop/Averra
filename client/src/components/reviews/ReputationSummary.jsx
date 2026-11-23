import { Star } from 'lucide-react'
import Stars from './Stars.jsx'
import { formatAverage, formatReviewDate, normalizeReputation, REVIEW_RATINGS } from '../../utils/reviews.js'

function Stat({ label, value, suffix }) {
  return (
    <div className="rounded-xl border border-ink-100 bg-ivory-50/70 px-3 py-2.5">
      <p className="text-xs text-ink-500">{label}</p>
      <p className="mt-1 text-lg text-ink-900">
        {value}
        {suffix && <span className="ml-1 text-xs font-normal text-ink-500">{suffix}</span>}
      </p>
    </div>
  )
}

export default function ReputationSummary({
  reputation,
  title = 'Reputation',
  description = 'Figures calculated by Averra from visible reviews and completed exchanges.'
}) {
  const stats = normalizeReputation(reputation)

  return (
    <section className="rounded-card border border-ink-200/80 bg-white p-5 shadow-soft sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-lg text-ink-900">{title}</h3>
          <p className="mt-1 text-xs leading-5 text-ink-500">{description}</p>
        </div>
        <div className="flex items-center gap-2">
          <Stars rating={stats.averageOverallRating} size="lg" />
          <span className="text-3xl leading-none text-ink-900">{formatAverage(stats.averageOverallRating)}</span>
          <span className="text-xs text-ink-500">/ 5</span>
        </div>
      </div>

      <div className="mt-5 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Reviews" value={stats.totalReviews} />
        <Stat label="Teaching reputation" value={formatAverage(stats.averageTeachingRating)} suffix="/ 5" />
        <Stat label="Learning reputation" value={formatAverage(stats.averageLearningRating)} suffix="/ 5" />
        <Stat label="Reputation score" value={formatAverage(stats.score)} suffix="/ 5" />
      </div>

      <div className="mt-5 border-t border-ink-100 pt-5">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-500">
          Overall rating distribution
        </p>
        <div className="mt-3 grid grid-cols-5 gap-2">
          {[...REVIEW_RATINGS].reverse().map((rating) => (
            <div key={rating} className="rounded-lg bg-ivory-100 px-2 py-2 text-center">
              <p className="inline-flex items-center gap-0.5 text-xs text-ink-600">
                {rating}
                <Star className="h-3 w-3 fill-amber-400 text-amber-500" aria-hidden="true" />
              </p>
              <p className="mt-0.5 text-sm text-ink-900">
                {stats.ratingDistribution[rating - 1]}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-500">
        <span>{stats.completedExchanges} completed exchanges</span>
        {stats.recalculatedAt && <span>Calculated {formatReviewDate(stats.recalculatedAt)}</span>}
      </div>
    </section>
  )
}
