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
process.env.MESSAGE_RATE_LIMIT_MAX = '5'
process.env.MESSAGE_RATE_LIMIT_WINDOW_MS = '60000'

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
let messagingService
let messageRateLimit
let closeMessagingSocket
let sockets = []

const auth = (token) => ({ Authorization: `Bearer ${token}` })
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const registerUser = async (suffix) => {
  const response = await request(app).post('/api/auth/register').send({
    name: `Messaging User ${suffix}`,
    username: `msg${suffix}`,
    email: `msg${suffix}@example.test`,
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

const createPair = async (suffix, accept = true) => {
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

const conversationFor = async (token) => {
  const response = await request(app).get('/api/conversations').set(auth(token))
  assert.equal(response.status, 200, JSON.stringify(response.body))
  assert.equal(response.body.data.conversations.length, 1)
  return response.body.data.conversations[0]
}

const postMessage = (token, conversationId, content, clientMessageId) =>
  request(app)
    .post(`/api/conversations/${conversationId}/messages`)
    .set(auth(token))
    .send({ content, clientMessageId })

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

const waitConnectError = (socket) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('connect_error timeout')), 3000)
    socket.once('connect_error', (error) => {
      clearTimeout(timer)
      resolve(error)
    })
    socket.once('connect', () => {
      clearTimeout(timer)
      reject(new Error('unexpected connection'))
    })
  })

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
    socket
      .timeout(2500)
      .emit(event, payload, (error, response) => {
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
  messagingService = require('../services/messaging.service')
  messageRateLimit = require('../services/messageRateLimit.service')
  const { initSocket, closeSocket } = require('../socket')
  closeMessagingSocket = closeSocket

  await mongoose.connect(mongoServer.getUri())
  await Promise.all([
    User.init(),
    Skill.init(),
    ExchangeRequest.init(),
    Conversation.init(),
    Message.init()
  ])

  httpServer = http.createServer(app)
  io = initSocket(httpServer)
  await new Promise((resolve) => httpServer.listen(0, '127.0.0.1', resolve))
  baseUrl = `http://127.0.0.1:${httpServer.address().port}`
})

after(async () => {
  await closeMessagingSocket(io)
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
    Message.deleteMany({})
  ])
})

afterEach(async () => {
  for (const socket of sockets) socket.close()
  sockets = []
})

