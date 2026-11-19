let io = null

const setIO = (server) => {
  io = server
}

const conversationRoom = (conversationId) => `conversation:${conversationId}`
const userRoom = (userId) => `user:${userId}`

const emitToConversation = (conversationId, event, payload, exceptSocketId) => {
  if (!io) return
  const room = io.to(conversationRoom(conversationId))
  if (exceptSocketId) room.except(exceptSocketId)
  room.emit(event, payload)
}

const emitToUser = (userId, event, payload) => {
  if (!io) return
  io.to(userRoom(userId)).emit(event, payload)
}

module.exports = { setIO, conversationRoom, userRoom, emitToConversation, emitToUser }
