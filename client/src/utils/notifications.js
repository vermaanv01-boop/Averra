export const NOTIFICATION_GROUPS = [
  {
    id: 'exchangeRequests',
    label: 'Exchange requests',
    preferenceKey: 'exchangeRequests',
    types: ['exchange_request', 'exchange_accepted', 'exchange_rejected', 'exchange_cancelled']
  },
  {
    id: 'sessions',
    label: 'Session activities',
    preferenceKey: 'sessions',
    types: [
      'session_invitation',
      'session_confirmed',
      'session_declined',
      'session_rescheduled',
      'session_cancelled',
      'session_completed'
    ]
  },
  {
    id: 'messages',
    label: 'Messages',
    preferenceKey: 'messages',
    types: ['new_message']
  },
  {
    id: 'reviews',
    label: 'Reviews received',
    preferenceKey: 'exchangeRequests',
    types: ['review_received']
  }
]

export const NOTIFICATION_TYPES = NOTIFICATION_GROUPS.flatMap((group) => group.types)

export const NOTIFICATION_TYPE_LABELS = {
  exchange_request: 'Exchange request',
  exchange_accepted: 'Exchange accepted',
  exchange_rejected: 'Exchange declined',
  exchange_cancelled: 'Exchange cancelled',
  session_invitation: 'Session invitation',
  session_confirmed: 'Session confirmed',
  session_declined: 'Session declined',
  session_rescheduled: 'Session rescheduled',
  session_cancelled: 'Session cancelled',
  session_completed: 'Session completed',
  new_message: 'New message',
  review_received: 'Review received'
}

export const DEFAULT_NOTIFICATION_PREFERENCES = {
  exchangeRequests: true,
  sessions: true,
  messages: true
}

export function isNotificationType(value) {
  return NOTIFICATION_TYPES.includes(value)
}

export function notificationGroup(type) {
  return NOTIFICATION_GROUPS.find((group) => group.types.includes(type)) || null
}

export function normalizePreferences(value) {
  const preferences = value && typeof value === 'object' ? value : {}
  return {
    exchangeRequests:
      typeof preferences.exchangeRequests === 'boolean'
        ? preferences.exchangeRequests
        : DEFAULT_NOTIFICATION_PREFERENCES.exchangeRequests,
    sessions:
      typeof preferences.sessions === 'boolean'
        ? preferences.sessions
        : DEFAULT_NOTIFICATION_PREFERENCES.sessions,
    messages:
      typeof preferences.messages === 'boolean'
        ? preferences.messages
        : DEFAULT_NOTIFICATION_PREFERENCES.messages
  }
}

function actorObject(notification) {
  const actor = notification?.actor
  return actor && typeof actor === 'object' ? actor : null
}

export function actorId(notification) {
  const actor = notification?.actor
  return actorObject(notification) ? actor.id || '' : typeof actor === 'string' ? actor : ''
}

export function actorName(notification) {
  const actor = actorObject(notification)
  return actor?.name || actor?.username || 'Someone'
}

export function actorUsername(notification) {
  return actorObject(notification)?.username || ''
}

export function actorImage(notification) {
  return actorObject(notification)?.profileImage || ''
}

export function notificationDestination(notification) {
  const id = notification?.relatedEntity
  const kind = notification?.relatedEntityType
  if (!id || !kind) return null

  if (kind === 'Conversation') return { pathname: '/app/messages', search: `?conversation=${encodeURIComponent(id)}` }
  if (kind === 'Message') return { pathname: '/app/messages', search: `?message=${encodeURIComponent(id)}` }
  if (kind === 'ExchangeRequest') return { pathname: '/app', search: `?request=${encodeURIComponent(id)}` }
  if (kind === 'Session') return { pathname: '/app/sessions', search: `?session=${encodeURIComponent(id)}` }
  if (kind === 'Review') {
    const username = actorUsername(notification)
    if (!username) return null
    return { pathname: `/app/users/${encodeURIComponent(username)}`, search: '?review=1' }
  }
  return null
}

export function upsertNotification(notifications, incoming) {
  if (!incoming?.id) return notifications
  const index = notifications.findIndex((notification) => notification.id === incoming.id)
  if (index < 0) return [incoming, ...notifications]
  const next = [...notifications]
  next[index] = { ...next[index], ...incoming }
  return next
}

export function applyNotificationRead(notifications, payload) {
  const ids = new Set(payload?.ids || (payload?.id ? [payload.id] : []))
  if (ids.size === 0) return notifications
  return notifications.map((notification) =>
    ids.has(notification.id)
      ? { ...notification, isRead: true, readAt: payload.readAt || notification.readAt || new Date().toISOString() }
      : notification
  )
}

export function removeNotificationById(notifications, id) {
  return notifications.filter((notification) => notification.id !== id)
}

export function formatNotificationTime(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const minutes = Math.floor((Date.now() - date.getTime()) / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date)
}
