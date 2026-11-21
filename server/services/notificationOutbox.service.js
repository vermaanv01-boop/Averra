const { randomUUID } = require('crypto')
const NotificationOutbox = require('../models/NotificationOutbox')
const config = require('../config/env')
const logger = require('../utils/logger')
const { deliver } = require('./notificationDelivery')
const {
  sessionOf,
  withSession,
  createWithSession,
  withDbTransaction,
  afterCommit
} = require('./transaction.service')

const idString = (value) => {
  if (!value) return null
  return value._id ? value._id.toString() : value.toString()
}

const backoffMs = (attempts) => Math.min(60000, 1000 * 2 ** Math.max(0, attempts - 1))

const enqueue = async (payload, session = sessionOf()) => {
  const recipient = idString(payload.recipientId)
  if (!recipient) return null
  if (payload.actorId && recipient === idString(payload.actorId)) return null

  const eventId = payload.eventId || randomUUID()
  const document = {
    eventId,
    recipientId: recipient,
    actorId: payload.actorId ? idString(payload.actorId) : null,
    type: payload.type,
    title: payload.title,
    message: payload.message,
    relatedEntityId: payload.relatedEntityId ? idString(payload.relatedEntityId) : null,
    relatedEntityType: payload.relatedEntityId ? payload.relatedEntityType : null,
    status: 'pending',
    attempts: 0,
    nextAttemptAt: new Date(),
    claimedAt: null
  }

  try {
    await createWithSession(NotificationOutbox, document, session)
  } catch (error) {
    if (error.code !== 11000) throw error
  }

  return eventId
}

const claim = async (eventId) => {
  const now = new Date()
  const staleBefore = new Date(now.getTime() - config.outbox.claimTimeoutMs)
  return NotificationOutbox.findOneAndUpdate(
    {
      eventId,
      $or: [
        { status: 'pending', nextAttemptAt: { $lte: now } },
        { status: 'processing', claimedAt: { $lte: staleBefore } }
      ]
    },
    {
      $set: { status: 'processing', claimedAt: now },
      $inc: { attempts: 1 }
    },
    { new: true }
  )
}

const dispatchEvent = async (eventId) => {
  const entry = await claim(eventId)
  if (!entry) return null

  try {
    const dto = await deliver({
      recipientId: entry.recipientId,
      actorId: entry.actorId,
      type: entry.type,
      title: entry.title,
      message: entry.message,
      relatedEntityId: entry.relatedEntityId,
      relatedEntityType: entry.relatedEntityType,
      eventId: entry.eventId
    })

    entry.status = 'delivered'
    entry.deliveredAt = new Date()
    entry.claimedAt = null
    entry.lastError = dto ? null : 'Skipped by recipient preferences'
    await entry.save()
    return dto
  } catch (error) {
    const dead = entry.attempts >= config.outbox.maxAttempts
    entry.status = dead ? 'dead' : 'pending'
    entry.lastError = String(error.message || error).slice(0, 500)
    entry.claimedAt = null
    entry.nextAttemptAt = new Date(Date.now() + (dead ? 0 : backoffMs(entry.attempts)))
    await entry.save()

    logger.error('Notification outbox delivery failed', {
      eventId,
      attempts: entry.attempts,
      dead,
      error: entry.lastError
    })
    return null
  }
}

const enqueueAndDispatch = async (payload) => {
  const currentSession = sessionOf()

  if (currentSession) {
    const eventId = await enqueue(payload, currentSession)
    if (eventId) afterCommit(() => dispatchEvent(eventId))
    return null
  }

  const eventId = await withDbTransaction((session) => enqueue(payload, session))
  return eventId ? dispatchEvent(eventId) : null
}

const dueQuery = () => {
  const now = new Date()
  const staleBefore = new Date(now.getTime() - config.outbox.claimTimeoutMs)
  return {
    $or: [
      { status: 'pending', nextAttemptAt: { $lte: now } },
      { status: 'processing', claimedAt: { $lte: staleBefore } }
    ]
  }
}

const processDueBatch = async (limit = 20) => {
  const candidates = await NotificationOutbox.find(dueQuery())
    .select('eventId')
    .limit(limit)
    .lean()

  const results = []
  for (const candidate of candidates) {
    results.push(await dispatchEvent(candidate.eventId))
  }
  return results.filter(Boolean)
}

const recover = async () => {
  const result = await withSession(
    NotificationOutbox.updateMany(
      { status: 'processing', claimedAt: { $lte: new Date(Date.now() - config.outbox.claimTimeoutMs) } },
      { $set: { status: 'pending', claimedAt: null } }
    )
  )
  logger.info('Notification outbox recovery completed', { recovered: result.modifiedCount })
  return processDueBatch()
}

const statusFor = (eventId) => withSession(NotificationOutbox.findOne({ eventId }).lean())

const reset = () => NotificationOutbox.deleteMany({})

module.exports = {
  enqueue,
  dispatchEvent,
  enqueueAndDispatch,
  processDueBatch,
  recover,
  statusFor,
  reset
}
