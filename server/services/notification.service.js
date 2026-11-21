const Notification = require('../models/Notification')
const User = require('../models/User')
const AppError = require('../utils/AppError')
const logger = require('../utils/logger')
const { buildPagination } = require('../utils/pagination')
const {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_TYPE_CATEGORY
} = require('../utils/constants')
const { emitToUser } = require('./messagingEvents')

const idString = (value) => {
  if (!value) return null
  return value._id ? value._id.toString() : value.toString()
}

const defaultPreferences = () => ({
  exchangeRequests: true,
  sessions: true,
  messages: true
})

const normalizePreferences = (preferences) => {
  const defaults = defaultPreferences()
  for (const category of NOTIFICATION_CATEGORIES) {
    if (typeof preferences?.[category] === 'boolean') {
      defaults[category] = preferences[category]
    }
  }
  return defaults
}

const toUserSummary = (user) => {
  if (!user || !user.name) return null
  return {
    id: user._id.toString(),
    name: user.name,
    username: user.username,
    profileImage: user.profileImage
  }
}

const toNotificationDto = (notification) => ({
  id: notification._id.toString(),
  recipient: idString(notification.recipient),
  actor: notification.actor && typeof notification.actor === 'object'
    ? toUserSummary(notification.actor) || idString(notification.actor)
    : idString(notification.actor),
  type: notification.type,
  title: notification.title,
  message: notification.message,
  relatedEntity: idString(notification.relatedEntity),
  relatedEntityType: notification.relatedEntityType || null,
  isRead: notification.isRead,
  readAt: notification.readAt || null,
  createdAt: notification.createdAt,
  updatedAt: notification.updatedAt
})

const safeEmit = (userId, event, payload) => {
  try {
    emitToUser(userId, event, payload)
  } catch (error) {
    logger.error(`Notification socket emit failed for ${event}: ${error.message}`)
  }
}

const countUnread = async (userId) =>
  Notification.countDocuments({ recipient: userId, isRead: false })

const withPreferences = (query) => query.populate('actor', 'name username profileImage')

const list = async (userId, { page, limit, isRead, type }) => {
  const filter = { recipient: userId }

  if (typeof isRead === 'boolean') {
    filter.isRead = isRead
  }
  if (type) {
    filter.type = type
  }

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
  for (const category of NOTIFICATION_CATEGORIES) {
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

const isCategoryEnabled = (preferences, category) => {
  if (!category) return true
  return normalizePreferences(preferences)[category] !== false
}

const notify = async ({
  recipientId,
  actorId = null,
  type,
  title,
  message,
  relatedEntityId = null,
  relatedEntityType = null,
  eventId = null
}) => {
  const recipient = idString(recipientId)

  if (!recipient) {
    return null
  }

  if (actorId && recipient === idString(actorId)) {
    return null
  }

  const category = NOTIFICATION_TYPE_CATEGORY[type]
  const user = await User.findById(recipient).select('notificationPreferences').lean()

  if (!user || !isCategoryEnabled(user.notificationPreferences, category)) {
    return null
  }

  const dedupeKey = eventId ? `${type}:${recipient}:${eventId}` : undefined

  let notification
  try {
    notification = await Notification.create({
      recipient,
      actor: actorId ? idString(actorId) : null,
      type,
      title,
      message,
      relatedEntity: relatedEntityId ? idString(relatedEntityId) : null,
      relatedEntityType: relatedEntityId ? relatedEntityType : null,
      dedupeKey
    })
  } catch (error) {
    if (error.code === 11000 && dedupeKey) {
      return null
    }
    throw error
  }

  await notification.populate('actor', 'name username profileImage')
  const dto = toNotificationDto(notification)

  safeEmit(recipient, 'notification:new', dto)
  const unread = await countUnread(recipient)
  safeEmit(recipient, 'notification:unread-count', { unreadCount: unread })

  return dto
}

const isCategoryEnabled = (preferences, category) => {
  if (!category) return true
  return normalizePreferences(preferences)[category] !== false
}

const notifySafely = async (payload) => {
  try {
    return await notify(payload)
  } catch (error) {
    logger.error(`Could not create notification: ${error.message}`)
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
  toNotificationDto
}
