const assert = require('node:assert/strict')
const http = require('node:http')
const { before, after, beforeEach, afterEach, describe, it } = require('node:test')
const request = require('supertest')
const mongoose = require('mongoose')
const { MongoMemoryServer } = require('mongodb-memory-server')
const { io: ioClient } = require('socket.io-client')

process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test-only-secret'
process.env.RATE_LIMIT_MAX = '10000'
process.env.AUTH_RATE_LIMIT_MAX = '1000'
process.env.BCRYPT_SALT_ROUNDS = '4'
process.env.MESSAGE_RATE_LIMIT_MAX = '1000'
process.env.MESSAGE_RATE_LIMIT_WINDOW_MS = '60000'

const { NOTIFICATION_TYPES } = require('../utils/constants')

let mongoServer
let app
let io
let httpServer
let baseUrl
let User
let Skill
let ExchangeRequest
let Conversation
let Message
let Session
let Notification
let notificationService
let messageRateLimit
let closeSocket
let sockets = []

const auth = (token) => ({ Authorization: `Bearer ${token}` })
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const registerUser = async (suffix) => {
  const response = await request(app).post('/api/auth/register').send({
    name: `Notify User ${suffix}`,
    username: `notify${suffix}`,
    email: `notify${suffix}@example.test`,
    password: 'Password1'
  })
  assert.equal(response.status, 201, JSON.stringify(response.body))
  return response.body.data
}

const createSkill = async (token, name) => {
  const response = await request(app)
    .post('/api/skills')
    .set(auth(token))
    .send({ name, category: 'technology', type: 'teach', proficiency: 'advanced' })
  assert.equal(response.status, 201, JSON.stringify(response.body))
  return response.body.data.skill
}

const createPair = async (suffix, accept = false) => {
  const sender = await registerUser(`${suffix}a`)
  const recipient = await registerUser(`${suffix}b`)
  const [offered, requested] = await Promise.all([
    createSkill(sender.token, `Offer ${suffix}`),
    createSkill(recipient.token, `Request ${suffix}`)
  ])

  const created = await request(app)
    .post('/api/exchange-requests')
    .set(auth(sender.token))
    .send({
      recipientId: recipient.user.id,
      offeredSkillId: offered.id,
      requestedSkillId: requested.id
    })
  assert.equal(created.status, 201, JSON.stringify(created.body))
  const requestId = created.body.data.request.id

  if (accept) {
    const accepted = await request(app)
      .patch(`/api/exchange-requests/${requestId}/accept`)
      .set(auth(recipient.token))
      .send({})
    assert.equal(accepted.status, 200, JSON.stringify(accepted.body))
  }

  return { sender, recipient, requestId }
}

const sessionPayload = (requestId, overrides = {}) => ({
  exchangeRequestId: requestId,
  title: 'Skill exchange session',
  description: 'Practice together',
  scheduledDate: '2028-06-15',
  startTime: '10:00',
  duration: 60,
  timezone: 'America/New_York',
  meetingMethod: 'online',
  meetingLink: 'https://meet.example.test/room',
  ...overrides
})

const postSession = async (token, requestId, overrides = {}) => {
  const response = await request(app)
    .post('/api/sessions')
    .set(auth(token))
    .send(sessionPayload(requestId, overrides))
  assert.equal(response.status, 201, JSON.stringify(response.body))
  return response.body.data.session
}

const patch = (token, path, body = {}) =>
  request(app).patch(path).set(auth(token)).send(body)

const getNotifications = (token, query = '') =>
  request(app).get(`/api/notifications${query}`).set(auth(token))

const notificationFor = async (token, type) => {
  const response = await getNotifications(token, `?type=${type}`)
  assert.equal(response.status, 200, JSON.stringify(response.body))
  return response.body.data.notifications
}

const insertNotification = (recipientId, actorId, overrides = {}) =>
  Notification.create({
    recipient: recipientId,
    actor: actorId,
    type: 'exchange_request',
    title: 'Test notification',
    message: 'Test message',
    ...overrides
  })

const createSocket = (token) => {
  const socket = ioClient(baseUrl, {
    transports: ['websocket'],
    forceNew: true,
    reconnection: false,
    auth: token ? { token } : {}
  })
  sockets.push(socket)
  return socket
}

const waitConnected = (socket) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('connect timeout')), 3000)
    socket.once('connect', () => {
      clearTimeout(timer)
      resolve(socket)
    })
    socket.once('connect_error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
  })

