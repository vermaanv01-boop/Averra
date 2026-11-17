const { z } = require('zod')
const { REQUEST_STATUSES } = require('../utils/constants')

const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[a-f\d]{24}$/i, 'Enter a valid identifier')

const createRequestSchema = z
  .object({
    recipientId: objectIdSchema,
    offeredSkillId: objectIdSchema,
    requestedSkillId: objectIdSchema
  })
  .strict()

const listRequestsSchema = z
  .object({
    box: z.enum(['incoming', 'outgoing', 'all']).default('all'),
    status: z.enum(REQUEST_STATUSES).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
    sort: z.enum(['newest', 'oldest']).default('newest')
  })
  .strict()

const idParamSchema = z
  .object({
    id: objectIdSchema
  })
  .strict()

module.exports = { objectIdSchema, createRequestSchema, listRequestsSchema, idParamSchema }
