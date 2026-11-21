const Conversation = require('../models/Conversation')
const events = require('../services/messagingEvents')
const { getSharedState } = require('../services/sharedState.service')

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
  const state = getSharedState()
  const result = await state.presenceAdd(userId, socket.id)
  socket.join(events.userRoom(userId))

  const contacts = await contactIds(userId)
  for (const contactId of contacts) {
    if (await state.presenceExists(contactId)) {
      socket.emit('presence:online', { userId: contactId })
    }
  }

  if (result.added || result.count === 1) {
    for (const contactId of contacts) {
      events.emitToUser(contactId, 'presence:online', { userId })
    }
  }
}

const remove = async (socket) => {
  const userId = socket.data.user.id
  const result = await getSharedState().presenceRemove(userId, socket.id)
  if (!result.removed || result.count > 0) return

  const contacts = await contactIds(userId)
  for (const contactId of contacts) {
    events.emitToUser(contactId, 'presence:offline', { userId })
  }
}

const isOnline = async (userId) => getSharedState().presenceExists(userId)

const reset = () => getSharedState().reset()

module.exports = { add, remove, isOnline, reset }
