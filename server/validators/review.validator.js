const { z } = require('zod')
const { objectIdSchema, idParamSchema } = require('./common.validator')
const {
  RATING_VALUES,
  REVIEW_REPORT_REASONS
} = require('../utils/constants')

const ratingSchema = z
  .number()
  .int()
  .min(RATING_VALUES[0])
  .max(RATING_VALUES[RATING_VALUES.length - 1])

const createReviewSchema = z
  .object({
    exchangeRequestId: objectIdSchema,
    overallRating: ratingSchema,
    teachingRating: ratingSchema,
    learningRating: ratingSchema,
    comment: z.string().trim().min(1).max(2000)
  })
  .strict()

const updateReviewSchema = z
  .object({
    overallRating: ratingSchema.optional(),
    teachingRating: ratingSchema.optional(),
    learningRating: ratingSchema.optional(),
    comment: z.string().trim().min(1).max(2000).optional()
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one review field is required'
  })

const reportReviewSchema = z
  .object({
    reason: z.enum(REVIEW_REPORT_REASONS),
    details: z.string().trim().max(500).default('')
  })
  .strict()

const listReviewsSchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    sort: z.enum(['newest', 'oldest', 'highest', 'lowest']).default('newest')
  })
  .strict()

const userIdParamSchema = z
  .object({ userId: objectIdSchema })
  .strict()

const exchangeRequestIdParamSchema = z
  .object({ exchangeRequestId: objectIdSchema })
  .strict()

module.exports = {
  createReviewSchema,
  updateReviewSchema,
  reportReviewSchema,
  listReviewsSchema,
  userIdParamSchema,
  exchangeRequestIdParamSchema,
  idParamSchema
}