describe('Conversations', () => {
  it('creates one conversation per accepted request and restricts access', async () => {
    const { sender, recipient, requestId } = await createPair('one', false)

    const beforeAccept = await request(app).get('/api/conversations').set(auth(sender.token))
    assert.equal(beforeAccept.status, 200)
    assert.equal(beforeAccept.body.data.conversations.length, 0)

    await assert.rejects(() => messagingService.ensureConversationForRequest(requestId))

    const accepted = await request(app)
      .patch(`/api/exchange-requests/${requestId}/accept`)
      .set(auth(recipient.token))
      .send({})
    assert.equal(accepted.status, 200)

    await messagingService.ensureConversationForRequest(requestId)
    assert.equal(await Conversation.countDocuments({ exchangeRequest: requestId }), 1)

    const conversation = await conversationFor(sender.token)
    assert.equal(conversation.participants.length, 2)
    assert.equal(conversation.exchangeRequest.id, requestId)
    assert.equal(conversation.lastMessage, null)

    const outsider = await registerUser('oneoutsider')
    const outsiderList = await request(app).get('/api/conversations').set(auth(outsider.token))
    assert.equal(outsiderList.body.data.conversations.length, 0)

    const outsiderGet = await request(app)
      .get(`/api/conversations/${conversation.id}`)
      .set(auth(outsider.token))
    assert.equal(outsiderGet.status, 404)

    const unauthenticated = await request(app).get('/api/conversations')
    assert.equal(unauthenticated.status, 401)
  })

  it('persists messages and prevents duplicates, empty content and unauthorized access', async () => {
    const { sender, recipient } = await createPair('two')
    const conversation = await conversationFor(sender.token)

    const created = await postMessage(sender.token, conversation.id, 'Hello there', 'key-1')
    assert.equal(created.status, 201, JSON.stringify(created.body))
    assert.equal(created.body.data.created, true)
    assert.equal(created.body.data.message.content, 'Hello there')
    assert.equal(created.body.data.message.sender.id, sender.user.id)
    assert.deepEqual(created.body.data.message.deliveredTo, [recipient.user.id])
    assert.ok(await Message.exists({ clientMessageId: 'key-1' }))

    const duplicate = await postMessage(sender.token, conversation.id, 'Hello there', 'key-1')
    assert.equal(duplicate.status, 201)
    assert.equal(duplicate.body.data.created, false)
    assert.equal(duplicate.body.data.message.id, created.body.data.message.id)
    assert.equal(await Message.countDocuments({ conversation: conversation.id }), 1)

    const empty = await postMessage(sender.token, conversation.id, '   ', 'key-2')
    assert.equal(empty.status, 400)

    const updatedConversation = await request(app)
      .get(`/api/conversations/${conversation.id}`)
      .set(auth(sender.token))
    assert.equal(updatedConversation.body.data.conversation.lastMessage.id, created.body.data.message.id)

    const outsider = await registerUser('twooutsider')
    const outsiderMessages = await request(app)
      .get(`/api/conversations/${conversation.id}/messages`)
      .set(auth(outsider.token))
    assert.equal(outsiderMessages.status, 404)

    const outsiderPost = await postMessage(outsider.token, conversation.id, 'Intruder', 'key-3')
    assert.equal(outsiderPost.status, 404)
  })

  it('allows only the sender to edit or soft-delete messages', async () => {
    const { sender, recipient } = await createPair('three')
    const conversation = await conversationFor(sender.token)
    const created = await postMessage(sender.token, conversation.id, 'Original', 'key-1')
    const messageId = created.body.data.message.id

    const outsider = await registerUser('threeoutsider')
    const outsiderEdit = await request(app)
      .patch(`/api/messages/${messageId}`)
      .set(auth(outsider.token))
      .send({ content: 'Nope' })
    assert.equal(outsiderEdit.status, 404)

    const recipientEdit = await request(app)
      .patch(`/api/messages/${messageId}`)
      .set(auth(recipient.token))
      .send({ content: 'Nope' })
    assert.equal(recipientEdit.status, 403)

    const emptyEdit = await request(app)
      .patch(`/api/messages/${messageId}`)
      .set(auth(sender.token))
      .send({ content: ' ' })
    assert.equal(emptyEdit.status, 400)

    const edited = await request(app)
      .patch(`/api/messages/${messageId}`)
      .set(auth(sender.token))
      .send({ content: 'Edited content' })
    assert.equal(edited.status, 200)
    assert.equal(edited.body.data.message.content, 'Edited content')
    assert.ok(edited.body.data.message.editedAt)

    const recipientDelete = await request(app)
      .delete(`/api/messages/${messageId}`)
      .set(auth(recipient.token))
    assert.equal(recipientDelete.status, 403)

    const deleted = await request(app)
      .delete(`/api/messages/${messageId}`)
      .set(auth(sender.token))
    assert.equal(deleted.status, 200)
    assert.ok(deleted.body.data.message.deletedAt)
    assert.ok((await Message.findById(messageId)).deletedAt)

    const history = await request(app)
      .get(`/api/conversations/${conversation.id}/messages`)
      .set(auth(recipient.token))
    assert.equal(history.body.data.messages.length, 0)

    const afterDelete = await request(app)
      .get(`/api/conversations/${conversation.id}`)
      .set(auth(recipient.token))
    assert.equal(afterDelete.body.data.conversation.lastMessage, null)
  })

  it('paginates chronologically and tracks unread counts and read receipts', async () => {
    const { sender, recipient } = await createPair('four')
    const conversation = await conversationFor(sender.token)

    for (let index = 1; index <= 5; index += 1) {
      await Message.create({
        conversation: conversation.id,
        sender: sender.user.id,
        content: `Message ${index}`,
        clientMessageId: `seed-${index}`
      })
    }

    const firstPage = await request(app)
      .get(`/api/conversations/${conversation.id}/messages?page=1&limit=2`)
      .set(auth(recipient.token))
    assert.equal(firstPage.status, 200)
    assert.equal(firstPage.body.data.messages.length, 2)
    assert.equal(firstPage.body.data.messages[0].content, 'Message 1')
    assert.equal(firstPage.body.data.messages[1].content, 'Message 2')
    assert.equal(firstPage.body.data.pagination.total, 5)
    assert.equal(firstPage.body.data.pagination.hasNext, true)

    const lastPage = await request(app)
      .get(`/api/conversations/${conversation.id}/messages?page=3&limit=2`)
      .set(auth(recipient.token))
    assert.equal(lastPage.body.data.messages.length, 1)
    assert.equal(lastPage.body.data.messages[0].content, 'Message 5')

    const unread = await request(app).get('/api/conversations/unread-count').set(auth(recipient.token))
    assert.equal(unread.body.data.total, 5)
    assert.equal(unread.body.data.conversations[0].unreadCount, 5)

    const senderUnread = await request(app).get('/api/conversations/unread-count').set(auth(sender.token))
    assert.equal(senderUnread.body.data.total, 0)

    const read = await request(app)
      .patch(`/api/conversations/${conversation.id}/read`)
      .set(auth(recipient.token))
      .send({})
    assert.equal(read.status, 200)
    assert.equal(read.body.data.messageIds.length, 5)

    const messages = await Message.find({ conversation: conversation.id })
    assert.ok(messages.every((message) => message.readBy.some((id) => id.toString() === recipient.user.id)))

    const afterRead = await request(app).get('/api/conversations/unread-count').set(auth(recipient.token))
    assert.equal(afterRead.body.data.total, 0)
  })

  it('rate limits message sending', async () => {
    const { sender } = await createPair('five')
    const conversation = await conversationFor(sender.token)

    for (let index = 1; index <= 5; index += 1) {
      const response = await postMessage(sender.token, conversation.id, `Rate ${index}`, `rate-${index}`)
      assert.equal(response.status, 201)
    }

    const limited = await postMessage(sender.token, conversation.id, 'Too many', 'rate-6')
    assert.equal(limited.status, 429)
    assert.equal(limited.body.success, false)
  })
})

