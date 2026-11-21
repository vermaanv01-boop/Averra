const mongoose = require('mongoose')
const Conversation = require('../models/Conversation')
const Message = require('../models/Message')
const ExchangeRequest = require('../models/ExchangeRequest')
const AppError = require('../utils/AppError')
const { buildPagination } = require('../utils/pagination')
const events = require('./messagingEvents')
const notificationService = require('./notification.service')
const transaction = require('./transaction.service')

const idOf = (value) => {
  if (!value) return null
  return value._id ? value._id.toString() : value.toString()
}

const toUserSummary = (user) =>
  user && user.name
    ? { id: user._id.toString(), name: user.name, username: user.username, profileImage: user.profileImage }
    : null

const toMessageDto = (message) => {
  const sender = toUserSummary(message.sender)
  return {
    id: message._id.toString(),
    conversationId: idOf(message.conversation),
    sender: sender || idOf(message.sender),
    content: message.deletedAt ? '' : message.content,
    messageType: message.messageType,
    clientMessageId: message.clientMessageId || null,
    deliveredTo: (message.deliveredTo || []).map(idOf),
    readBy: (message.readBy || []).map(idOf),
    editedAt: message.editedAt || null,
    deletedAt: message.deletedAt || null,
    createdAt: message.createdAt,
    updatedAt: message.updatedAt
  }
}

const toConversationDto = (conversation, viewerId, unreadCount = 0) => {
  const lastMessage = conversation.lastMessage
  return {
    id: conversation._id.toString(),
    participants: (conversation.participants || []).map(toUserSummary).filter(Boolean),
    exchangeRequest: conversation.exchangeRequest
      ? {
          id: idOf(conversation.exchangeRequest),
          status: conversation.exchangeRequest.status || null
        }
      : null,
    lastMessage: lastMessage
      ? {
          id: lastMessage._id.toString(),
          content: lastMessage.deletedAt ? '' : lastMessage.content,
          sender: idOf(lastMessage.sender),
          createdAt: lastMessage.createdAt
        }
      : null,
    lastMessageAt: conversation.lastMessageAt || null,
    unreadCount,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt
  }
}

const isParticipant = (conversation, userId) =>
  (conversation.participants || []).some((participant) => idOf(participant) === userId.toString())

const populateConversation = (query) =>
  query
    .populate('participants', 'name username profileImage')
    .populate('exchangeRequest', 'status')
    .populate({
      path: 'lastMessage',
      select: 'content sender createdAt deletedAt'
    })

const findConversationForUser = async (userId, conversationId) => {
  const conversation = await Conversation.findById(conversationId)

  if (!conversation || !isParticipant(conversation, userId)) {
    throw new AppError('Conversation not found', 404)
  }

  return conversation
}

const ensureConversationForRequest = async (requestId, session = null) => {
  const request = await transaction.withSession(ExchangeRequest.findById(requestId), session)

  if (!request) {
    throw new AppError('Exchange request not found', 404)
  }

  if (request.status !== 'accepted') {
    throw new AppError('Conversations are available only for accepted exchange requests', 409)
  }

  const participants = [request.sender.toString(), request.recipient.toString()]

  try {
    const options = { upsert: true, new: true, setDefaultsOnInsert: true }
    if (session) options.session = session
    return await Conversation.findOneAndUpdate(
      { exchangeRequest: request._id },
      { $setOnInsert: { participants, exchangeRequest: request._id } },
      options
    )
  } catch (error) {
    if (error.code === 11000) {
      return transaction.withSession(Conversation.findOne({ exchangeRequest: request._id }), session)
    }
    throw error
  }
}

const syncAcceptedConversations = async (userId) => {
  const requests = await ExchangeRequest.find({
    status: 'accepted',
    $or: [{ sender: userId }, { recipient: userId }]
  })
    .select('_id')
    .lean()

  await Promise.all(requests.map((request) => ensureConversationForRequest(request._id)))
}

const unreadCounts = async (userId) => {
  const conversations = await Conversation.find({ participants: userId }).select('_id').lean()

  if (!conversations.length) {
    return { total: 0, conversations: [] }
  }

  const objectId = new mongoose.Types.ObjectId(userId.toString())
  const rows = await Message.aggregate([
    {
      $match: {
        conversation: { $in: conversations.map((conversation) => conversation._id) },
        sender: { $ne: objectId },
        readBy: { $ne: objectId },
        deletedAt: null
      }
    },
    { $group: { _id: '$conversation', count: { $sum: 1 } } }
  ])

  const byConversation = rows.map((row) => ({
    conversationId: row._id.toString(),
    unreadCount: row.count
  }))

  return {
    total: byConversation.reduce((sum, row) => sum + row.unreadCount, 0),
    conversations: byConversation
  }
}

const listConversations = async (userId) => {
  await syncAcceptedConversations(userId)

  const [conversations, counts] = await Promise.all([
    populateConversation(
      Conversation.find({ participants: userId }).sort({ lastMessageAt: -1, updatedAt: -1 })
    ).lean(),
    unreadCounts(userId)
  ])

  const unreadByConversation = new Map(
    counts.conversations.map((row) => [row.conversationId, row.unreadCount])
  )

  return {
    conversations: conversations.map((conversation) =>
      toConversationDto(conversation, userId, unreadByConversation.get(conversation._id.toString()) || 0)
    )
  }
}

const getConversation = async (userId, conversationId) => {
  const conversation = await populateConversation(
    Conversation.findById(conversationId)
  ).lean()

  if (!conversation || !isParticipant(conversation, userId)) {
    throw new AppError('Conversation not found', 404)
  }

  const counts = await unreadCounts(userId)
  const unreadCount =
    counts.conversations.find((row) => row.conversationId === conversation._id.toString())
      ?.unreadCount || 0

  return { conversation: toConversationDto(conversation, userId, unreadCount) }
}

