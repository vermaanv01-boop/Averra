const ExchangeRequest = require('../models/ExchangeRequest')
const Skill = require('../models/Skill')
const User = require('../models/User')
const AppError = require('../utils/AppError')
const { ACTIVE_REQUEST_STATUSES } = require('../utils/constants')
const { buildPagination } = require('../utils/pagination')
const messagingService = require('./messaging.service')
const notificationService = require('./notification.service')
const ratingService = require('./rating.service')
const transaction = require('./transaction.service')

const transitionNotifications = {
  accept: {
    type: 'exchange_accepted',
    title: 'Exchange request accepted',
    message: 'Your exchange request was accepted.',
    recipient: (request) => request.sender.toString()
  },
  reject: {
    type: 'exchange_rejected',
    title: 'Exchange request rejected',
    message: 'Your exchange request was rejected.',
    recipient: (request) => request.sender.toString()
  },
  cancel: {
    type: 'exchange_cancelled',
    title: 'Exchange request cancelled',
    message: 'An exchange request was cancelled.',
    recipient: (request) => request.recipient.toString()
  }
}

const transitions = {
  accept: { from: 'pending', role: 'recipient', to: 'accepted', timestamp: 'respondedAt' },
  reject: { from: 'pending', role: 'recipient', to: 'rejected', timestamp: 'respondedAt' },
  cancel: { from: 'pending', role: 'sender', to: 'cancelled', timestamp: null },
  complete: { from: 'accepted', role: 'participant', to: 'completed', timestamp: 'completedAt' }
}

const actionLabels = {
  accept: 'accepted',
  reject: 'rejected',
  cancel: 'cancelled',
  complete: 'completed'
}

const populateRequest = (query) =>
  query
    .populate('sender', 'name username profileImage')
    .populate('recipient', 'name username profileImage')
    .populate('offeredSkill', 'name category proficiency type')
    .populate('requestedSkill', 'name category proficiency type')

const toUserSummary = (user) =>
  user
    ? {
        id: user._id.toString(),
        name: user.name,
        username: user.username,
        profileImage: user.profileImage
      }
    : null

const toSkillSummary = (skill) =>
  skill
    ? {
        id: skill._id.toString(),
        name: skill.name,
        category: skill.category,
        proficiency: skill.proficiency,
        type: skill.type
      }
    : null

const toRequestDto = (request) => ({
  id: request._id.toString(),
  sender: toUserSummary(request.sender),
  recipient: toUserSummary(request.recipient),
  offeredSkill: toSkillSummary(request.offeredSkill),
  requestedSkill: toSkillSummary(request.requestedSkill),
  status: request.status,
  respondedAt: request.respondedAt,
  completedAt: request.completedAt,
  createdAt: request.createdAt,
  updatedAt: request.updatedAt
})

const getByIdForUser = async (userId, requestId) => {
  const request = await populateRequest(ExchangeRequest.findById(requestId)).lean()

  if (!request) {
    throw new AppError('Exchange request not found', 404)
  }

  const isParticipant =
    request.sender?._id?.toString() === userId || request.recipient?._id?.toString() === userId

  if (!isParticipant) {
    throw new AppError('Exchange request not found', 404)
  }

  return toRequestDto(request)
}

