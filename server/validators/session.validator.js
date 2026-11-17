const { z } = require('zod')
const { objectIdSchema } = require('./common.validator')
const {
  SESSION_STATUSES,
  MEETING_METHODS
} = require('../utils/constants')
const { isValidCalendarDate, isValidTimeZone } = require('../utils/dateTime')

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD format')
  .refine(isValidCalendarDate, 'Enter a real calendar date')

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:mm in 24-hour format')

const timezoneSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .refine(isValidTimeZone, 'Enter a valid IANA timezone')

const durationSchema = z
  .number()
  .int()
  .min(15, 'Duration must be at least 15 minutes')
  .max(480, 'Duration must be at most 480 minutes')

const createSessionSchema = z
  .object({
    exchangeRequestId: objectIdSchema,
    title: z.string().trim().min(2).max(120),
    description: z.string().trim().max(1000).optional().default(''),
    scheduledDate: dateSchema,
    startTime: timeSchema,
    duration: durationSchema,
    timezone: timezoneSchema,
    meetingMethod: z.enum(MEETING_METHODS),
    meetingLink: z
      .union([z.literal(''), z.string().trim().url('meetingLink must be a valid URL')])
      .optional()
      .default(''),
    location: z.string().trim().max(200).optional().default('')
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.meetingMethod === 'online' && !data.meetingLink) {
      ctx.addIssue({
        code: 'custom',
        path: ['meetingLink'],
        message: 'meetingLink is required for online sessions'
      })
    }

    if (data.meetingMethod === 'in-person' && !data.location) {
      ctx.addIssue({
        code: 'custom',
        path: ['location'],
        message: 'location is required for in-person sessions'
      })
    }
  })

const rescheduleSessionSchema = z
  .object({
    scheduledDate: dateSchema,
    startTime: timeSchema,
    duration: durationSchema,
    timezone: timezoneSchema
  })
  .strict()

const cancelSessionSchema = z
  .object({
    reason: z.string().trim().max(300).optional().default('')
  })
  .strict()

const listSessionsSchema = z
  .object({
    status: z.enum(SESSION_STATUSES).optional(),
    from: dateSchema.optional(),
    to: dateSchema.optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
    sort: z.enum(['upcoming', 'latest', 'oldest']).default('upcoming')
  })
  .strict()

const idParamSchema = z
  .object({
    id: objectIdSchema
  })
  .strict()

const rescheduleParamSchema = z
  .object({
    id: objectIdSchema,
    proposalId: objectIdSchema
  })
  .strict()

module.exports = {
  createSessionSchema,
  rescheduleSessionSchema,
  cancelSessionSchema,
  listSessionsSchema,
  idParamSchema,
  rescheduleParamSchema
}