const waitForRoom = async (room, socketId) => {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (io.sockets.adapter.rooms.get(room)?.has(socketId)) return
    await delay(20)
  }
  throw new Error(`timeout waiting for room ${room}`)
}

const connectSocket = async (token, userId) => {
  const socket = createSocket(token)
  await waitConnected(socket)
  if (userId) await waitForRoom(`user:${userId}`, socket.id)
  await delay(30)
  return socket
}

const onceEvent = (socket, event, timeoutMs = 2500) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler)
      reject(new Error(`timeout waiting for ${event}`))
    }, timeoutMs)
    const handler = (payload) => {
      clearTimeout(timer)
      socket.off(event, handler)
      resolve(payload)
    }
    socket.on(event, handler)
  })

const emitAck = (socket, event, payload) =>
  new Promise((resolve, reject) => {
    socket.timeout(2500).emit(event, payload, (error, response) => {
      if (error) reject(error)
      else resolve(response)
    })
  })

before(async () => {
  mongoServer = await MongoMemoryServer.create()
  process.env.MONGODB_URI = mongoServer.getUri()

  app = require('../app')
  User = require('../models/User')
  Skill = require('../models/Skill')
  ExchangeRequest = require('../models/ExchangeRequest')
  Conversation = require('../models/Conversation')
  Message = require('../models/Message')
  Session = require('../models/Session')
  Notification = require('../models/Notification')
  notificationService = require('../services/notification.service')
  messageRateLimit = require('../services/messageRateLimit.service')

  const socketModule = require('../socket')
  closeSocket = socketModule.closeSocket

  await mongoose.connect(mongoServer.getUri())
  await Promise.all([
    User.init(),
    Skill.init(),
    ExchangeRequest.init(),
    Conversation.init(),
    Message.init(),
    Session.init(),
    Notification.init()
  ])

  httpServer = http.createServer(app)
  io = socketModule.initSocket(httpServer)
  await new Promise((resolve) => httpServer.listen(0, '127.0.0.1', resolve))
  baseUrl = `http://127.0.0.1:${httpServer.address().port}`
})

after(async () => {
  await closeSocket(io)
  if (httpServer.listening) {
    await new Promise((resolve) => httpServer.close(resolve))
  }
  await mongoose.disconnect()
  await mongoServer.stop()
})

beforeEach(async () => {
  messageRateLimit.reset()
  await Promise.all([
    User.deleteMany({}),
    Skill.deleteMany({}),
    ExchangeRequest.deleteMany({}),
    Conversation.deleteMany({}),
    Message.deleteMany({}),
    Session.deleteMany({}),
    Notification.deleteMany({})
  ])
})

afterEach(async () => {
  for (const socket of sockets) socket.close()
  sockets = []
})

