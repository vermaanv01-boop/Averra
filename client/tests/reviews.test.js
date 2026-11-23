import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildReviewPayload,
  entityId,
  formatAverage,
  formatReviewDate,
  formatReviewError,
  isCompletedExchangeForUser,
  isReviewedBy,
  normalizeReputation,
  otherParticipant,
  reviewerSummary,
  shortId,
  validateReviewForm
} from '../src/utils/reviews.js'

function exchange(overrides = {}) {
  return {
    id: 'exchange-1',
    sender: { id: 'me', name: 'Me', username: 'me' },
    recipient: { id: 'partner', name: 'Partner', username: 'partner' },
    offeredSkill: { id: 'skill-1', name: 'Guitar' },
    requestedSkill: { id: 'skill-2', name: 'Spanish' },
    status: 'completed',
    completedAt: '2026-01-01T00:00:00.000Z',
    ...overrides
  }
}

function validValues() {
  return {
    exchangeRequestId: 'exchange-1',
    overallRating: 5,
    teachingRating: 4,
    learningRating: 3,
    comment: '  Clear and patient exchange.  '
  }
}

test('review form validates all three ratings and the required comment', () => {
  assert.deepEqual(validateReviewForm(validValues()), {})
  const errors = validateReviewForm({
    overallRating: 0,
    teachingRating: 6,
    learningRating: 2.5,
    comment: '   '
  })
  assert.deepEqual(Object.keys(errors).sort(), [
    'comment',
    'learningRating',
    'overallRating',
    'teachingRating'
  ])
  assert.equal(validateReviewForm({ ...validValues(), comment: 'x'.repeat(2001) }).comment.includes('2,000'), true)
})

test('review payload contains only the exact backend create fields', () => {
  assert.deepEqual(buildReviewPayload({ ...validValues(), revieweeId: 'partner' }), {
    exchangeRequestId: 'exchange-1',
    overallRating: 5,
    teachingRating: 4,
    learningRating: 3,
    comment: 'Clear and patient exchange.'
  })
})

test('eligibility helpers require a completed exchange and use participant ids', () => {
  assert.equal(isCompletedExchangeForUser(exchange(), 'me'), true)
  assert.equal(isCompletedExchangeForUser(exchange(), 'partner'), true)
  assert.equal(isCompletedExchangeForUser(exchange(), 'stranger'), false)
  assert.equal(isCompletedExchangeForUser(exchange({ status: 'pending' }), 'me'), false)
  assert.equal(otherParticipant(exchange(), 'me').name, 'Partner')
  assert.equal(otherParticipant(exchange(), 'partner').name, 'Me')
  assert.equal(entityId({ id: 'nested' }), 'nested')
})

test('duplicate detection recognizes populated and string reviewer fields', () => {
  assert.equal(isReviewedBy({ reviewer: { id: 'me', name: 'Me' } }, 'me'), true)
  assert.equal(isReviewedBy({ reviewer: 'me' }, 'me'), true)
  assert.equal(isReviewedBy({ reviewer: 'partner' }, 'me'), false)
  assert.equal(isReviewedBy({ reviewer: null }, ''), false)
})

test('reviewer summary handles populated and string reviewer fields', () => {
  assert.deepEqual(reviewerSummary({ reviewer: { id: 'r1', name: 'Rae', username: 'rae' } }), {
    id: 'r1',
    name: 'Rae',
    username: 'rae',
    profileImage: ''
  })
  assert.equal(reviewerSummary({ reviewer: 'r1' }).name, 'Member')
})

test('reputation normalization preserves only backend-calculated fields', () => {
  const normalized = normalizeReputation({
    totalReviews: 2,
    averageOverallRating: 4.5,
    averageTeachingRating: 4,
    averageLearningRating: 5,
    ratingDistribution: [0, 0, 1, 0, 1],
    completedExchanges: 3,
    score: 4.2,
    recalculatedAt: '2026-01-02T00:00:00.000Z',
    inventedScore: 99
  })
  assert.deepEqual(normalized, {
    totalReviews: 2,
    averageOverallRating: 4.5,
    averageTeachingRating: 4,
    averageLearningRating: 5,
    ratingDistribution: [0, 0, 1, 0, 1],
    completedExchanges: 3,
    score: 4.2,
    recalculatedAt: '2026-01-02T00:00:00.000Z'
  })
  assert.deepEqual(normalizeReputation(null).ratingDistribution, [0, 0, 0, 0, 0])
})

test('formatters handle dates, averages, ids and backend validation details', () => {
  assert.equal(formatReviewDate('not-a-date'), '')
  assert.match(formatReviewDate('2026-01-01T00:00:00.000Z'), /2026/)
  assert.equal(formatAverage(0), '—')
  assert.equal(formatAverage(4.25), '4.3')
  assert.equal(shortId('abcdef1234567890'), 'abcdef12…567890')
  assert.equal(
    formatReviewError({
      message: 'Invalid request data',
      details: [{ path: ['body', 'overallRating'], message: 'Number must be less than or equal to 5' }]
    }),
    'Invalid request data body.overallRating: Number must be less than or equal to 5'
  )
  assert.equal(formatReviewError(null), 'The review could not be saved.')
})
