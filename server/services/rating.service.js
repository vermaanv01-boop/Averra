const mongoose = require('mongoose')
const Review = require('../models/Review')
const ExchangeRequest = require('../models/ExchangeRequest')
const User = require('../models/User')
const logger = require('../utils/logger')
const { RATING_VALUES, NEUTRAL_RATING } = require('../utils/constants')

const round = (value) => Math.round(value * 100) / 100

const emptyStats = () => ({
  totalReviews: 0,
  averageOverallRating: 0,
  averageTeachingRating: 0,
  averageLearningRating: 0,
  ratingDistribution: RATING_VALUES.map(() => 0),
  completedExchanges: 0,
  score: 0,
  recalculatedAt: null
})

const normalizeStats = (stored) => {
  const defaults = emptyStats()
  if (!stored) return defaults

  const distribution = RATING_VALUES.map((value, index) => {
    const count = Number(stored.ratingDistribution?.[index] || 0)
    return Number.isFinite(count) && count >= 0 ? count : 0
  })

  const numberOrDefault = (value) =>
    Number.isFinite(Number(value)) ? Number(value) : 0

  return {
    totalReviews: numberOrDefault(stored.totalReviews),
    averageOverallRating: numberOrDefault(stored.averageOverallRating),
    averageTeachingRating: numberOrDefault(stored.averageTeachingRating),
    averageLearningRating: numberOrDefault(stored.averageLearningRating),
    ratingDistribution: distribution,
    completedExchanges: numberOrDefault(stored.completedExchanges),
    score: numberOrDefault(stored.score),
    recalculatedAt: stored.recalculatedAt || null
  }
}

const calculateScore = (averageOverallRating, totalReviews, completedExchanges) => {
  const weight = totalReviews + completedExchanges
  if (weight === 0) return 0

  return round(
    (averageOverallRating * totalReviews + NEUTRAL_RATING * completedExchanges) / weight
  )
}

const buildStats = (summary, distributionRows, completedExchanges) => {
  const totalReviews = summary?.totalReviews || 0
  const averageOverallRating = totalReviews ? round(summary.avgOverall) : 0
  const averageTeachingRating = totalReviews ? round(summary.avgTeaching) : 0
  const averageLearningRating = totalReviews ? round(summary.avgLearning) : 0

  const counts = new Map(
    (distributionRows || []).map((row) => [Number(row._id), Number(row.count)])
  )
  const ratingDistribution = RATING_VALUES.map((value) => counts.get(value) || 0)

  return {
    totalReviews,
    averageOverallRating,
    averageTeachingRating,
    averageLearningRating,
    ratingDistribution,
    completedExchanges,
    score: calculateScore(summary?.avgOverall || 0, totalReviews, completedExchanges),
    recalculatedAt: new Date()
  }
}

const recalculateUserStats = async (userId) => {
  if (!userId) return null

  const objectId = new mongoose.Types.ObjectId(userId.toString())
  const [facetResults, completedExchanges] = await Promise.all([
    Review.aggregate([
      { $match: { reviewee: objectId, moderationStatus: 'visible' } },
      {
        $facet: {
          summary: [
            {
              $group: {
                _id: null,
                totalReviews: { $sum: 1 },
                avgOverall: { $avg: '$overallRating' },
                avgTeaching: { $avg: '$teachingRating' },
                avgLearning: { $avg: '$learningRating' }
              }
            }
          ],
          distribution: [{ $group: { _id: '$overallRating', count: { $sum: 1 } } }]
        }
      }
    ]),
    ExchangeRequest.countDocuments({
      status: 'completed',
      $or: [{ sender: userId }, { recipient: userId }]
    })
  ])

  const facet = facetResults[0] || {}
  const stats = buildStats(facet.summary?.[0], facet.distribution, completedExchanges)

  await User.updateOne({ _id: userId }, { $set: { reputation: stats } })
  return stats
}

const recalculateSafely = async (userId) => {
  try {
    return await recalculateUserStats(userId)
  } catch (error) {
    logger.error(`Could not recalculate reputation for ${userId}: ${error.message}`)
    return null
  }
}

const getStats = async (userId) => {
  const user = await User.findById(userId).select('reputation').lean()
  return normalizeStats(user?.reputation)
}

module.exports = {
  recalculateUserStats,
  recalculateSafely,
  getStats,
  normalizeStats,
  calculateScore
}