describe('Notification creation', () => {
  it('creates a notification with actor, entity and DTO fields', async () => {
    const actor = await registerUser('createa')
    const recipient = await registerUser('createb')
    const entityId = new mongoose.Types.ObjectId()

    const dto = await notificationService.notify({
      recipientId: recipient.user.id,
      actorId: actor.user.id,
      type: 'exchange_request',
      title: 'New exchange request',
      message: 'You received a request.',
      relatedEntityId: entityId.toString(),
      relatedEntityType: 'ExchangeRequest',
      eventId: 'created'
    })

    assert.equal(dto.type, 'exchange_request')
    assert.equal(dto.title, 'New exchange request')
    assert.equal(dto.recipient, recipient.user.id)
    assert.equal(dto.actor.id, actor.user.id)
    assert.equal(dto.actor.username, 'notifycreatea')
    assert.equal(dto.relatedEntity, entityId.toString())
    assert.equal(dto.relatedEntityType, 'ExchangeRequest')
    assert.equal(dto.isRead, false)
    assert.equal(dto.readAt, null)
    assert.ok(dto.createdAt)
    assert.equal(dto.dedupeKey, undefined)

    const stored = await Notification.findById(dto.id)
    assert.equal(stored.recipient.toString(), recipient.user.id)
    assert.equal(stored.dedupeKey, `exchange_request:${recipient.user.id}:created`)
  })

  it('supports every notification type', async () => {
    const actor = await registerUser('typea')
    const recipient = await registerUser('typeb')

    for (const [index, type] of NOTIFICATION_TYPES.entries()) {
      const created = await notificationService.notify({
        recipientId: recipient.user.id,
        actorId: actor.user.id,
        type,
        title: `Title ${type}`,
        message: `Message ${type}`,
        eventId: `event-${index}`
      })
      assert.equal(created.type, type, JSON.stringify(created))
    }

    const stored = await Notification.find({ recipient: recipient.user.id }).select('type')
    assert.deepEqual(
      stored.map((notification) => notification.type).sort(),
      [...NOTIFICATION_TYPES].sort()
    )
  })

  it('persists notifications for offline recipients', async () => {
    const sender = await registerUser('offlinea')
    const recipient = await registerUser('offlineb')

    const created = await notificationService.notify({
      recipientId: recipient.user.id,
      actorId: sender.user.id,
      type: 'new_message',
      title: 'New message',
      message: 'You received a new message.',
      eventId: 'offline'
    })

    assert.ok(created)
    assert.equal(await Notification.countDocuments({ recipient: recipient.user.id }), 1)

    const socket = await connectSocket(recipient.token, recipient.user.id)
    const response = await getNotifications(recipient.token)
    assert.equal(response.body.data.notifications.length, 1)
    assert.equal(response.body.data.notifications[0].id, created.id)
    assert.ok(socket.connected)
  })

  it('prevents duplicate notifications for repeated events', async () => {
    const actor = await registerUser('dupa')
    const recipient = await registerUser('dupb')
    const payload = {
      recipientId: recipient.user.id,
      actorId: actor.user.id,
      type: 'session_confirmed',
      title: 'Session confirmed',
      message: 'Your session was confirmed.',
      relatedEntityId: new mongoose.Types.ObjectId().toString(),
      relatedEntityType: 'Session',
      eventId: 'session-1:accepted'
    }

    const first = await notificationService.notify(payload)
    const second = await notificationService.notify(payload)
    assert.ok(first)
    assert.equal(second, null)
    assert.equal(await Notification.countDocuments({}), 1)

    const concurrent = await Promise.all([
      notificationService.notify({ ...payload, eventId: 'concurrent' }),
      notificationService.notify({ ...payload, eventId: 'concurrent' })
    ])
    assert.equal(concurrent.filter(Boolean).length, 1)
    assert.equal(await Notification.countDocuments({}), 2)
  })

  it('suppresses self-notifications', async () => {
    const user = await registerUser('self')
    const created = await notificationService.notify({
      recipientId: user.user.id,
      actorId: user.user.id,
      type: 'exchange_request',
      title: 'Self',
      message: 'Should not be stored',
      eventId: 'self'
    })

    assert.equal(created, null)
    assert.equal(await Notification.countDocuments({}), 0)
  })
})

