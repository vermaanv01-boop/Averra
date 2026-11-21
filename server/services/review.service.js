const Review = require('../models/Review')
const ReviewReport = require('../models/ReviewReport')
const ExchangeRequest = require('../models/ExchangeRequest')
const User = require('../models/User')
const AppError = require('../utils/AppError')
const config = require('../config/env')
const logger = require('../utils/logger')
const { buildPagination } = require('../utils/pagination')
const ratingService = require('./rating.service')
const notificationService = require('./notification.service')
const transaction = require('./transaction.service')

const idOf = (value) => {
  if (!value) return null
  return value._id ? value._id.toString() : value.toString()
}

const userSummary = (user) => {
  if (!user) return null
  if (!user.name) return idOf(user)
  return {
    id: user._id.toString(),
    name: user.name,
    username: user.username,
    profileImage: user.profileImage
  }
}

const withUsers = (query) =>
  query
    .populate('reviewer', 'name username profileImage')
    .populate('reviewee', 'name username profileImage')

const toReviewDto = (review) => ({
  id: review._id.toString(),
  exchangeRequest: idOf(review.exchangeRequest),
  reviewer: userSummary(review.reviewer),
  reviewee: userSummary(review.reviewee),
  overallRating: review.overallRating,
  teachingRating: review.teachingRating,
  learningRating: review.learningRating,
  comment: review.comment,
  moderationStatus: review.moderationStatus,
  reportCount: review.reportCount,
  moderationHistory: (review.moderationHistory || []).map((entry) => ({
    status: entry.status,
    reason: entry.reason,
    moderatedBy: idOf(entry.moderatedBy),
    createdAt: entry.createdAt
  })),
  createdAt: review.createdAt,
  updatedAt: review.updatedAt
})

const sortOptions = {
  newest: { createdAt: -1, _id: -1 },
  oldest: { createdAt: 1, _id: 1 },
  highest: { overallRating: -1, createdAt: -1 },
  lowest: { overallRating: 1, createdAt: -1 }
}

const assertCompletedParticipants = async (userId, exchangeRequestId) => {
  const request = await ExchangeRequest.findById(exchangeRequestId)

  if (!request) {
    throw new AppError('Exchange request not found', 404)
  }

  const sender = request.sender.toString()
  const recipient = request.recipient.toString()

  if (userId !== sender && userId !== recipient) {
    throw new AppError('Exchange request not found', 404)
  }

  if (request.status !== 'completed') {
    throw new AppError('Reviews are available only for completed exchanges', 409)
  }

  return { request, sender, recipient }
}

const create = async (userId, payload) => {
  const { request, sender, recipient } = await assertCompletedParticipants(
    userId,
    payload.exchangeRequestId
  )
  const revieweeId = userId === sender ? recipient : sender

  if (revieweeId === userId) {
    throw new AppError('You cannot review yourself', 400)
  }

  try {
    const result = await transaction.withDbTransaction(async (session) => {
      const duplicate = await transaction.withSession(
        Review.exists({ exchangeRequest: request._id, reviewer: userId }),
        session
      )
      if (duplicate) {
        throw new AppError('You have already reviewed this exchange', 409)
      }

      const review = await transaction.createWithSession(Review, {
        exchangeRequest: request._id,
        reviewer: userId,
        reviewee: revieweeId,
        overallRating: payload.overallRating,
        teachingRating: payload.teachingRating,
        learningRating: payload.learningRating,
        comment: payload.comment,
        moderationHistory: [{ status: 'visible', reason: 'created', moderatedBy: null }]
      }, session)

      await notificationService.notifySafely({
        recipientId: revieweeId,
        actorId: userId,
        type: 'review_received',
        title: 'You received a review',
        message: 'A participant left a review for your completed exchange.',
        relatedEntityId: review.id,
        relatedEntityType: 'Review',
        eventId: review.id
      })

      return { reviewId: review.id }
    })

    await ratingService.recalculateSafely(revieweeId)
    const review = await Review.findById(result.reviewId)
      .populate('reviewer', 'name username profileImage')
      .populate('reviewee', 'name username profileImage')
    return toReviewDto(review)
  } catch (error) {
    if (error.code === 11000) {
      throw new AppError('You have already reviewed this exchange', 409)
    }
    throw error
  }
}

const listForUser = async (targetUserId, query) => {
  const exists = await User.exists({ _id: targetUserId })
  if (!exists) {
    throw new AppError('User not found', 404)
  }

  const filter = { reviewee: targetUserId, moderationStatus: 'visible' }
  const skip = (query.page - 1) * query.limit
  const [reviews, total] = await Promise.all([
    withUsers(Review.find(filter))
      .sort(sortOptions[query.sort])
      .skip(skip)
      .limit(query.limit)
      .lean(),
    Review.countDocuments(filter)
  ])

  return {
    reviews: reviews.map(toReviewDto),
    pagination: buildPagination(query.page, query.limit, total)
  }
}

const listForExchange = async (exchangeRequestId, query) => {
  const request = await ExchangeRequest.findById(exchangeRequestId)

  if (!request) {
    throw new AppError('Exchange request not found', 404)
  }
  if (request.status !== 'completed') {
    throw new AppError('Reviews are available only for completed exchanges', 409)
  }

  const filter = { exchangeRequest: exchangeRequestId, moderationStatus: 'visible' }
  const skip = (query.page - 1) * query.limit
  const [reviews, total] = await Promise.all([
    withUsers(Review.find(filter))
      .sort(sortOptions[query.sort])
      .skip(skip)
      .limit(query.limit)
      .lean(),
    Review.countDocuments(filter)
  ])

  return {
    reviews: reviews.map(toReviewDto),
    pagination: buildPagination(query.page, query.limit, total)
  }
}

