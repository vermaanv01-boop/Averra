const events = require('../services/messagingEvents')
const { getSharedState } = require('../services/sharedState.service')

const EXPIRY_MS = 3000
const timers = new Map()

const keyFor = (conversationId, userId) => `${conversationId}:${userId}`

const clearTimer = (key) => {
  const timer = timers.get(key)
  if (!timer) return
  clearTimeout(timer)
  timers.delete(key)
}

const emitStop = (conversationId, userId, exceptSocketId) =>
  events.emitToConversation(
    conversationId,
    'typing:stop',
    { conversationId, user: { id: userId } },
    exceptSocketId
  )

const start = async (conversationId, userId, user, socketId) => {
  const key = keyFor(conversationId, userId)
  clearTimer(key)

  const value = {
    userId,
    socketId,
    conversationId,
    user: user || { id: userId }
  }

  await getSharedState().typingSet(userId, key, value, EXPIRY_MS)

  const timer = setTimeout(() => {
    timers.delete(key)
    Promise.resolve(getSharedState().typingDelete(key))
      .then(() => emitStop(conversationId, userId))
      .catch(() => {})
  }, EXPIRY_MS)
  timers.set(key, timer)
}

const stop = async (conversationId, userId, socketId) => {
  const key = keyFor(conversationId, userId)
  const state = getSharedState()
  const value = await state.typingGet(key)
  clearTimer(key)
  await state.typingDelete(key)
  emitStop(conversationId, userId, socketId || value?.socketId)
}

const clearUser = async (userId, socketId) => {
  const state = getSharedState()
  const keys = await state.typingUserKeys(userId)

  for (const key of keys) {
    clearTimer(key)
    await state.typingDelete(key)
    const conversationId = key.slice(0, key.lastIndexOf(':'))
    emitStop(conversationId, userId, socketId)
  }
}

const reset = () => {
  for (const timer of timers.values()) clearTimeout(timer)
  timers.clear()
}

module.exports = { start, stop, clearUser, reset }
