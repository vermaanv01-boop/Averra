const Notification = require('../models/Notification')
const User = require('../models/User')
const logger = require('../utils/logger')
const { NOTIFICATION_CATEGORIES, NOTIFICATION_TYPE_CATEGORY } = require('../utils/constants')
const { emitToUser } = require('./messagingEvents')
const { withSession, createWithSession } = require('./transaction.service')

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
    logger.error('Notification socket emit failed', { event, error: error.message })
  }
}

const isCategoryEnabled = (preferences, category) => {
  if (!category) return true
  return normalizePreferences(preferences)[category] !== false
}

const deliver = async (payload, session = null) => {
  const recipient = idString(payload.recipientId)
  if (!recipient) return null

  if (payload.actorId && recipient === idString(payload.actorId)) return null

  const category = NOTIFICATION_TYPE_CATEGORY[payload.type]
  const user = await withSession(
    User.findById(recipient).select('notificationPreferences'),
    session
  ).lean()

  if (!user || !isCategoryEnabled(user.notificationPreferences, category)) return null

  const dedupeKey = payload.eventId ? `${payload.type}:${recipient}:${payload.eventId}` : undefined

  let notification
  try {
    notification = await createWithSession(Notification, {
      recipient,
      actor: payload.actorId ? idString(payload.actorId) : null,
      type: payload.type,
      title: payload.title,
      message: payload.message,
      relatedEntity: payload.relatedEntityId ? idString(payload.relatedEntityId) : null,
      relatedEntityType: payload.relatedEntityId ? payload.relatedEntityType : null,
      dedupeKey
    }, session)
  } catch (error) {
    if (error.code === 11000 && dedupeKey) return null
    throw error
  }

  await notification.populate('actor', 'name username profileImage')
  const dto = toNotificationDto(notification)

  safeEmit(recipient, 'notification:new', dto)
  const unread = await withSession(
    Notification.countDocuments({ recipient, isRead: false }),
    session
  )
  safeEmit(recipient, 'notification:unread-count', { unreadCount: unread })

  return dto
}

module.exports = {
  defaultPreferences,
  normalizePreferences,
  toNotificationDto,
  isCategoryEnabled,
  deliver
}
