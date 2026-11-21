let io = null

const setIO = (server) => {
  io = server
}

const conversationRoom = (conversationId) => `conversation:${conversationId}`
const viewingRoom = (conversationId) => `viewing:${conversationId}`
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

const isViewingConversation = (conversationId, userId) => {
  if (!io) return false
  const room = io.sockets.adapter.rooms.get(viewingRoom(conversationId))
  if (!room) return false

  for (const socketId of room) {
    const socket = io.sockets.sockets.get(socketId)
    if (socket?.data?.user?.id?.toString() === userId.toString()) return true
  }
  return false
}

module.exports = {
  setIO,
  conversationRoom,
  userRoom,
  emitToConversation,
  emitToUser,
  isViewingConversation
}
