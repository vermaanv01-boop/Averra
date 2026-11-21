const Session = require('../models/Session')
const ExchangeRequest = require('../models/ExchangeRequest')
const AppError = require('../utils/AppError')
const { buildSchedule } = require('../utils/dateTime')
const { SESSION_ACTIVE_STATUSES } = require('../utils/constants')
const { buildPagination } = require('../utils/pagination')
const notificationService = require('./notification.service')
const transaction = require('./transaction.service')

const idString = (value) => {
  if (!value) return null
  return value._id ? value._id.toString() : value.toString()
}

const otherParticipant = (session, userId) =>
  (session.participants || [])
    .map(idString)
    .find((participantId) => participantId && participantId !== idString(userId))

const sortOptions = {
  upcoming: { startAt: 1 },
  latest: { startAt: -1 },
  oldest: { startAt: 1 }
}

const populateSession = (query) =>
  query
    .populate('proposedBy', 'name username profileImage')
    .populate('participants', 'name username profileImage')
    .populate('reschedulingHistory.proposedBy', 'name username profileImage')
    .populate('reschedulingHistory.resolvedBy', 'name username profileImage')
    .populate({
      path: 'exchangeRequest',
      select: 'sender recipient offeredSkill requestedSkill status createdAt',
      populate: [
        { path: 'sender', select: 'name username profileImage' },
        { path: 'recipient', select: 'name username profileImage' },
        { path: 'offeredSkill', select: 'name category proficiency type' },
        { path: 'requestedSkill', select: 'name category proficiency type' }
      ]
    })

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

const toRequestSummary = (request) =>
  request
    ? {
        id: request._id.toString(),
        status: request.status,
        sender: toUserSummary(request.sender),
        recipient: toUserSummary(request.recipient),
        offeredSkill: toSkillSummary(request.offeredSkill),
        requestedSkill: toSkillSummary(request.requestedSkill),
        createdAt: request.createdAt
      }
    : null

const toProposalDto = (proposal) => ({
  id: proposal._id.toString(),
  proposedBy: toUserSummary(proposal.proposedBy),
  scheduledDate: proposal.scheduledDate,
  startTime: proposal.startTime,
  duration: proposal.duration,
  timezone: proposal.timezone,
  startAt: proposal.startAt,
  endAt: proposal.endAt,
  status: proposal.status,
  proposedAt: proposal.proposedAt,
  resolvedAt: proposal.resolvedAt,
  resolvedBy: toUserSummary(proposal.resolvedBy)
})

const toSessionDto = (session) => ({
  id: session._id.toString(),
  exchangeRequest: toRequestSummary(session.exchangeRequest),
  proposedBy: toUserSummary(session.proposedBy),
  participants: (session.participants || []).map(toUserSummary),
  title: session.title,
  description: session.description,
  scheduledDate: session.scheduledDate,
  startTime: session.startTime,
  duration: session.duration,
  timezone: session.timezone,
  startAt: session.startAt,
  endAt: session.endAt,
  meetingMethod: session.meetingMethod,
  meetingLink: session.meetingLink,
  location: session.location,
  status: session.status,
  cancellationReason: session.cancellationReason,
  cancelledAt: session.cancelledAt,
  reschedulingHistory: (session.reschedulingHistory || []).map(toProposalDto),
  completedAt: session.completedAt,
  createdAt: session.createdAt,
  updatedAt: session.updatedAt
})

const findSession = async (sessionId, dbSession = null) => {
  const session = await transaction.withSession(Session.findById(sessionId), dbSession)

  if (!session) {
    throw new AppError('Session not found', 404)
  }

  return session
}

const assertParticipant = (session, userId) => {
  const isParticipant = session.participants.some((participant) => {
    const participantId = participant?._id ? participant._id.toString() : participant.toString()
    return participantId === userId
  })

  if (!isParticipant) {
    throw new AppError('Session not found', 404)
  }
}

const assertResponder = (session, userId) => {
  if (session.proposedBy.toString() === userId) {
    throw new AppError('The proposing participant cannot respond to this session', 403)
  }
}

const assertNoConflicts = async (participants, startAt, endAt, excludeSessionId, dbSession = null) => {
  const conflicts = await transaction.withSession(Session.find({
    _id: { $ne: excludeSessionId },
    status: 'confirmed',
    participants: { $in: participants.map((participant) => participant.toString()) },
    startAt: { $lt: endAt },
    endAt: { $gt: startAt }
  }), dbSession)
    .select('title scheduledDate startTime timezone startAt endAt')
    .lean()

  if (!conflicts.length) {
    return
  }

  throw new AppError(
    `Scheduling conflict: ${conflicts.length} confirmed session(s) overlap the proposed time`,
    409,
    conflicts.map((conflict) => ({
      id: conflict._id.toString(),
      title: conflict.title,
      startAt: conflict.startAt,
      endAt: conflict.endAt
    }))
  )
}

