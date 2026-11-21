const assert = require('node:assert/strict')
const { after, before, beforeEach, describe, it } = require('node:test')
const request = require('supertest')
const mongoose = require('mongoose')
const { MongoMemoryServer } = require('mongodb-memory-server')

process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test-only-secret'
process.env.RATE_LIMIT_MAX = '10000'
process.env.AUTH_RATE_LIMIT_MAX = '1000'
process.env.BCRYPT_SALT_ROUNDS = '4'
process.env.LOG_LEVEL = 'silent'

let mongoServer
let app
let config
let authService
let notificationOutbox
let messagingService
let User
let RevokedToken
let Notification
let NotificationOutbox
let Conversation
let Message
let userCounter = 0

const createUser = async () => {
  userCounter += 1
  return User.create({
    name: `Reliability User ${userCounter}`,
    username: `reliability${userCounter}`,
    email: `reliability${userCounter}@example.test`,
    passwordHash: 'test-only-hash'
  })
}

const outboxPayload = (recipient, eventId, overrides = {}) => ({
  recipientId: recipient.id,
  actorId: null,
  type: 'new_message',
  title: 'Reliability event',
  message: 'Reliability event body',
  relatedEntityId: null,
  relatedEntityType: null,
  eventId,
  ...overrides
})

before(async () => {
  mongoServer = await MongoMemoryServer.create()
  process.env.MONGODB_URI = mongoServer.getUri()

  app = require('../app')
  config = require('../config/env')
  authService = require('../services/auth.service')
  notificationOutbox = require('../services/notificationOutbox.service')
  messagingService = require('../services/messaging.service')
  User = require('../models/User')
  RevokedToken = require('../models/RevokedToken')
  Notification = require('../models/Notification')
  NotificationOutbox = require('../models/NotificationOutbox')
  Conversation = require('../models/Conversation')
  Message = require('../models/Message')

  await mongoose.connect(mongoServer.getUri())
  await Promise.all([
    User.init(),
    RevokedToken.init(),
    Notification.init(),
    NotificationOutbox.init(),
    Conversation.init(),
    Message.init()
  ])
})

after(async () => {
  await mongoose.disconnect()
  await mongoServer.stop()
})

beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}),
    RevokedToken.deleteMany({}),
    Notification.deleteMany({}),
    NotificationOutbox.deleteMany({}),
    Conversation.deleteMany({}),
    Message.deleteMany({})
  ])
})

describe('Persistent authentication state', () => {
  it('stores revoked tokens in MongoDB and cleans up expired entries', async () => {
    const user = await createUser()
    const exp = Math.floor(Date.now() / 1000) + 3600

    await authService.logout({ sub: user.id, jti: 'revoked-jti', exp })
    assert.equal(await authService.isTokenRevoked('revoked-jti'), true)
    assert.equal(await authService.isTokenRevoked('unknown-jti'), false)

    await authService.logout({ sub: user.id, jti: 'revoked-jti', exp })
    assert.equal(await RevokedToken.countDocuments({ jti: 'revoked-jti' }), 1)

    await RevokedToken.create({
      jti: 'expired-jti',
      userId: user._id,
      expiresAt: new Date(Date.now() - 1000),
      revokedAt: new Date()
    })
    assert.equal(await authService.isTokenRevoked('expired-jti'), false)

    const result = await authService.cleanupExpiredTokens()
    assert.ok(result.deletedCount >= 1)
    assert.equal(await RevokedToken.countDocuments({ jti: 'expired-jti' }), 0)
  })
})