describe('Notification REST API', () => {
  it('requires authentication on every endpoint', async () => {
    const endpoints = [
      ['get', '/api/notifications'],
      ['get', '/api/notifications/unread-count'],
      ['get', '/api/notifications/preferences'],
      ['patch', '/api/notifications/read-all'],
      ['patch', '/api/notifications/preferences'],
      ['delete', '/api/notifications/000000000000000000000000']
    ]

    for (const [method, path] of endpoints) {
      const response = await request(app)[method](path)
      assert.equal(response.status, 401, `${method} ${path}: ${JSON.stringify(response.body)}`)
    }
  })

  it('lists only the authenticated user notifications with pagination', async () => {
    const owner = await registerUser('listowner')
    const other = await registerUser('listother')

    for (let index = 0; index < 5; index += 1) {
      await insertNotification(owner.user.id, other.user.id, { dedupeKey: `owner-${index}` })
    }
    await insertNotification(other.user.id, owner.user.id, { dedupeKey: 'other' })

    const firstPage = await getNotifications(owner.token, '?page=1&limit=2')
    assert.equal(firstPage.status, 200, JSON.stringify(firstPage.body))
    assert.equal(firstPage.body.data.notifications.length, 2)
    assert.equal(firstPage.body.data.pagination.total, 5)
    assert.equal(firstPage.body.data.pagination.totalPages, 3)
    assert.equal(firstPage.body.data.pagination.hasNext, true)
    assert.equal(firstPage.body.data.unreadCount, 5)

    const lastPage = await getNotifications(owner.token, '?page=3&limit=2')
    assert.equal(lastPage.body.data.notifications.length, 1)
    assert.equal(lastPage.body.data.pagination.hasNext, false)

    const otherList = await getNotifications(other.token)
    assert.equal(otherList.body.data.notifications.length, 1)
  })

  it('filters by read status and type and validates query input', async () => {
    const owner = await registerUser('filterowner')
    const actor = await registerUser('filteractor')

    await insertNotification(owner.user.id, actor.user.id, {
      type: 'exchange_request',
      dedupeKey: 'one'
    })
    await insertNotification(owner.user.id, actor.user.id, {
      type: 'new_message',
      isRead: true,
      readAt: new Date(),
      dedupeKey: 'two'
    })
    await insertNotification(owner.user.id, actor.user.id, {
      type: 'new_message',
      dedupeKey: 'three'
    })

    const unread = await getNotifications(owner.token, '?isRead=false')
    assert.equal(unread.body.data.notifications.length, 2)

    const read = await getNotifications(owner.token, '?isRead=true')
    assert.equal(read.body.data.notifications.length, 1)
    assert.equal(read.body.data.notifications[0].type, 'new_message')

    const messages = await getNotifications(owner.token, '?type=new_message&isRead=false')
    assert.equal(messages.body.data.notifications.length, 1)

    const invalidType = await getNotifications(owner.token, '?type=unknown')
    assert.equal(invalidType.status, 400)

    const invalidRead = await getNotifications(owner.token, '?isRead=yes')
    assert.equal(invalidRead.status, 400)

    const invalidLimit = await getNotifications(owner.token, '?limit=1000')
    assert.equal(invalidLimit.status, 400)
  })

  it('returns unread counts', async () => {
    const owner = await registerUser('countowner')
    const actor = await registerUser('countactor')

    await insertNotification(owner.user.id, actor.user.id, { dedupeKey: 'a' })
    await insertNotification(owner.user.id, actor.user.id, {
      isRead: true,
      readAt: new Date(),
      dedupeKey: 'b'
    })

    const response = await getNotifications(owner.token, '/unread-count')
    assert.equal(response.status, 200, JSON.stringify(response.body))
    assert.deepEqual(response.body.data, { unreadCount: 1 })
  })

  it('prevents reading, modifying or deleting another user notification', async () => {
    const owner = await registerUser('authowner')
    const intruder = await registerUser('authintruder')
    const actor = await registerUser('authactor')
    const notification = await insertNotification(owner.user.id, actor.user.id, {
      dedupeKey: 'private'
    })
    const id = notification.id

    const read = await patch(intruder.token, `/api/notifications/${id}/read`)
    assert.equal(read.status, 404, JSON.stringify(read.body))

    const remove = await request(app)
      .delete(`/api/notifications/${id}`)
      .set(auth(intruder.token))
    assert.equal(remove.status, 404, JSON.stringify(remove.body))

    const list = await getNotifications(intruder.token)
    assert.equal(list.body.data.notifications.length, 0)
    assert.equal(list.body.data.unreadCount, 0)

    const stillThere = await Notification.findById(id)
    assert.ok(stillThere)
    assert.equal(stillThere.isRead, false)

    const invalidId = await patch(owner.token, '/api/notifications/not-an-id/read')
    assert.equal(invalidId.status, 400)
  })

  it('marks an individual notification as read idempotently', async () => {
    const owner = await registerUser('readowner')
    const actor = await registerUser('readactor')
    const notification = await insertNotification(owner.user.id, actor.user.id, {
      dedupeKey: 'read-one'
    })

    const response = await patch(owner.token, `/api/notifications/${notification.id}/read`)
    assert.equal(response.status, 200, JSON.stringify(response.body))
    assert.equal(response.body.data.notification.isRead, true)
    assert.ok(response.body.data.notification.readAt)
    assert.equal(response.body.data.unreadCount, 0)

    const stored = await Notification.findById(notification.id)
    assert.equal(stored.isRead, true)
    assert.ok(stored.readAt)

    const repeated = await patch(owner.token, `/api/notifications/${notification.id}/read`)
    assert.equal(repeated.status, 200)
    assert.equal(repeated.body.data.notification.readAt, stored.readAt.toISOString())

    const invalidBody = await patch(owner.token, `/api/notifications/${notification.id}/read`, {
      unexpected: true
    })
    assert.equal(invalidBody.status, 400)
  })

  it('marks all notifications as read', async () => {
    const owner = await registerUser('allowner')
    const actor = await registerUser('allactor')

    await insertNotification(owner.user.id, actor.user.id, { dedupeKey: 'all-1' })
    await insertNotification(owner.user.id, actor.user.id, { dedupeKey: 'all-2' })
    await insertNotification(owner.user.id, actor.user.id, {
      isRead: true,
      readAt: new Date(),
      dedupeKey: 'all-3'
    })

    const response = await patch(owner.token, '/api/notifications/read-all', {})
    assert.equal(response.status, 200, JSON.stringify(response.body))
    assert.equal(response.body.data.modifiedCount, 2)
    assert.equal(response.body.data.unreadCount, 0)
    assert.equal(await Notification.countDocuments({ recipient: owner.user.id, isRead: false }), 0)

    const repeated = await patch(owner.token, '/api/notifications/read-all', {})
    assert.equal(repeated.body.data.modifiedCount, 0)

    const invalidBody = await patch(owner.token, '/api/notifications/read-all', { isRead: true })
    assert.equal(invalidBody.status, 400)
  })

  it('deletes a notification and reports the remaining unread count', async () => {
    const owner = await registerUser('deleteowner')
    const actor = await registerUser('deleteactor')
    const unread = await insertNotification(owner.user.id, actor.user.id, { dedupeKey: 'del-1' })
    await insertNotification(owner.user.id, actor.user.id, { dedupeKey: 'del-2' })

    const response = await request(app)
      .delete(`/api/notifications/${unread.id}`)
      .set(auth(owner.token))
    assert.equal(response.status, 200, JSON.stringify(response.body))
    assert.equal(response.body.data.unreadCount, 1)
    assert.equal(response.body.data.notification.deleted, true)
    assert.equal(await Notification.findById(unread.id), null)

    const repeated = await request(app)
      .delete(`/api/notifications/${unread.id}`)
      .set(auth(owner.token))
    assert.equal(repeated.status, 404)
  })
})