const getById = async (reviewId) => {
  const review = await withUsers(
    Review.findOne({ _id: reviewId, moderationStatus: 'visible' })
  ).lean()

  if (!review) {
    throw new AppError('Review not found', 404)
  }

  return toReviewDto(review)
}

const findOwned = async (userId, reviewId) => {
  const review = await withUsers(Review.findById(reviewId))

  if (!review) {
    throw new AppError('Review not found', 404)
  }
  if (idOf(review.reviewer) !== userId.toString()) {
    throw new AppError('Only the original reviewer can modify this review', 403)
  }

  return review
}

const applyChanges = (review, payload) => {
  for (const field of ['overallRating', 'teachingRating', 'learningRating', 'comment']) {
    if (Object.prototype.hasOwnProperty.call(payload, field)) {
      review[field] = payload[field]
    }
  }
}

const update = async (userId, reviewId, payload) => {
  const review = await findOwned(userId, reviewId)

  if (review.moderationStatus === 'hidden') {
    throw new AppError('A hidden review cannot be edited', 409)
  }

  applyChanges(review, payload)
  await review.save()
  await ratingService.recalculateSafely(idOf(review.reviewee))
  return toReviewDto(review)
}

const remove = async (userId, reviewId) => {
  const review = await findOwned(userId, reviewId)
  const revieweeId = idOf(review.reviewee)

  await ReviewReport.deleteMany({ review: review._id })
  await Review.deleteOne({ _id: review._id })
  await ratingService.recalculateSafely(revieweeId)

  return { id: reviewId, deleted: true }
}

const report = async (userId, reviewId, { reason, details }) => {
  const review = await Review.findById(reviewId)

  if (!review) {
    throw new AppError('Review not found', 404)
  }
  if (review.moderationStatus === 'hidden') {
    throw new AppError('This review is no longer available for reporting', 409)
  }
  if (idOf(review.reviewer) === userId.toString()) {
    throw new AppError('You cannot report your own review', 400)
  }

  const duplicate = await ReviewReport.exists({ review: review._id, reporter: userId })
  if (duplicate) {
    throw new AppError('You have already reported this review', 409)
  }

  try {
    await ReviewReport.create({ review: review._id, reporter: userId, reason, details })
  } catch (error) {
    if (error.code === 11000) {
      throw new AppError('You have already reported this review', 409)
    }
    throw error
  }

  const updated = await Review.findByIdAndUpdate(
    review._id,
    { $inc: { reportCount: 1 } },
    { new: true }
  )

  let flagged = false
  if (
    updated.moderationStatus === 'visible' &&
    updated.reportCount >= config.review.reportThreshold
  ) {
    updated.moderationStatus = 'flagged'
    updated.moderationHistory.push({
      status: 'flagged',
      reason: `report_threshold:${config.review.reportThreshold}`,
      moderatedBy: null
    })
    await updated.save()
    flagged = true
  }

  if (flagged) {
    await ratingService.recalculateSafely(idOf(updated.reviewee))
  }

  return {
    reportCount: updated.reportCount,
    moderationStatus: updated.moderationStatus
  }
}

const listForModeration = async (query) => {
  const filter = query.status
    ? { moderationStatus: query.status }
    : {
        $or: [
          { moderationStatus: { $in: ['flagged', 'hidden'] } },
          { reportCount: { $gt: 0 } }
        ]
      }
  const skip = (query.page - 1) * query.limit
  const [reviews, total] = await Promise.all([
    withUsers(Review.find(filter))
      .sort({ reportCount: -1, createdAt: -1 })
      .skip(skip)
      .limit(query.limit)
      .lean(),
    Review.countDocuments(filter)
  ])

  return {
    reviews: reviews.map(toReviewDto),
    pagination: buildPagination(query.page, query.limit, total)
  }
}

const getForAdmin = async (reviewId) => {
  const review = await withUsers(Review.findById(reviewId)).lean()

  if (!review) {
    throw new AppError('Review not found', 404)
  }

  return toReviewDto(review)
}

const moderate = async (reviewId, status, moderatorId, note = '') => {
  if (!['hidden', 'visible'].includes(status)) {
    throw new AppError('Moderation status must be hidden or visible', 400)
  }
  if (!moderatorId) {
    throw new AppError('A moderator identity is required', 401)
  }

  const review = await withUsers(Review.findById(reviewId))
  if (!review) {
    throw new AppError('Review not found', 404)
  }

  if (review.moderationStatus !== status) {
    review.moderationStatus = status
    review.moderationHistory.push({
      status,
      reason: note || (status === 'hidden' ? 'hidden_by_moderator' : 'restored_by_moderator'),
      moderatedBy: moderatorId
    })
    await review.save()
    await ratingService.recalculateSafely(idOf(review.reviewee))
  } else {
    logger.info(`Review ${reviewId} is already ${status}; no moderation change applied`)
  }

  return toReviewDto(review)
}

module.exports = {
  create,
  listForUser,
  listForExchange,
  getById,
  update,
  remove,
  report,
  listForModeration,
  getForAdmin,
  moderate,
  toReviewDto
}
