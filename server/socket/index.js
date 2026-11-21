const { Server } = require('socket.io')
const { createAdapter } = require('@socket.io/redis-adapter')
const config = require('../config/env')
const { redisService } = require('../services/redis.service')
const authenticateSocket = require('./auth')
const presence = require('./presence')
const typing = require('./typing')
const messagingService = require('../services/messaging.service')
const messageRateLimit = require('../services/messageRateLimit.service')
const events = require('../services/messagingEvents')
const {
  joinConversationSchema,
  sendMessageSchema,
  readMessageSchema,
  typingSchema
} = require('../validators/message.validator')

const parse = (schema, payload) => {
  const result = schema.safeParse(payload || {})
  return result.success ? result.data : null
}

const respond = (callback, body) => {
  if (typeof callback === 'function') callback(body)
}

const initSocket = (server) => {
  const io = new Server(server, {
    cors: { origin: config.clientOrigin, credentials: true }
  })

  const pubsub = redisService.getPubSub()
  if (pubsub) {
    io.adapter(createAdapter(pubsub.pub, pubsub.sub))
  }

  events.setIO(io)
  io.use(authenticateSocket)

  io.on('connection', async (socket) => {
    const user = socket.data.user
    for (const conversationId of socket.data.conversationIds || []) {
      socket.join(events.conversationRoom(conversationId))
    }

    const joinRoom = async (payload, callback, leave = false) => {
      const data = parse(joinConversationSchema, payload)
      if (!data) return respond(callback, { ok: false, error: 'Invalid payload' })

      try {
        await messagingService.assertConversationMembership(user.id, data.conversationId)
        if (leave) {
          socket.leave(events.conversationRoom(data.conversationId))
          socket.leave(events.viewingRoom(data.conversationId))
        } else {
          socket.join(events.conversationRoom(data.conversationId))
          socket.join(events.viewingRoom(data.conversationId))
        }
        respond(callback, { ok: true, conversationId: data.conversationId })
      } catch {
        respond(callback, { ok: false, error: 'Conversation not found' })
      }
    }

    socket.on('conversation:join', (payload, callback) => joinRoom(payload, callback))
    socket.on('conversation:leave', (payload, callback) => joinRoom(payload, callback, true))

    socket.on('message:send', async (payload, callback) => {
      const data = parse(sendMessageSchema, payload)
      if (!data) return respond(callback, { ok: false, error: 'Invalid payload' })

      try {
        await messagingService.assertConversationMembership(user.id, data.conversationId)
      } catch {
        return respond(callback, { ok: false, error: 'Conversation not found' })
      }

      const limit = await messageRateLimit.consume(user.id)
      if (!limit.allowed) {
        return respond(callback, { ok: false, error: 'Rate limit exceeded', code: 429 })
      }

      try {
        const result = await messagingService.createMessage(user.id, data.conversationId, data)
        respond(callback, { ok: true, message: result.message, created: result.created })
      } catch {
        respond(callback, { ok: false, error: 'Message could not be sent' })
      }
    })

    socket.on('message:read', async (payload, callback) => {
      const data = parse(readMessageSchema, payload)
      if (!data) return respond(callback, { ok: false, error: 'Invalid payload' })

      try {
        const result = await messagingService.markRead(user.id, data.conversationId, data.messageId)
        respond(callback, { ok: true, ...result })
      } catch (error) {
        respond(callback, { ok: false, error: error.message || 'Could not mark messages as read' })
      }
    })

    socket.on('typing:start', async (payload, callback) => {
      const data = parse(typingSchema, payload)
      if (!data) return respond(callback, { ok: false, error: 'Invalid payload' })

      try {
        await messagingService.assertConversationMembership(user.id, data.conversationId)
      } catch {
        return respond(callback, { ok: false, error: 'Conversation not found' })
      }

      await typing.start(data.conversationId, user.id, user, socket.id)
      events.emitToConversation(
        data.conversationId,
        'typing:start',
        { conversationId: data.conversationId, user },
        socket.id
      )
      respond(callback, { ok: true })
    })

    socket.on('typing:stop', async (payload, callback) => {
      const data = parse(typingSchema, payload)
      if (!data) return respond(callback, { ok: false, error: 'Invalid payload' })

      try {
        await messagingService.assertConversationMembership(user.id, data.conversationId)
      } catch {
        return respond(callback, { ok: false, error: 'Conversation not found' })
      }

      await typing.stop(data.conversationId, user.id, socket.id)
      respond(callback, { ok: true })
    })

    socket.on('disconnect', () => {
      Promise.all([
        typing.clearUser(user.id, socket.id),
        presence.remove(socket)
      ]).catch(() => {})
    })

    const initialize = async () => {
      try {
        await presence.add(socket)
      } catch {}
    }
    initialize()
  })

  return io
}

const closeSocket = async (io) => {
  if (!io) return
  events.setIO(null)
  await new Promise((resolve) => io.close(resolve))
}

module.exports = { initSocket, closeSocket }