const getByIdForUser = async (userId, sessionId) => {
  const session = await populateSession(Session.findById(sessionId)).lean()

  if (!session) {
    throw new AppError('Session not found', 404)
  }

  assertParticipant(session, userId)
  return toSessionDto(session)
}

const create = async (userId, payload) => {
  const exchangeRequest = await ExchangeRequest.findById(payload.exchangeRequestId)

  if (!exchangeRequest) {
    throw new AppError('Exchange request not found', 404)
  }

  const participants = [exchangeRequest.sender, exchangeRequest.recipient]
  assertParticipant({ participants }, userId)

  if (exchangeRequest.status !== 'accepted') {
    throw new AppError('Sessions can only be proposed for accepted exchange requests', 409)
  }

  const { startAt, endAt } = buildSchedule(payload)

  try {
    const result = await transaction.withDbTransaction(async (session) => {
      const existingSession = await transaction.withSession(Session.findOne({
        exchangeRequest: exchangeRequest._id,
        status: { $in: SESSION_ACTIVE_STATUSES }
      }), session)

      if (existingSession) {
        throw new AppError('An active session already exists for this exchange request', 409)
      }

      const created = await transaction.createWithSession(Session, {
        exchangeRequest: exchangeRequest._id,
        proposedBy: userId,
        participants,
        title: payload.title,
        description: payload.description,
        scheduledDate: payload.scheduledDate,
        startTime: payload.startTime,
        duration: payload.duration,
        timezone: payload.timezone,
        startAt,
        endAt,
        meetingMethod: payload.meetingMethod,
        meetingLink: payload.meetingLink,
        location: payload.location
      }, session)

      await notificationService.notifySafely({
        recipientId: otherParticipant(created, userId),
        actorId: idString(userId),
        type: 'session_invitation',
        title: 'New session invitation',
        message: `You were invited to a session: ${created.title}.`,
        relatedEntityId: created.id,
        relatedEntityType: 'Session',
        eventId: `${created.id}:created`
      })

      return { sessionId: created.id }
    })

    return getByIdForUser(userId, result.sessionId)
  } catch (error) {
    if (error.code === 11000) {
      throw new AppError('An active session already exists for this exchange request', 409)
    }
    throw error
  }
}

const list = async (userId, query, preset = {}) => {
  const filter = { participants: userId, ...preset }

  if (query.status && !preset.status) {
    filter.status = query.status
  }

  if (query.from || query.to) {
    filter.startAt = {}

    if (query.from) {
      filter.startAt.$gte = new Date(`${query.from}T00:00:00.000Z`)
    }
    if (query.to) {
      filter.startAt.$lte = new Date(`${query.to}T23:59:59.999Z`)
    }
  }

  const skip = (query.page - 1) * query.limit
  const [sessions, total] = await Promise.all([
    populateSession(Session.find(filter))
      .sort(sortOptions[query.sort])
      .skip(skip)
      .limit(query.limit)
      .lean(),
    Session.countDocuments(filter)
  ])

  return {
    items: sessions.map(toSessionDto),
    pagination: buildPagination(query.page, query.limit, total)
  }
}

const listUpcoming = (userId, query) =>
  list(userId, query, {
    status: { $in: ['confirmed', 'reschedule_requested'] },
    endAt: { $gte: new Date() }
  })

const listPendingInvitations = (userId, query) =>
  list(userId, query, { status: 'pending', proposedBy: { $ne: userId } })

const listCompleted = (userId, query) => list(userId, query, { status: 'completed' })
const listCancelled = (userId, query) => list(userId, query, { status: 'cancelled' })

const respondToInvitation = async (userId, sessionId, action) => {
  await transaction.withDbTransaction(async (session) => {
    const current = await findSession(sessionId, session)
    assertParticipant(current, userId)
    assertResponder(current, userId)

    if (current.status !== 'pending') {
      throw new AppError('Only pending sessions can be accepted or declined', 409)
    }

    if (action === 'accept') {
      await assertNoConflicts(current.participants, current.startAt, current.endAt, current._id, session)
      current.status = 'confirmed'
    } else {
      current.status = 'declined'
    }

    await current.save({ session })

    await notificationService.notifySafely({
      recipientId: idString(current.proposedBy),
      actorId: idString(userId),
      type: action === 'accept' ? 'session_confirmed' : 'session_declined',
      title: action === 'accept' ? 'Session confirmed' : 'Session declined',
      message:
        action === 'accept'
          ? `Your session invitation was confirmed: ${current.title}.`
          : `Your session invitation was declined: ${current.title}.`,
      relatedEntityId: sessionId,
      relatedEntityType: 'Session',
      eventId: `${sessionId}:${action}`
    })
  })

  return getByIdForUser(userId, sessionId)
}