describe('Notification preferences', () => {
  it('returns defaults and validates preference updates', async () => {
    const user = await registerUser('prefs')

    const initial = await getNotifications(user.token, '/preferences')
    assert.equal(initial.status, 200, JSON.stringify(initial.body))
    assert.deepEqual(initial.body.data.preferences, {
      exchangeRequests: true,
      sessions: true,
      messages: true
    })

    const updated = await patch(user.token, '/api/notifications/preferences', {
      messages: false,
      sessions: false
    })
    assert.equal(updated.status, 200, JSON.stringify(updated.body))
    assert.deepEqual(updated.body.data.preferences, {
      exchangeRequests: true,
      sessions: false,
      messages: false
    })

    const after = await getNotifications(user.token, '/preferences')
    assert.deepEqual(after.body.data.preferences, updated.body.data.preferences)

    const invalid = await patch(user.token, '/api/notifications/preferences', {
      messages: 'no'
    })
    assert.equal(invalid.status, 400)

    const empty = await patch(user.token, '/api/notifications/preferences', {})
    assert.equal(empty.status, 400)

    const unknown = await patch(user.token, '/api/notifications/preferences', { email: false })
    assert.equal(unknown.status, 400)
  })

  it('suppresses a disabled category without blocking the business operation', async () => {
    const pair = await createPair('suppress', true)
    await Notification.deleteMany({})
    const conversationResponse = await request(app)
      .get('/api/conversations')
      .set(auth(pair.sender.token))
    assert.equal(conversationResponse.status, 200)
    const conversationId = conversationResponse.body.data.conversations[0].id

    const disabled = await patch(pair.recipient.token, '/api/notifications/preferences', {
      messages: false,
      exchangeRequests: false
    })
    assert.equal(disabled.status, 200, JSON.stringify(disabled.body))

    const message = await request(app)
      .post(`/api/conversations/${conversationId}/messages`)
      .set(auth(pair.sender.token))
      .send({ content: 'Still delivered', clientMessageId: 'suppress-1' })
    assert.equal(message.status, 201, JSON.stringify(message.body))
    assert.equal(await Notification.countDocuments({ recipient: pair.recipient.user.id }), 0)

    const requestPair = await createPair('suppress2', false)
    await Notification.deleteMany({})
    await patch(requestPair.recipient.token, '/api/notifications/preferences', {
      exchangeRequests: false
    })
    const requestResponse = await request(app)
      .post('/api/exchange-requests')
      .set(auth(requestPair.sender.token))
      .send({
        recipientId: requestPair.recipient.user.id,
        offeredSkillId: (await createSkill(requestPair.sender.token, 'Extra offer')).id,
        requestedSkillId: (await createSkill(requestPair.recipient.token, 'Extra request')).id
      })
    assert.equal(requestResponse.status, 201, JSON.stringify(requestResponse.body))
    assert.equal(
      await Notification.countDocuments({ recipient: requestPair.recipient.user.id }),
      0
    )

    await patch(pair.recipient.token, '/api/notifications/preferences', { messages: true })
    const secondMessage = await request(app)
      .post(`/api/conversations/${conversationId}/messages`)
      .set(auth(pair.sender.token))
      .send({ content: 'Now notified', clientMessageId: 'suppress-2' })
    assert.equal(secondMessage.status, 201, JSON.stringify(secondMessage.body))

    const messages = await notificationFor(pair.recipient.token, 'new_message')
    assert.equal(messages.length, 1)
  })
})