describe('Notification outbox', () => {
  it('retries failed deliveries and records a successful retry', async () => {
    const recipient = await createUser()
    const eventId = await notificationOutbox.enqueue(outboxPayload(recipient, 'retry-event', {
      relatedEntityId: new mongoose.Types.ObjectId(),
      relatedEntityType: null
    }))

    assert.ok(eventId)
    await notificationOutbox.dispatchEvent(eventId)

    let entry = await notificationOutbox.statusFor(eventId)
    assert.equal(entry.status, 'pending')
    assert.equal(entry.attempts, 1)
    assert.match(entry.lastError, /relatedEntity and relatedEntityType/)

    await NotificationOutbox.updateOne(
      { eventId },
      { $set: { relatedEntityId: null, nextAttemptAt: new Date(0) } }
    )
    const dto = await notificationOutbox.dispatchEvent(eventId)

    assert.ok(dto)
    entry = await notificationOutbox.statusFor(eventId)
    assert.equal(entry.status, 'delivered')
    assert.equal(await Notification.countDocuments({ recipient: recipient._id }), 1)
  })

  it('moves exhausted deliveries to the dead-letter state', async () => {
    const recipient = await createUser()
    const originalMaxAttempts = config.outbox.maxAttempts
    config.outbox.maxAttempts = 1

    try {
      const eventId = await notificationOutbox.enqueue(outboxPayload(recipient, 'dead-event', {
        relatedEntityId: new mongoose.Types.ObjectId()
      }))
      await notificationOutbox.dispatchEvent(eventId)

      const entry = await notificationOutbox.statusFor(eventId)
      assert.equal(entry.status, 'dead')
      assert.equal(entry.attempts, 1)
      assert.ok(entry.lastError)
    } finally {
      config.outbox.maxAttempts = originalMaxAttempts
    }
  })

  it('recovers stale claimed events on startup', async () => {
    const recipient = await createUser()
    const eventId = await notificationOutbox.enqueue(outboxPayload(recipient, 'recovery-event'))
    const staleClaimedAt = new Date(Date.now() - config.outbox.claimTimeoutMs - 1000)

    await NotificationOutbox.updateOne(
      { eventId },
      { $set: { status: 'processing', claimedAt: staleClaimedAt } }
    )
    await notificationOutbox.recover()

    const entry = await notificationOutbox.statusFor(eventId)
    assert.equal(entry.status, 'delivered')
    assert.equal(await Notification.countDocuments({ recipient: recipient._id }), 1)
  })

  it('deduplicates repeated events across the outbox and stored notifications', async () => {
    const recipient = await createUser()
    const payload = outboxPayload(recipient, 'dedupe-event')

    assert.equal(await notificationOutbox.enqueue(payload), 'dedupe-event')
    assert.equal(await notificationOutbox.enqueue(payload), 'dedupe-event')
    assert.equal(await NotificationOutbox.countDocuments({ eventId: 'dedupe-event' }), 1)

    await notificationOutbox.dispatchEvent('dedupe-event')
    await NotificationOutbox.updateOne(
      { eventId: 'dedupe-event' },
      { $set: { status: 'pending', nextAttemptAt: new Date(0) } }
    )
    await notificationOutbox.dispatchEvent('dedupe-event')

    assert.equal(await Notification.countDocuments({ recipient: recipient._id }), 1)
  })
})

describe('Concurrent business operations', () => {
  it('creates one message for concurrent sends with the same client id', async () => {
    const [sender, recipient] = await Promise.all([createUser(), createUser()])
    const conversation = await Conversation.create({
      participants: [sender._id, recipient._id],
      exchangeRequest: new mongoose.Types.ObjectId()
    })

    const results = await Promise.all(
      Array.from({ length: 5 }, () => messagingService.createMessage(
        sender.id,
        conversation.id,
        { content: 'Concurrent message', clientMessageId: 'concurrent-1', messageType: 'text' }
      ))
    )

    assert.equal(results.filter((result) => result.created).length, 1)
    assert.equal(new Set(results.map((result) => result.message.id)).size, 1)
    assert.equal(await Message.countDocuments({ conversation: conversation._id }), 1)
  })
})

describe('Readiness', () => {
  it('reports ready when MongoDB is connected', async () => {
    const response = await request(app).get('/health/ready')

    assert.equal(response.status, 200)
    assert.equal(response.body.success, true)
    assert.equal(response.body.data.status, 'ready')
    assert.equal(response.body.data.checks.database, 'connected')
  })
})