const serializeMessage = async (message) => {
  const populated = await Message.findById(message._id)
    .populate('sender', 'name username profileImage')
    .lean()
  return toMessageDto(populated)
}

const listMessages = async (userId, conversationId, { page, limit }) => {
  await findConversationForUser(userId, conversationId)

  const filter = { conversation: conversationId, deletedAt: null }
  const [messages, total] = await Promise.all([
    Message.find(filter)
      .populate('sender', 'name username profileImage')
      .sort({ createdAt: 1, _id: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Message.countDocuments(filter)
  ])

  return {
    messages: messages.map(toMessageDto),
    pagination: buildPagination(page, limit, total)
  }
}

const createMessage = async (userId, conversationId, { content, clientMessageId, messageType }) => {
  const conversation = await findConversationForUser(userId, conversationId)
  const otherParticipant = conversation.participants
    .map(idOf)
    .find((participantId) => participantId !== userId.toString())

  const result = await transaction.withDbTransaction(async (session) => {
    let message
    let created = false

    try {
      const options = { upsert: true, new: true, setDefaultsOnInsert: true, rawResult: true }
      if (session) options.session = session
      const upsert = await Message.findOneAndUpdate(
        { conversation: conversationId, sender: userId, clientMessageId },
        {
          $setOnInsert: {
            conversation: conversationId,
            sender: userId,
            content,
            messageType,
            clientMessageId,
            deliveredTo: otherParticipant ? [otherParticipant] : []
          }
        },
        options
      )
      message = upsert.value || upsert.lastErrorObject?.upserted
        ? upsert.value
        : await transaction.withSession(Message.findById(upsert.lastErrorObject.upserted), session)
      created = Boolean(upsert.lastErrorObject?.upserted)
    } catch (error) {
      if (error.code !== 11000) throw error
      message = await transaction.withSession(
        Message.findOne({ conversation: conversationId, sender: userId, clientMessageId }),
        session
      )
    }

    if (!message) throw new AppError('Message could not be created', 500)

    if (created) {
      await transaction.withSession(
        Conversation.updateOne(
          { _id: conversationId },
          { $set: { lastMessage: message._id, lastMessageAt: message.createdAt } }
        ),
        session
      )

      if (otherParticipant && !events.isViewingConversation(conversationId, otherParticipant)) {
        await notificationService.notifySafely({
          recipientId: otherParticipant,
          actorId: userId.toString(),
          type: 'new_message',
          title: 'New message',
          message: 'You received a new message.',
          relatedEntityId: message.id,
          relatedEntityType: 'Message',
          eventId: message.id
        })
      }
    }

    return { messageId: message._id, created }
  })

  const message = await Message.findById(result.messageId)
  const dto = await serializeMessage(message)
  if (result.created) events.emitToConversation(conversationId, 'message:new', dto)

  return { message: dto, created: result.created }
}

const findMessageForUser = async (userId, messageId) => {
  const message = await Message.findById(messageId)

  if (!message || message.deletedAt) {
    throw new AppError('Message not found', 404)
  }

  await findConversationForUser(userId, message.conversation)
  return message
}

const editMessage = async (userId, messageId, content) => {
  const message = await findMessageForUser(userId, messageId)

  if (message.sender.toString() !== userId.toString()) {
    throw new AppError('Only the sender can edit this message', 403)
  }

  message.content = content
  message.editedAt = new Date()
  await message.save()

  const dto = await serializeMessage(message)
  events.emitToConversation(idOf(message.conversation), 'message:updated', dto)
  return { message: dto }
}

const deleteMessage = async (userId, messageId) => {
  const message = await findMessageForUser(userId, messageId)

  if (message.sender.toString() !== userId.toString()) {
    throw new AppError('Only the sender can delete this message', 403)
  }

  message.deletedAt = new Date()
  await message.save()

  await Conversation.updateOne(
    { _id: message.conversation, lastMessage: message._id },
    { $set: { lastMessage: null, lastMessageAt: null } }
  )

  const payload = {
    id: message._id.toString(),
    conversationId: idOf(message.conversation),
    deletedAt: message.deletedAt
  }
  events.emitToConversation(payload.conversationId, 'message:deleted', payload)
  return { message: payload }
}

const markRead = async (userId, conversationId, messageId) => {
  await findConversationForUser(userId, conversationId)

  const filter = {
    conversation: conversationId,
    sender: { $ne: new mongoose.Types.ObjectId(userId.toString()) },
    readBy: { $ne: new mongoose.Types.ObjectId(userId.toString()) },
    deletedAt: null
  }

  if (messageId) {
    const message = await Message.findById(messageId)
    if (!message || idOf(message.conversation) !== conversationId) {
      throw new AppError('Message not found', 404)
    }
    if (idOf(message.sender) === userId.toString()) {
      throw new AppError('Cannot mark your own message as read', 400)
    }
    filter._id = messageId
  }

  const unread = await Message.find(filter).select('_id').lean()
  const messageIds = unread.map((message) => message._id.toString())

  if (messageIds.length) {
    await Message.updateMany(
      { _id: { $in: messageIds } },
      { $addToSet: { readBy: userId, deliveredTo: userId } }
    )
  }

  const payload = { conversationId, messageIds, readBy: userId.toString() }
  if (messageId) payload.messageId = messageId
  events.emitToConversation(conversationId, 'message:read', payload)
  return { messageIds, readBy: payload.readBy }
}

module.exports = {
  assertConversationMembership: findConversationForUser,
  ensureConversationForRequest,
  listConversations,
  getConversation,
  listMessages,
  createMessage,
  editMessage,
  deleteMessage,
  markRead,
  unreadCounts
}
