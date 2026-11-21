const { z } = require('zod')
const { idParamSchema, emptyBodySchema } = require('./common.validator')
const { NOTIFICATION_TYPES } = require('../utils/constants')

const readFilterSchema = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true')

const listNotificationsSchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    isRead: readFilterSchema.optional(),
    type: z.enum(NOTIFICATION_TYPES).optional()
  })
  .strict()

const updatePreferencesSchema = z
  .object({
    exchangeRequests: z.boolean().optional(),
    sessions: z.boolean().optional(),
    messages: z.boolean().optional()
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one notification preference is required'
  })

module.exports = {
  listNotificationsSchema,
  updatePreferencesSchema,
  idParamSchema,
  emptyBodySchema
}
