const events = require('../services/messagingEvents')

const EXPIRY_MS = 3000

const active = new Map()
const byUser = new Map()

const keyFor = (conversationId, userId) => `${conversationId}:${userId}`

const clear = (key) => {
  const entry = active.get(key)
  if (!entry) return null
  clearTimeout(entry.timer)
  active.delete(key)
  byUser.get(entry.userId)?.delete(key)
  return entry
}

const emitStop = (conversationId, userId, exceptSocketId) =>
  events.emitToConversation(
    conversationId,
    'typing:stop',
    { conversationId, user: { id: userId } },
    exceptSocketId
  )

const start = (conversationId, userId, socketId) => {
  const key = keyFor(conversationId, userId)
  clear(key)

  if (!byUser.has(userId)) byUser.set(userId, new Set())
  byUser.get(userId).add(key)

  const timer = setTimeout(() => {
    active.delete(key)
    byUser.get(userId)?.delete(key)
    emitStop(conversationId, userId)
  }, EXPIRY_MS)

  active.set(key, { timer, userId, socketId })
}

const stop = (conversationId, userId) => {
  const entry = clear(keyFor(conversationId, userId))
  if (entry) emitStop(conversationId, userId, entry.socketId)
}

const clearUser = (userId) => {
  for (const key of byUser.get(userId) || []) {
    const entry = clear(key)
    if (entry) {
      const conversationId = key.slice(0, key.lastIndexOf(':'))
      emitStop(conversationId, userId, entry.socketId)
    }
  }
  byUser.delete(userId)
}

module.exports = { start, stop, clearUser }