describe('Business event integration', () => {
  it('creates exchange request notifications for new, accepted, rejected and cancelled requests', async () => {
    const pending = await createPair('exnew')
    assert.equal((await notificationFor(pending.recipient.token, 'exchange_request')).length, 1)
    assert.equal((await notificationFor(pending.sender.token, 'exchange_request')).length, 0)

    const accepted = await createPair('exaccept')
    const accept = await patch(
      accepted.recipient.token,
      `/api/exchange-requests/${accepted.requestId}/accept`
    )
    assert.equal(accept.status, 200, JSON.stringify(accept.body))
    assert.equal((await notificationFor(accepted.sender.token, 'exchange_accepted')).length, 1)
    assert.equal((await notificationFor(accepted.recipient.token, 'exchange_accepted')).length, 0)

    const rejected = await createPair('exreject')
    const reject = await patch(
      rejected.recipient.token,
      `/api/exchange-requests/${rejected.requestId}/reject`
    )
    assert.equal(reject.status, 200, JSON.stringify(reject.body))
    assert.equal((await notificationFor(rejected.sender.token, 'exchange_rejected')).length, 1)

    const cancelled = await createPair('excancel')
    const cancel = await patch(
      cancelled.sender.token,
      `/api/exchange-requests/${cancelled.requestId}/cancel`
    )
    assert.equal(cancel.status, 200, JSON.stringify(cancel.body))
    assert.equal((await notificationFor(cancelled.recipient.token, 'exchange_cancelled')).length, 1)
  })

  it('creates session notifications for every session event', async () => {
    const pair = await createPair('sessionone', true)
    const session = await postSession(pair.sender.token, pair.requestId)
    assert.equal((await notificationFor(pair.recipient.token, 'session_invitation')).length, 1)
    assert.equal((await notificationFor(pair.sender.token, 'session_invitation')).length, 0)

    const accept = await patch(
      pair.recipient.token,
      `/api/sessions/${session.id}/accept`
    )
    assert.equal(accept.status, 200, JSON.stringify(accept.body))
    assert.equal((await notificationFor(pair.sender.token, 'session_confirmed')).length, 1)

    const reschedule = await request(app)
      .post(`/api/sessions/${session.id}/reschedule-requests`)
      .set(auth(pair.sender.token))
      .send({
        scheduledDate: '2028-06-16',
        startTime: '11:00',
        duration: 45,
        timezone: 'America/New_York'
      })
    assert.equal(reschedule.status, 200, JSON.stringify(reschedule.body))
    const proposalId = reschedule.body.data.session.reschedulingHistory.at(-1).id
    assert.equal((await notificationFor(pair.recipient.token, 'session_rescheduled')).length, 1)

    const acceptReschedule = await patch(
      pair.recipient.token,
      `/api/sessions/${session.id}/reschedule-requests/${proposalId}/accept`
    )
    assert.equal(acceptReschedule.status, 200, JSON.stringify(acceptReschedule.body))
    assert.equal((await notificationFor(pair.sender.token, 'session_rescheduled')).length, 1)

    const complete = await patch(pair.sender.token, `/api/sessions/${session.id}/complete`)
    assert.equal(complete.status, 200, JSON.stringify(complete.body))
    assert.equal((await notificationFor(pair.recipient.token, 'session_completed')).length, 1)

    const second = await createPair('sessiontwo', true)
    const declinedSession = await postSession(second.sender.token, second.requestId)
    const decline = await patch(
      second.recipient.token,
      `/api/sessions/${declinedSession.id}/decline`
    )
    assert.equal(decline.status, 200, JSON.stringify(decline.body))
    assert.equal((await notificationFor(second.sender.token, 'session_declined')).length, 1)

    const activeSession = await postSession(second.sender.token, second.requestId, {
      scheduledDate: '2028-07-15'
    })
    const acceptAgain = await patch(
      second.recipient.token,
      `/api/sessions/${activeSession.id}/accept`
    )
    assert.equal(acceptAgain.status, 200, JSON.stringify(acceptAgain.body))

    const rejectProposal = await request(app)
      .post(`/api/sessions/${activeSession.id}/reschedule-requests`)
      .set(auth(second.recipient.token))
      .send({
        scheduledDate: '2028-07-16',
        startTime: '12:00',
        duration: 45,
        timezone: 'America/New_York'
      })
    assert.equal(rejectProposal.status, 200, JSON.stringify(rejectProposal.body))
    const rejectProposalId = rejectProposal.body.data.session.reschedulingHistory.at(-1).id
    assert.equal((await notificationFor(second.sender.token, 'session_rescheduled')).length, 1)

    const reject = await patch(
      second.sender.token,
      `/api/sessions/${activeSession.id}/reschedule-requests/${rejectProposalId}/reject`
    )
    assert.equal(reject.status, 200, JSON.stringify(reject.body))
    assert.equal((await notificationFor(second.recipient.token, 'session_rescheduled')).length, 1)

    const cancel = await patch(second.sender.token, `/api/sessions/${activeSession.id}/cancel`, {
      reason: 'No longer needed'
    })
    assert.equal(cancel.status, 200, JSON.stringify(cancel.body))
    assert.equal((await notificationFor(second.recipient.token, 'session_cancelled')).length, 1)
  })

  it('creates message notifications for the recipient but never the sender', async () => {
    const pair = await createPair('messageevent', true)
    const conversations = await request(app)
      .get('/api/conversations')
      .set(auth(pair.sender.token))
    assert.equal(conversations.status, 200)
    const conversationId = conversations.body.data.conversations[0].id

    const sent = await request(app)
      .post(`/api/conversations/${conversationId}/messages`)
      .set(auth(pair.sender.token))
      .send({ content: 'Hello there', clientMessageId: 'message-event-1' })
    assert.equal(sent.status, 201, JSON.stringify(sent.body))

    const notifications = await notificationFor(pair.recipient.token, 'new_message')
    assert.equal(notifications.length, 1)
    assert.equal(notifications[0].actor.id, pair.sender.user.id)
    assert.equal(notifications[0].relatedEntity, sent.body.data.message.id)
    assert.equal(notifications[0].relatedEntityType, 'Message')
    assert.equal((await notificationFor(pair.sender.token, 'new_message')).length, 0)

    const duplicate = await request(app)
      .post(`/api/conversations/${conversationId}/messages`)
      .set(auth(pair.sender.token))
      .send({ content: 'Hello there', clientMessageId: 'message-event-1' })
    assert.equal(duplicate.status, 201)
    assert.equal((await notificationFor(pair.recipient.token, 'new_message')).length, 1)
  })

  it('does not notify a recipient who is actively viewing the conversation or on typing/read events', async () => {
    const pair = await createPair('viewing', true)
    const conversations = await request(app)
      .get('/api/conversations')
      .set(auth(pair.sender.token))
    const conversationId = conversations.body.data.conversations[0].id

    const recipientSocket = await connectSocket(pair.recipient.token, pair.recipient.user.id)
    const senderSocket = await connectSocket(pair.sender.token, pair.sender.user.id)
    const joined = await emitAck(recipientSocket, 'conversation:join', { conversationId })
    assert.equal(joined.ok, true, JSON.stringify(joined))

    const firstMessage = await request(app)
      .post(`/api/conversations/${conversationId}/messages`)
      .set(auth(pair.sender.token))
      .send({ content: 'While viewing', clientMessageId: 'viewing-1' })
    assert.equal(firstMessage.status, 201, JSON.stringify(firstMessage.body))
    assert.equal((await notificationFor(pair.recipient.token, 'new_message')).length, 0)

    const left = await emitAck(recipientSocket, 'conversation:leave', { conversationId })
    assert.equal(left.ok, true, JSON.stringify(left))

    const secondMessage = await request(app)
      .post(`/api/conversations/${conversationId}/messages`)
      .set(auth(pair.sender.token))
      .send({ content: 'After leaving', clientMessageId: 'viewing-2' })
    assert.equal(secondMessage.status, 201, JSON.stringify(secondMessage.body))
    assert.equal((await notificationFor(pair.recipient.token, 'new_message')).length, 1)

    const countAfterMessage = await Notification.countDocuments({})
    const typing = await emitAck(senderSocket, 'typing:start', { conversationId })
    assert.equal(typing.ok, true, JSON.stringify(typing))
    const read = await emitAck(recipientSocket, 'message:read', {
      conversationId,
      messageId: secondMessage.body.data.message.id
    })
    assert.equal(read.ok, true, JSON.stringify(read))
    await delay(50)
    assert.equal(await Notification.countDocuments({}), countAfterMessage)
  })

  it('keeps exchange, session and messaging operations functional', async () => {
    const pair = await createPair('existing', true)
    const session = await postSession(pair.sender.token, pair.requestId)
    const accepted = await patch(pair.recipient.token, `/api/sessions/${session.id}/accept`)
    assert.equal(accepted.status, 200)
    assert.equal(accepted.body.data.session.status, 'confirmed')

    const conversations = await request(app)
      .get('/api/conversations')
      .set(auth(pair.sender.token))
    const conversationId = conversations.body.data.conversations[0].id
    const sent = await request(app)
      .post(`/api/conversations/${conversationId}/messages`)
      .set(auth(pair.sender.token))
      .send({ content: 'End to end', clientMessageId: 'existing-1' })
    assert.equal(sent.status, 201)
    assert.equal(sent.body.data.message.content, 'End to end')
  })
})

