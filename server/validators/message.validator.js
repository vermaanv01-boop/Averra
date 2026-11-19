const { z } = require('zod')
const { objectIdSchema } = require('./common.validator')
const { MESSAGE_TYPES } = require('../utils/constants')

const contentSchema = z.string().trim().min(1, 'Message cannot be empty').max(4000)
const clientMessageIdSchema = z.string().trim().min(1).max(100)

const createMessageSchema = z
  .object({
    content: contentSchema,
    clientMessageId: clientMessageIdSchema,
    messageType: z.enum(MESSAGE_TYPES).default('text')
  })
  .strict()

const sendMessageSchema = createMessageSchema.extend({ conversationId: objectIdSchema })

const updateMessageSchema = z.object({ content: contentSchema }).strict()

const listMessagesSchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20)
  })
  .strict()

const joinConversationSchema = z.object({ conversationId: objectIdSchema }).strict()

const readMessageSchema = z
  .object({
    conversationId: objectIdSchema,
    messageId: objectIdSchema.optional()
  })
  .strict()

const typingSchema = joinConversationSchema

module.exports = {
  createMessageSchema,
  sendMessageSchema,
  updateMessageSchema,
  listMessagesSchema,
  joinConversationSchema,
  readMessageSchema,
  typingSchema
}
