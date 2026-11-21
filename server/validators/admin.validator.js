const { z } = require('zod')
const { idParamSchema, objectIdSchema } = require('./common.validator')
const {
  USER_ROLES,
  ACCOUNT_STATUSES,
  REVIEW_MODERATION_STATUSES,
  REVIEW_REPORT_REASONS,
  REPORT_STATUSES,
  REPORT_ACTIONS,
  AUDIT_ACTIONS,
  AUDIT_TARGET_TYPES
} = require('../utils/constants')

const pagination = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20)
}

const listUsersSchema = z
  .object({
    ...pagination,
    search: z.string().trim().min(1).max(100).optional(),
    role: z.enum(USER_ROLES).optional(),
    status: z.enum(ACCOUNT_STATUSES).optional(),
    sort: z.enum(['newest', 'oldest', 'username']).default('newest')
  })
  .strict()

const suspendUserSchema = z
  .object({
    reason: z.string().trim().min(3).max(500)
  })
  .strict()

const restoreUserSchema = z
  .object({
    reason: z.string().trim().max(500).default('')
  })
  .strict()

const listAdminReviewsSchema = z
  .object({
    ...pagination,
    status: z.enum(REVIEW_MODERATION_STATUSES).optional()
  })
  .strict()

const moderateReviewSchema = z
  .object({
    status: z.enum(['hidden', 'visible']),
    reason: z.string().trim().max(500).default('')
  })
  .strict()

const listReportsSchema = z
  .object({
    ...pagination,
    status: z.enum(REPORT_STATUSES).optional(),
    reason: z.enum(REVIEW_REPORT_REASONS).optional()
  })
  .strict()

const decideReportSchema = z
  .object({
    action: z.enum(REPORT_ACTIONS),
    reason: z.string().trim().min(3).max(500)
  })
  .strict()

const listAuditLogsSchema = z
  .object({
    ...pagination,
    action: z.enum(AUDIT_ACTIONS).optional(),
    targetType: z.enum(AUDIT_TARGET_TYPES).optional()
  })
  .strict()

const reportIdParamSchema = z
  .object({ id: objectIdSchema })
  .strict()

module.exports = {
  listUsersSchema,
  suspendUserSchema,
  restoreUserSchema,
  listAdminReviewsSchema,
  moderateReviewSchema,
  listReportsSchema,
  decideReportSchema,
  listAuditLogsSchema,
  reportIdParamSchema,
  idParamSchema
}
