const Conversation = require('../models/Conversation')
const events = require('../services/messagingEvents')

const connections = new Map()

const contactIds = async (userId) => {
  const conversations = await Conversation.find({ participants: userId })
    .select('participants')
    .lean()

  const contacts = new Set()
  for (const conversation of conversations) {
    for (const participant of conversation.participants) {
      const id = participant.toString()
      if (id !== userId) contacts.add(id)
    }
  }
  return contacts
}

const add = async (socket) => {
  const userId = socket.data.user.id
  const existing = connections.get(userId)
  const wasOffline = !existing || existing.size === 0
  const sockets = existing || new Set()
  sockets.add(socket.id)
  connections.set(userId, sockets)
  socket.join(events.userRoom(userId))

  const contacts = await contactIds(userId)
  for (const contactId of contacts) {
    if (connections.has(contactId)) {
      socket.emit('presence:online', { userId: contactId })
    }
  }

  if (wasOffline) {
    for (const contactId of contacts) {
      events.emitToUser(contactId, 'presence:online', { userId })
    }
  }
}

const remove = async (socket) => {
  const userId = socket.data.user.id
  const sockets = connections.get(userId)
  if (!sockets) return

  sockets.delete(socket.id)
  if (sockets.size > 0) return

  connections.delete(userId)
  const contacts = await contactIds(userId)
  for (const contactId of contacts) {
    events.emitToUser(contactId, 'presence:offline', { userId })
  }
}

const isOnline = (userId) => connections.has(userId)

module.exports = { add, remove, isOnline }
