const Notification = require('../models/Notification')
const User = require('../models/User')
const AppError = require('../utils/AppError')
const logger = require('../utils/logger')
const { buildPagination } = require('../utils/pagination')
const notificationOutbox = require('./notificationOutbox.service')
const {
  defaultPreferences,
  normalizePreferences,
  toNotificationDto,
  safeEmit
} = require('./notificationDelivery')

const countUnread = async (userId) =>
  Notification.countDocuments({ recipient: userId, isRead: false })

const withPreferences = (query) => query.populate('actor', 'name username profileImage')

const list = async (userId, { page, limit, isRead, type }) => {
  const filter = { recipient: userId }

  if (typeof isRead === 'boolean') filter.isRead = isRead
  if (type) filter.type = type

  const skip = (page - 1) * limit
  const [notifications, total, unreadCount] = await Promise.all([
    withPreferences(Notification.find(filter))
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Notification.countDocuments(filter),
    countUnread(userId)
  ])

  return {
    notifications: notifications.map(toNotificationDto),
    unreadCount,
    pagination: buildPagination(page, limit, total)
  }
}

const unreadCount = async (userId) => ({ unreadCount: await countUnread(userId) })

const findOwned = async (userId, notificationId) => {
  const notification = await withPreferences(
    Notification.findOne({ _id: notificationId, recipient: userId })
  )

  if (!notification) {
    throw new AppError('Notification not found', 404)
  }

  return notification
}

const markRead = async (userId, notificationId) => {
  const notification = await findOwned(userId, notificationId)
  let changed = false

  if (!notification.isRead) {
    notification.isRead = true
    notification.readAt = new Date()
    await notification.save()
    changed = true
  }

  const unread = await countUnread(userId)
  const dto = toNotificationDto(notification)

  if (changed) {
    safeEmit(userId, 'notification:read', {
      id: dto.id,
      isRead: true,
      readAt: dto.readAt,
      unreadCount: unread
    })
    safeEmit(userId, 'notification:unread-count', { unreadCount: unread })
  }

  return { notification: dto, unreadCount: unread }
}

const markAllRead = async (userId) => {
  const unread = await Notification.find({ recipient: userId, isRead: false })
    .select('_id')
    .lean()

  if (!unread.length) {
    return { modifiedCount: 0, unreadCount: 0 }
  }

  const readAt = new Date()
  const result = await Notification.updateMany(
    { recipient: userId, isRead: false },
    { $set: { isRead: true, readAt } }
  )

  safeEmit(userId, 'notification:read', {
    ids: unread.map((notification) => notification._id.toString()),
    isRead: true,
    readAt,
    unreadCount: 0
  })
  safeEmit(userId, 'notification:unread-count', { unreadCount: 0 })

  return { modifiedCount: result.modifiedCount, unreadCount: 0 }
}

const remove = async (userId, notificationId) => {
  const notification = await Notification.findOneAndDelete({
    _id: notificationId,
    recipient: userId
  })

  if (!notification) {
    throw new AppError('Notification not found', 404)
  }

  const unread = await countUnread(userId)
  const id = notification._id.toString()

  safeEmit(userId, 'notification:deleted', { id, unreadCount: unread })
  safeEmit(userId, 'notification:unread-count', { unreadCount: unread })

  return { notification: { id, deleted: true }, unreadCount: unread }
}

const getPreferences = async (userId) => {
  const user = await User.findById(userId).select('notificationPreferences').lean()
  return { preferences: normalizePreferences(user?.notificationPreferences) }
}

const updatePreferences = async (userId, updates) => {
  const $set = {}
  for (const category of ['exchangeRequests', 'sessions', 'messages']) {
    if (Object.prototype.hasOwnProperty.call(updates, category)) {
      $set[`notificationPreferences.${category}`] = updates[category]
    }
  }

  const user = await User.findByIdAndUpdate(userId, { $set }, {
    new: true,
    runValidators: true
  })
    .select('notificationPreferences')
    .lean()

  if (!user) {
    throw new AppError('User not found', 404)
  }

  return { preferences: normalizePreferences(user.notificationPreferences) }
}

const notify = (payload) => notificationOutbox.enqueueAndDispatch(payload)

const notifySafely = async (payload) => {
  try {
    return await notify(payload)
  } catch (error) {
    logger.error('Could not queue notification', { error: error.message })
    return null
  }
}

module.exports = {
  list,
  unreadCount,
  markRead,
  markAllRead,
  remove,
  getPreferences,
  updatePreferences,
  countUnread,
  notify,
  notifySafely,
  toNotificationDto,
  defaultPreferences
}
