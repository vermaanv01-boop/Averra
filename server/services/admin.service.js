const User = require('../models/User')
const Skill = require('../models/Skill')
const ExchangeRequest = require('../models/ExchangeRequest')
const Session = require('../models/Session')
const Message = require('../models/Message')
const Review = require('../models/Review')
const ReviewReport = require('../models/ReviewReport')
const AppError = require('../utils/AppError')
const { buildPagination } = require('../utils/pagination')
const {
  REQUEST_STATUSES,
  SESSION_STATUSES,
  REVIEW_MODERATION_STATUSES,
  REPORT_STATUSES,
  REPORT_ACTIONS
} = require('../utils/constants')
const reviewService = require('./review.service')
const ratingService = require('./rating.service')
const auditService = require('./audit.service')

const idOf = (value) => {
  if (!value) return null
  return value._id ? value._id.toString() : value.toString()
}

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const assertAdmin = async (actorId) => {
  const user = await User.findById(actorId)

  if (!user) {
    throw new AppError('Administrator account not found', 404)
  }
  if (user.role !== 'admin') {
    throw new AppError('Administrator access required', 403)
  }
  if (user.accountStatus === 'suspended') {
    throw new AppError('Administrator account is suspended', 403)
  }

  return user
}

const toSuspensionDto = (suspension) => ({
  reason: suspension?.reason || '',
  suspendedAt: suspension?.suspendedAt || null,
  suspendedBy: idOf(suspension?.suspendedBy),
  restoredAt: suspension?.restoredAt || null,
  restoredBy: idOf(suspension?.restoredBy)
})

const toUserDto = (user) => ({
  id: idOf(user),
  name: user.name,
  username: user.username,
  email: user.email,
  role: user.role,
  accountStatus: user.accountStatus,
  suspension: toSuspensionDto(user.suspension),
  reputation: ratingService.normalizeStats(user.reputation),
  createdAt: user.createdAt,
  updatedAt: user.updatedAt
})

const listUsers = async (actorId, query) => {
  await assertAdmin(actorId)

  const filter = {}
  if (query.search) {
    const pattern = new RegExp(escapeRegex(query.search.trim()), 'i')
    filter.$or = [{ name: pattern }, { username: pattern }, { email: pattern }]
  }
  if (query.role) filter.role = query.role
  if (query.status) filter.accountStatus = query.status

  const sort = {
    newest: { createdAt: -1, _id: -1 },
    oldest: { createdAt: 1, _id: 1 },
    username: { username: 1 }
  }
  const skip = (query.page - 1) * query.limit
  const [users, total] = await Promise.all([
    User.find(filter)
      .sort(sort[query.sort])
      .skip(skip)
      .limit(query.limit)
      .lean(),
    User.countDocuments(filter)
  ])

  return {
    users: users.map(toUserDto),
    pagination: buildPagination(query.page, query.limit, total)
  }
}

const getUser = async (actorId, userId) => {
  await assertAdmin(actorId)
  const user = await User.findById(userId).lean()

  if (!user) {
    throw new AppError('User not found', 404)
  }

  return toUserDto(user)
}

const suspendUser = async (actorId, userId, { reason }) => {
  await assertAdmin(actorId)

  if (idOf(actorId) === idOf(userId)) {
    throw new AppError('Administrators cannot suspend themselves', 400)
  }

  const user = await User.findById(userId)
  if (!user) {
    throw new AppError('User not found', 404)
  }
  if (user.accountStatus === 'suspended') {
    throw new AppError('User is already suspended', 409)
  }

  user.accountStatus = 'suspended'
  user.suspension.reason = reason
  user.suspension.suspendedAt = new Date()
  user.suspension.suspendedBy = actorId
  user.suspension.restoredAt = null
  user.suspension.restoredBy = null
  await user.save()

  await auditService.record({
    actorId,
    action: 'user_suspended',
    targetType: 'User',
    targetId: user.id,
    reason,
    metadata: { previousStatus: 'active' }
  })

  return toUserDto(user)
}

const restoreUser = async (actorId, userId, { reason = '' } = {}) => {
  await assertAdmin(actorId)

  const user = await User.findById(userId)
  if (!user) {
    throw new AppError('User not found', 404)
  }
  if (user.accountStatus === 'active') {
    throw new AppError('User is already active', 409)
  }

  user.accountStatus = 'active'
  user.suspension.restoredAt = new Date()
  user.suspension.restoredBy = actorId
  if (reason) {
    user.suspension.reason = reason
  }
  await user.save()

  await auditService.record({
    actorId,
    action: 'user_restored',
    targetType: 'User',
    targetId: user.id,
    reason,
    metadata: { previousStatus: 'suspended' }
  })

  return toUserDto(user)
}

const listModeration = async (actorId, query) => {
  await assertAdmin(actorId)
  return reviewService.listForModeration(query)
}

const getReview = async (actorId, reviewId) => {
  await assertAdmin(actorId)
  return reviewService.getForAdmin(reviewId)
}

const moderateReview = async (actorId, reviewId, { status, reason = '' }) => {
  const admin = await assertAdmin(actorId)
  const existing = await Review.findById(reviewId)

  if (!existing) {
    throw new AppError('Review not found', 404)
  }

  const review = await reviewService.moderate(reviewId, status, admin.id, reason)
  const changed = existing.moderationStatus !== status

  if (changed) {
    await auditService.record({
      actorId: admin.id,
      action: status === 'hidden' ? 'review_hidden' : 'review_restored',
      targetType: 'Review',
      targetId: reviewId,
      reason,
      metadata: {
        previousStatus: existing.moderationStatus,
        newStatus: status
      }
    })
  }

  return review
}