const create = async (senderId, { recipientId, offeredSkillId, requestedSkillId }) => {
  if (senderId === recipientId) {
    throw new AppError('You cannot send an exchange request to yourself', 400)
  }

  const recipientExists = await User.exists({ _id: recipientId })
  if (!recipientExists) {
    throw new AppError('Recipient not found', 404)
  }

  const offeredSkill = await Skill.findOne({
    _id: offeredSkillId,
    user: senderId,
    type: 'teach'
  })
  if (!offeredSkill) {
    throw new AppError('You do not teach the offered skill', 400)
  }

  const requestedSkill = await Skill.findOne({
    _id: requestedSkillId,
    user: recipientId,
    type: 'teach'
  })
  if (!requestedSkill) {
    throw new AppError('The recipient does not teach the requested skill', 400)
  }

  try {
    const result = await transaction.withDbTransaction(async (session) => {
      const duplicate = await transaction.withSession(
        ExchangeRequest.findOne({
          status: { $in: ACTIVE_REQUEST_STATUSES },
          $or: [
            { sender: senderId, recipient: recipientId },
            { sender: recipientId, recipient: senderId }
          ],
          $and: [
            {
              $or: [
                { offeredSkill: offeredSkillId, requestedSkill: requestedSkillId },
                { offeredSkill: requestedSkillId, requestedSkill: offeredSkillId }
              ]
            }
          ]
        }),
        session
      ).lean()

      if (duplicate) {
        throw new AppError('An active exchange request for these skills already exists', 409)
      }

      const request = await transaction.createWithSession(ExchangeRequest, {
        sender: senderId,
        recipient: recipientId,
        offeredSkill: offeredSkillId,
        requestedSkill: requestedSkillId
      }, session)

      await notificationService.notifySafely({
        recipientId: userIdToString(recipientId),
        actorId: userIdToString(senderId),
        type: 'exchange_request',
        title: 'New exchange request',
        message: 'You received a new exchange request.',
        relatedEntityId: request.id,
        relatedEntityType: 'ExchangeRequest',
        eventId: `${request.id}:created`
      })

      return { requestId: request.id }
    })

    return await getByIdForUser(userIdToString(senderId), result.requestId)
  } catch (error) {
    if (error.code === 11000) {
      throw new AppError('An active exchange request for these skills already exists', 409)
    }
    throw error
  }
}

const userIdToString = (userId) => userId.toString()

const list = async (userId, query) => {
  const filter = {}

  if (query.box === 'incoming') {
    filter.recipient = userId
  } else if (query.box === 'outgoing') {
    filter.sender = userId
  } else {
    filter.$or = [{ sender: userId }, { recipient: userId }]
  }

  if (query.status) {
    filter.status = query.status
  }

  const sort = query.sort === 'oldest' ? { createdAt: 1 } : { createdAt: -1 }
  const skip = (query.page - 1) * query.limit

  const [items, total] = await Promise.all([
    populateRequest(ExchangeRequest.find(filter))
      .sort(sort)
      .skip(skip)
      .limit(query.limit)
      .lean(),
    ExchangeRequest.countDocuments(filter)
  ])

  return {
    items: items.map(toRequestDto),
    pagination: buildPagination(query.page, query.limit, total)
  }
}

const transition = async (userId, requestId, action) => {
  const rule = transitions[action]

  const result = await transaction.withDbTransaction(async (session) => {
    const request = await transaction.withSession(ExchangeRequest.findById(requestId), session)

    if (!request) {
      throw new AppError('Exchange request not found', 404)
    }

    const isSender = request.sender.toString() === userId
    const isRecipient = request.recipient.toString() === userId

    if (!isSender && !isRecipient) {
      throw new AppError('Exchange request not found', 404)
    }

    if (rule.role === 'sender' && !isSender) {
      throw new AppError('Only the sender can cancel this request', 403)
    }

    if (rule.role === 'recipient' && !isRecipient) {
      throw new AppError('Only the recipient can manage this request', 403)
    }

    if (request.status !== rule.from) {
      throw new AppError(`Only ${rule.from} requests can be ${actionLabels[action]}`, 409)
    }

    request.status = rule.to
    if (rule.timestamp) {
      request[rule.timestamp] = new Date()
    }
    await request.save({ session })

    if (action === 'accept') {
      await messagingService.ensureConversationForRequest(requestId, session)
    }

    const notification = transitionNotifications[action]
    if (notification) {
      await notificationService.notifySafely({
        recipientId: notification.recipient(request),
        actorId: userId,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        relatedEntityId: requestId,
        relatedEntityType: 'ExchangeRequest',
        eventId: action
      })
    }

    return {
      senderId: request.sender.toString(),
      recipientId: request.recipient.toString()
    }
  })

  if (action === 'complete') {
    await Promise.all([
      ratingService.recalculateSafely(result.senderId),
      ratingService.recalculateSafely(result.recipientId)
    ])
  }

  return getByIdForUser(userId, requestId)
}

module.exports = { create, list, getByIdForUser, transition }
