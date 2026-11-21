const express = require('express')
const validate = require('../middleware/validate')
const protect = require('../middleware/protect')
const requireAdmin = require('../middleware/requireAdmin')
const {
  listUsersSchema,
  suspendUserSchema,
  restoreUserSchema,
  listAdminReviewsSchema,
  moderateReviewSchema,
  listReportsSchema,
  decideReportSchema,
  listAuditLogsSchema,
  idParamSchema
} = require('../validators/admin.validator')
const {
  listUsers,
  getUser,
  suspendUser,
  restoreUser,
  listModeration,
  getReview,
  moderateReview,
  listReports,
  getReport,
  decideReport,
  statistics,
  listAuditLogs
} = require('../controllers/admin.controller')

const router = express.Router()

router.use(protect, requireAdmin)

router.get('/users', validate(listUsersSchema, 'query'), listUsers)
router.get('/users/:id', validate(idParamSchema, 'params'), getUser)
router.patch(
  '/users/:id/suspend',
  validate(idParamSchema, 'params'),
  validate(suspendUserSchema),
  suspendUser
)
router.patch(
  '/users/:id/restore',
  validate(idParamSchema, 'params'),
  validate(restoreUserSchema),
  restoreUser
)

router.get('/reviews', validate(listAdminReviewsSchema, 'query'), listModeration)
router.get('/reviews/:id', validate(idParamSchema, 'params'), getReview)
router.patch(
  '/reviews/:id/moderate',
  validate(idParamSchema, 'params'),
  validate(moderateReviewSchema),
  moderateReview
)

router.get('/reports', validate(listReportsSchema, 'query'), listReports)
router.get('/reports/:id', validate(idParamSchema, 'params'), getReport)
router.patch(
  '/reports/:id',
  validate(idParamSchema, 'params'),
  validate(decideReportSchema),
  decideReport
)

router.get('/statistics', statistics)
router.get('/audit-logs', validate(listAuditLogsSchema, 'query'), listAuditLogs)

module.exports = router
