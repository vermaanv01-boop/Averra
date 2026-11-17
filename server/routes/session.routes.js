const express = require('express')
const validate = require('../middleware/validate')
const protect = require('../middleware/protect')
const { emptyBodySchema } = require('../validators/common.validator')
const {
  createSessionSchema,
  rescheduleSessionSchema,
  cancelSessionSchema,
  listSessionsSchema,
  idParamSchema,
  rescheduleParamSchema
} = require('../validators/session.validator')
const {
  create,
  getOne,
  listAll,
  upcoming,
  pendingInvitations,
  completed,
  cancelled,
  accept,
  decline,
  requestReschedule,
  acceptReschedule,
  rejectReschedule,
  cancel,
  complete
} = require('../controllers/session.controller')

const router = express.Router()

router.use(protect)

router.get('/upcoming', validate(listSessionsSchema, 'query'), upcoming)
router.get('/pending-invitations', validate(listSessionsSchema, 'query'), pendingInvitations)
router.get('/completed', validate(listSessionsSchema, 'query'), completed)
router.get('/cancelled', validate(listSessionsSchema, 'query'), cancelled)
router.get('/', validate(listSessionsSchema, 'query'), listAll)
router.post('/', validate(createSessionSchema), create)
router.get('/:id', validate(idParamSchema, 'params'), getOne)
router.patch('/:id/accept', validate(idParamSchema, 'params'), validate(emptyBodySchema), accept)
router.patch('/:id/decline', validate(idParamSchema, 'params'), validate(emptyBodySchema), decline)
router.post(
  '/:id/reschedule-requests',
  validate(idParamSchema, 'params'),
  validate(rescheduleSessionSchema),
  requestReschedule
)
router.patch(
  '/:id/reschedule-requests/:proposalId/accept',
  validate(rescheduleParamSchema, 'params'),
  validate(emptyBodySchema),
  acceptReschedule
)
router.patch(
  '/:id/reschedule-requests/:proposalId/reject',
  validate(rescheduleParamSchema, 'params'),
  validate(emptyBodySchema),
  rejectReschedule
)
router.patch('/:id/cancel', validate(idParamSchema, 'params'), validate(cancelSessionSchema), cancel)
router.patch('/:id/complete', validate(idParamSchema, 'params'), validate(emptyBodySchema), complete)

module.exports = router