const requestReschedule = async (userId, sessionId, payload) => {
  await transaction.withDbTransaction(async (session) => {
    const current = await findSession(sessionId, session)
    assertParticipant(current, userId)

    if (current.status !== 'confirmed') {
      throw new AppError('Only confirmed sessions can be rescheduled', 409)
    }

    const { startAt, endAt } = buildSchedule(payload)
    await assertNoConflicts(current.participants, startAt, endAt, current._id, session)

    current.reschedulingHistory.push({
      proposedBy: userId,
      scheduledDate: payload.scheduledDate,
      startTime: payload.startTime,
      duration: payload.duration,
      timezone: payload.timezone,
      startAt,
      endAt
    })
    current.status = 'reschedule_requested'
    await current.save({ session })
    const proposal = current.reschedulingHistory[current.reschedulingHistory.length - 1]

    await notificationService.notifySafely({
      recipientId: otherParticipant(current, userId),
      actorId: idString(userId),
      type: 'session_rescheduled',
      title: 'Session reschedule requested',
      message: `A new time was proposed for the session: ${current.title}.`,
      relatedEntityId: sessionId,
      relatedEntityType: 'Session',
      eventId: `reschedule:${proposal._id.toString()}:requested`
    })
  })

  return getByIdForUser(userId, sessionId)
}

const respondToReschedule = async (userId, sessionId, proposalId, action) => {
  await transaction.withDbTransaction(async (session) => {
    const current = await findSession(sessionId, session)
    assertParticipant(current, userId)

    if (current.status !== 'reschedule_requested') {
      throw new AppError('There is no pending rescheduling proposal for this session', 409)
    }

    const proposal = current.reschedulingHistory.id(proposalId)

    if (!proposal) {
      throw new AppError('Rescheduling proposal not found', 404)
    }

    if (proposal.status !== 'pending') {
      throw new AppError('This rescheduling proposal has already been resolved', 409)
    }

    if (proposal.proposedBy.toString() === userId) {
      throw new AppError('The proposing participant cannot respond to their own proposal', 403)
    }

    if (action === 'accept') {
      await assertNoConflicts(current.participants, proposal.startAt, proposal.endAt, current._id, session)

      current.scheduledDate = proposal.scheduledDate
      current.startTime = proposal.startTime
      current.duration = proposal.duration
      current.timezone = proposal.timezone
      current.startAt = proposal.startAt
      current.endAt = proposal.endAt
      proposal.status = 'accepted'
    } else {
      proposal.status = 'rejected'
    }

    current.status = 'confirmed'
    proposal.resolvedAt = new Date()
    proposal.resolvedBy = userId
    await current.save({ session })

    await notificationService.notifySafely({
      recipientId: idString(proposal.proposedBy),
      actorId: idString(userId),
      type: 'session_rescheduled',
      title: action === 'accept' ? 'Session reschedule accepted' : 'Session reschedule rejected',
      message:
        action === 'accept'
          ? `Your proposed new time for ${current.title} was accepted.`
          : `Your proposed new time for ${current.title} was rejected.`,
      relatedEntityId: sessionId,
      relatedEntityType: 'Session',
      eventId: `reschedule:${proposal._id.toString()}:${action}`
    })
  })

  return getByIdForUser(userId, sessionId)
}

const cancel = async (userId, sessionId, reason) => {
  await transaction.withDbTransaction(async (session) => {
    const current = await findSession(sessionId, session)
    assertParticipant(current, userId)

    if (!SESSION_ACTIVE_STATUSES.includes(current.status)) {
      throw new AppError('Only active sessions can be cancelled', 409)
    }

    current.status = 'cancelled'
    current.cancellationReason = reason
    current.cancelledAt = new Date()

    for (const proposal of current.reschedulingHistory) {
      if (proposal.status === 'pending') {
        proposal.status = 'rejected'
        proposal.resolvedAt = new Date()
        proposal.resolvedBy = userId
      }
    }

    await current.save({ session })

    await notificationService.notifySafely({
      recipientId: otherParticipant(current, userId),
      actorId: idString(userId),
      type: 'session_cancelled',
      title: 'Session cancelled',
      message: `The session was cancelled: ${current.title}.`,
      relatedEntityId: sessionId,
      relatedEntityType: 'Session',
      eventId: `${sessionId}:cancelled`
    })
  })

  return getByIdForUser(userId, sessionId)
}

const complete = async (userId, sessionId) => {
  await transaction.withDbTransaction(async (session) => {
    const current = await findSession(sessionId, session)
    assertParticipant(current, userId)

    if (current.status !== 'confirmed') {
      throw new AppError('Only confirmed sessions can be completed', 409)
    }

    current.status = 'completed'
    current.completedAt = new Date()
    await current.save({ session })

    await notificationService.notifySafely({
      recipientId: otherParticipant(current, userId),
      actorId: idString(userId),
      type: 'session_completed',
      title: 'Session completed',
      message: `The session was marked as completed: ${current.title}.`,
      relatedEntityId: sessionId,
      relatedEntityType: 'Session',
      eventId: 'completed'
    })
  })

  return getByIdForUser(userId, sessionId)
}

module.exports = {
  create,
  getByIdForUser,
  list,
  listUpcoming,
  listPendingInvitations,
  listCompleted,
  listCancelled,
  respondToInvitation,
  requestReschedule,
  respondToReschedule,
  cancel,
  complete
}