describe('Socket.IO', () => {
  it('authenticates socket connections using the JWT handshake', async () => {
    const noToken = createSocket(null)
    const noTokenError = await waitConnectError(noToken)
    assert.equal(noTokenError.message, 'Unauthorized')

    const badToken = createSocket('invalid.token.value')
    const badTokenError = await waitConnectError(badToken)
    assert.equal(badTokenError.message, 'Unauthorized')

    const { sender } = await createPair('six')
    const valid = createSocket(sender.token)
    await waitConnected(valid)
    assert.equal(valid.connected, true)

    const logout = await request(app).post('/api/auth/logout').set(auth(sender.token)).send({})
    assert.equal(logout.status, 200)
    const revoked = createSocket(sender.token)
    const revokedError = await waitConnectError(revoked)
    assert.equal(revokedError.message, 'Unauthorized')
  })

  it('verifies conversation membership before joining rooms', async () => {
    const { sender } = await createPair('seven')
    const conversation = await conversationFor(sender.token)
    const outsider = await registerUser('sevenoutsider')

    const outsiderSocket = createSocket(outsider.token)
    await waitConnected(outsiderSocket)
    const rejected = await emitAck(outsiderSocket, 'conversation:join', {
      conversationId: conversation.id
    })
    assert.equal(rejected.ok, false)
    assert.equal(rejected.error, 'Conversation not found')

    const room = io.sockets.adapter.rooms.get(`conversation:${conversation.id}`)
    assert.equal(room?.has(outsiderSocket.id) || false, false)

    const memberSocket = createSocket(sender.token)
    await waitConnected(memberSocket)
    const joined = await emitAck(memberSocket, 'conversation:join', {
      conversationId: conversation.id
    })
    assert.equal(joined.ok, true)
    assert.equal(io.sockets.adapter.rooms.get(`conversation:${conversation.id}`).has(memberSocket.id), true)

    const left = await emitAck(memberSocket, 'conversation:leave', {
      conversationId: conversation.id
    })
    assert.equal(left.ok, true)
    assert.equal(io.sockets.adapter.rooms.get(`conversation:${conversation.id}`)?.has(memberSocket.id) || false, false)
  })

  it('delivers persisted messages in real time and deduplicates by key', async () => {
    const { sender, recipient } = await createPair('eight')
    const conversation = await conversationFor(sender.token)

    const senderSocket = createSocket(sender.token)
    const recipientSocket = createSocket(recipient.token)
    await Promise.all([waitConnected(senderSocket), waitConnected(recipientSocket)])

    const delivered = onceEvent(recipientSocket, 'message:new')
    const result = await emitAck(senderSocket, 'message:send', {
      conversationId: conversation.id,
      content: 'Socket message',
      clientMessageId: 'socket-key-1',
      messageType: 'text'
    })
    assert.equal(result.ok, true)
    assert.equal(result.created, true)

    const payload = await delivered
    assert.equal(payload.content, 'Socket message')
    assert.equal(payload.sender.id, sender.user.id)
    assert.equal(payload.clientMessageId, 'socket-key-1')
    assert.equal(await Message.countDocuments({ conversation: conversation.id }), 1)

    let duplicateEvents = 0
    recipientSocket.on('message:new', () => {
      duplicateEvents += 1
    })
    const duplicate = await emitAck(senderSocket, 'message:send', {
      conversationId: conversation.id,
      content: 'Socket message',
      clientMessageId: 'socket-key-1',
      messageType: 'text'
    })
    assert.equal(duplicate.ok, true)
    assert.equal(duplicate.created, false)
    await delay(150)
    assert.equal(duplicateEvents, 0)
    assert.equal(await Message.countDocuments({ conversation: conversation.id }), 1)

    const spoofed = await emitAck(senderSocket, 'message:send', {
      conversationId: conversation.id,
      content: 'Spoofed sender',
      clientMessageId: 'socket-key-2',
      sender: recipient.user.id
    })
    assert.equal(spoofed.ok, false)
    assert.equal(await Message.countDocuments({ conversation: conversation.id }), 1)
  })

  it('broadcasts edit, delete and read events', async () => {
    const { sender, recipient } = await createPair('eight-events')
    const conversation = await conversationFor(sender.token)

    const senderSocket = createSocket(sender.token)
    const recipientSocket = createSocket(recipient.token)
    await Promise.all([waitConnected(senderSocket), waitConnected(recipientSocket)])

    const created = await emitAck(senderSocket, 'message:send', {
      conversationId: conversation.id,
      content: 'Edit me',
      clientMessageId: 'events-key-1'
    })
    assert.equal(created.ok, true)
    const messageId = created.message.id

    const updated = onceEvent(recipientSocket, 'message:updated')
    const edited = await request(app)
      .patch(`/api/messages/${messageId}`)
      .set(auth(sender.token))
      .send({ content: 'Edited via REST' })
    assert.equal(edited.status, 200)
    assert.equal((await updated).content, 'Edited via REST')

    const read = onceEvent(senderSocket, 'message:read')
    const readAck = await emitAck(recipientSocket, 'message:read', {
      conversationId: conversation.id,
      messageId
    })
    assert.equal(readAck.ok, true)
    assert.deepEqual(readAck.messageIds, [messageId])
    assert.equal((await read).messageId, messageId)

    const deleted = onceEvent(recipientSocket, 'message:deleted')
    const removed = await request(app)
      .delete(`/api/messages/${messageId}`)
      .set(auth(sender.token))
    assert.equal(removed.status, 200)
    assert.equal((await deleted).id, messageId)
  })

  it('applies the message rate limit to socket sends', async () => {
    const { sender } = await createPair('eight-rate')
    const conversation = await conversationFor(sender.token)

    const senderSocket = createSocket(sender.token)
    await waitConnected(senderSocket)

    for (let index = 1; index <= 5; index += 1) {
      const result = await emitAck(senderSocket, 'message:send', {
        conversationId: conversation.id,
        content: `Socket rate ${index}`,
        clientMessageId: `socket-rate-${index}`
      })
      assert.equal(result.ok, true)
    }

    const limited = await emitAck(senderSocket, 'message:send', {
      conversationId: conversation.id,
      content: 'Socket rate 6',
      clientMessageId: 'socket-rate-6'
    })
    assert.equal(limited.ok, false)
    assert.equal(limited.code, 429)
  })

  it('broadcasts typing indicators with automatic expiry', async () => {
    const { sender, recipient } = await createPair('nine')
    const conversation = await conversationFor(sender.token)

    const senderSocket = createSocket(sender.token)
    const recipientSocket = createSocket(recipient.token)
    await Promise.all([waitConnected(senderSocket), waitConnected(recipientSocket)])

    const typingStart = onceEvent(recipientSocket, 'typing:start')
    const typingStop = onceEvent(recipientSocket, 'typing:stop')

    const started = await emitAck(senderSocket, 'typing:start', {
      conversationId: conversation.id
    })
    assert.equal(started.ok, true)
    assert.equal((await typingStart).user.id, sender.user.id)

    const stopped = await emitAck(senderSocket, 'typing:stop', {
      conversationId: conversation.id
    })
    assert.equal(stopped.ok, true)
    await typingStop

    const expiredStart = onceEvent(recipientSocket, 'typing:start')
    const expiredStop = onceEvent(recipientSocket, 'typing:stop', 4500)
    await emitAck(senderSocket, 'typing:start', { conversationId: conversation.id })
    await expiredStart
    await expiredStop

    const invalid = await emitAck(senderSocket, 'typing:start', { conversationId: 'bad-id' })
    assert.equal(invalid.ok, false)
  })

  it('tracks presence across multiple connections and only marks offline on final disconnect', async () => {
    const { sender, recipient } = await createPair('ten')
    await conversationFor(sender.token)

    const recipientSocket = createSocket(recipient.token)
    await waitConnected(recipientSocket)
    const outsider = await registerUser('tenoutsider')
    const outsiderSocket = createSocket(outsider.token)
    await waitConnected(outsiderSocket)
    let outsiderOnlineEvents = 0
    outsiderSocket.on('presence:online', () => {
      outsiderOnlineEvents += 1
    })

    let onlineEvents = 0
    recipientSocket.on('presence:online', (payload) => {
      if (payload.userId === sender.user.id) onlineEvents += 1
    })
    let offlineEvents = 0
    recipientSocket.on('presence:offline', (payload) => {
      if (payload.userId === sender.user.id) offlineEvents += 1
    })

    const senderFirst = createSocket(sender.token)
    await waitConnected(senderFirst)
    await delay(150)
    assert.equal(onlineEvents, 1)
    assert.equal(outsiderOnlineEvents, 0)

    const reconnect = createSocket(sender.token)
    const reconnectOnline = onceEvent(reconnect, 'presence:online')
    await waitConnected(reconnect)
    assert.equal((await reconnectOnline).userId, recipient.user.id)

    const senderSecond = createSocket(sender.token)
    await waitConnected(senderSecond)
    await delay(150)
    assert.equal(onlineEvents, 1)

    senderFirst.close()
    await delay(200)
    assert.equal(offlineEvents, 0)

    senderSecond.close()
    await delay(200)
    assert.equal(offlineEvents, 0)

    const offline = onceEvent(recipientSocket, 'presence:offline')
    reconnect.close()
    const finalOffline = await offline
    assert.equal(finalOffline.userId, sender.user.id)
    assert.equal(offlineEvents, 1)
  })
})