const withReportRefs = (query) =>
  query
    .populate('review', 'overallRating teachingRating learningRating comment moderationStatus')
    .populate('reporter', 'name username profileImage')

const toReportDto = (report) => ({
  id: idOf(report),
  review: report.review
    ? {
        id: idOf(report.review),
        overallRating: report.review.overallRating,
        teachingRating: report.review.teachingRating,
        learningRating: report.review.learningRating,
        comment: report.review.comment,
        moderationStatus: report.review.moderationStatus
      }
    : null,
  reporter: report.reporter
    ? {
        id: idOf(report.reporter),
        name: report.reporter.name,
        username: report.reporter.username,
        profileImage: report.reporter.profileImage
      }
    : null,
  reason: report.reason,
  details: report.details || '',
  status: report.status,
  resolution: {
    moderator: idOf(report.resolution?.moderator),
    action: report.resolution?.action || null,
    reason: report.resolution?.reason || '',
    resolvedAt: report.resolution?.resolvedAt || null
  },
  createdAt: report.createdAt,
  updatedAt: report.updatedAt
})

const listReports = async (actorId, query) => {
  await assertAdmin(actorId)

  const filter = {}
  if (query.status) filter.status = query.status
  if (query.reason) filter.reason = query.reason

  const skip = (query.page - 1) * query.limit
  const [reports, total] = await Promise.all([
    withReportRefs(ReviewReport.find(filter))
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(query.limit)
      .lean(),
    ReviewReport.countDocuments(filter)
  ])

  return {
    reports: reports.map(toReportDto),
    pagination: buildPagination(query.page, query.limit, total)
  }
}

const getReport = async (actorId, reportId) => {
  await assertAdmin(actorId)
  const report = await withReportRefs(ReviewReport.findById(reportId)).lean()

  if (!report) {
    throw new AppError('Report not found', 404)
  }

  return toReportDto(report)
}

const decideReport = async (actorId, reportId, { action, reason }) => {
  const admin = await assertAdmin(actorId)

  if (!REPORT_ACTIONS.includes(action)) {
    throw new AppError('Invalid report action', 400)
  }

  const report = await ReviewReport.findById(reportId)
  if (!report) {
    throw new AppError('Report not found', 404)
  }
  if (report.status !== 'pending') {
    throw new AppError('This report has already been decided', 409)
  }

  report.status = action
  report.resolution.moderator = admin.id
  report.resolution.action = action
  report.resolution.reason = reason
  report.resolution.resolvedAt = new Date()
  await report.save()

  await auditService.record({
    actorId: admin.id,
    action: `report_${action}`,
    targetType: 'ReviewReport',
    targetId: report.id,
    reason,
    metadata: { previousStatus: 'pending', newStatus: action }
  })

  return getReport(admin.id, reportId)
}

const countByStatus = async (Model, field, statuses) => {
  const entries = await Promise.all(
    statuses.map((status) => Model.countDocuments({ [field]: status }))
  )
  return {
    total: entries.reduce((sum, count) => sum + count, 0),
    ...statuses.reduce((acc, status, index) => {
      acc[status] = entries[index]
      return acc
    }, {})
  }
}

const statistics = async (actorId) => {
  await assertAdmin(actorId)

  const [
    users,
    activeUsers,
    suspendedUsers,
    admins,
    skills,
    teachSkills,
    learnSkills,
    exchangeRequests,
    sessions,
    messages,
    activeMessages,
    deletedMessages,
    reviews,
    reports
  ] = await Promise.all([
    User.countDocuments({}),
    User.countDocuments({ accountStatus: 'active' }),
    User.countDocuments({ accountStatus: 'suspended' }),
    User.countDocuments({ role: 'admin' }),
    Skill.countDocuments({}),
    Skill.countDocuments({ type: 'teach' }),
    Skill.countDocuments({ type: 'learn' }),
    countByStatus(ExchangeRequest, 'status', REQUEST_STATUSES),
    countByStatus(Session, 'status', SESSION_STATUSES),
    Message.countDocuments({}),
    Message.countDocuments({ deletedAt: null }),
    Message.countDocuments({ deletedAt: { $ne: null } }),
    countByStatus(Review, 'moderationStatus', REVIEW_MODERATION_STATUSES),
    countByStatus(ReviewReport, 'status', REPORT_STATUSES)
  ])

  return {
    users: { total: users, active: activeUsers, suspended: suspendedUsers, admins },
    skills: { total: skills, teach: teachSkills, learn: learnSkills },
    exchangeRequests,
    sessions,
    messages: { total: messages, active: activeMessages, deleted: deletedMessages },
    reviews,
    reports
  }
}

const listAuditLogs = async (actorId, query) => {
  await assertAdmin(actorId)
  return auditService.list(query)
}

module.exports = {
  assertAdmin,
  listUsers,
  getUser,
  suspendUser,
  restoreUser,
  listModeration,
  getReview,
  moderateReview,
  listReports,
  getReport,
  decideReport,
  statistics,
  listAuditLogs
}