describe('Real-time notifications', () => {
  it('delivers notification:new only to the recipient and to every active connection', async () => {
    const actor = await registerUser('socketactor')
    const recipient = await registerUser('socketrecipient')
    const outsider = await registerUser('socketoutsider')

    const firstSocket = await connectSocket(recipient.token, recipient.user.id)
    const secondSocket = await connectSocket(recipient.token, recipient.user.id)
    const outsiderSocket = await connectSocket(outsider.token, outsider.user.id)

    let outsiderReceived = false
    outsiderSocket.on('notification:new', () => {
      outsiderReceived = true
    })

    const firstEvent = onceEvent(firstSocket, 'notification:new')
    const secondEvent = onceEvent(secondSocket, 'notification:new')
    const firstCount = onceEvent(firstSocket, 'notification:unread-count')

    const created = await notificationService.notify({
      recipientId: recipient.user.id,
      actorId: actor.user.id,
      type: 'session_invitation',
      title: 'New session invitation',
      message: 'You were invited to a session.',
      eventId: 'socket-1'
    })

    const firstPayload = await firstEvent
    const secondPayload = await secondEvent
    const countPayload = await firstCount
    assert.equal(firstPayload.id, created.id)
    assert.equal(secondPayload.id, created.id)
    assert.equal(firstPayload.type, 'session_invitation')
    assert.equal(countPayload.unreadCount, 1)
    await delay(100)
    assert.equal(outsiderReceived, false)
  })

  it('emits read, deleted and unread-count events for REST changes', async () => {
    const actor = await registerUser('eventsactor')
    const recipient = await registerUser('eventsrecipient')
    const socket = await connectSocket(recipient.token, recipient.user.id)

    const newEvent = onceEvent(socket, 'notification:new')
    const initialCount = onceEvent(socket, 'notification:unread-count')
    const created = await notificationService.notify({
      recipientId: recipient.user.id,
      actorId: actor.user.id,
      type: 'exchange_accepted',
      title: 'Exchange request accepted',
      message: 'Your request was accepted.',
      eventId: 'events-1'
    })
    assert.equal((await newEvent).id, created.id)
    assert.equal((await initialCount).unreadCount, 1)

    const readEvent = onceEvent(socket, 'notification:read')
    const readCount = onceEvent(socket, 'notification:unread-count')
    const readResponse = await patch(recipient.token, `/api/notifications/${created.id}/read`)
    assert.equal(readResponse.status, 200, JSON.stringify(readResponse.body))
    assert.equal((await readEvent).id, created.id)
    assert.equal((await readCount).unreadCount, 0)

    const deleteEvent = onceEvent(socket, 'notification:deleted')
    const removed = await request(app)
      .delete(`/api/notifications/${created.id}`)
      .set(auth(recipient.token))
    assert.equal(removed.status, 200, JSON.stringify(removed.body))
    assert.equal((await deleteEvent).id, created.id)
    assert.equal(await Notification.countDocuments({}), 0)
  })
})
