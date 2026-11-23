export const REVIEW_RATINGS = [1, 2, 3, 4, 5]

export const REVIEW_SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'highest', label: 'Highest rated' },
  { value: 'lowest', label: 'Lowest rated' }
]

export function entityId(value) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  return entityId(value.id ?? value._id)
}

function toNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

export function normalizeReputation(value) {
  const source = value || {}
  const distribution = Array.isArray(source.ratingDistribution) ? source.ratingDistribution : []
  return {
    totalReviews: toNumber(source.totalReviews),
    averageOverallRating: toNumber(source.averageOverallRating),
    averageTeachingRating: toNumber(source.averageTeachingRating),
    averageLearningRating: toNumber(source.averageLearningRating),
    ratingDistribution: REVIEW_RATINGS.map((_, index) => toNumber(distribution[index])),
    completedExchanges: toNumber(source.completedExchanges),
    score: toNumber(source.score),
    recalculatedAt: source.recalculatedAt || null
  }
}

export function isCompletedExchangeForUser(exchange, userId) {
  const id = entityId(userId)
  if (!id || exchange?.status !== 'completed') return false
  return entityId(exchange.sender) === id || entityId(exchange.recipient) === id
}

export function otherParticipant(exchange, userId) {
  const id = entityId(userId)
  if (!id) return null
  if (entityId(exchange?.sender) === id) return exchange.recipient || null
  if (entityId(exchange?.recipient) === id) return exchange.sender || null
  return null
}

export function isReviewedBy(review, userId) {
  const id = entityId(userId)
  return Boolean(id) && entityId(review?.reviewer) === id
}

export function reviewerSummary(review) {
  const reviewer = review?.reviewer
  if (reviewer && typeof reviewer === 'object') {
    return {
      id: entityId(reviewer),
      name: reviewer.name || 'Member',
      username: reviewer.username || '',
      profileImage: reviewer.profileImage || ''
    }
  }
  return { id: entityId(reviewer), name: 'Member', username: '', profileImage: '' }
}

export function validateReviewForm(values) {
  const errors = {}
  const fields = ['overallRating', 'teachingRating', 'learningRating']

  fields.forEach((field) => {
    const rating = Number(values?.[field])
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      errors[field] = 'Choose a rating from 1 to 5.'
    }
  })

  const comment = typeof values?.comment === 'string' ? values.comment.trim() : ''
  if (!comment) {
    errors.comment = 'Write a comment about the exchange.'
  } else if (comment.length > 2000) {
    errors.comment = 'Keep the comment under 2,000 characters.'
  }

  return errors
}

export function buildReviewPayload(values) {
  return {
    exchangeRequestId: entityId(values?.exchangeRequestId),
    overallRating: Number(values?.overallRating),
    teachingRating: Number(values?.teachingRating),
    learningRating: Number(values?.learningRating),
    comment: typeof values?.comment === 'string' ? values.comment.trim() : ''
  }
}

export function formatReviewDate(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
}

export function formatAverage(value) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number.toFixed(1) : '—'
}

export function shortId(value) {
  const id = entityId(value)
  return id.length > 14 ? `${id.slice(0, 8)}…${id.slice(-6)}` : id
}

export function formatReviewError(error) {
  const message = error?.message || 'The review could not be saved.'
  const details = Array.isArray(error?.details)
    ? error.details
        .map((detail) => {
          const path = Array.isArray(detail?.path) ? detail.path.join('.') : detail?.path
          return path ? `${path}: ${detail.message}` : detail?.message
        })
        .filter(Boolean)
    : []
  return details.length ? `${message} ${details.join('; ')}` : message
}
