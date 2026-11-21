const express = require('express')
const validate = require('../middleware/validate')
const protect = require('../middleware/protect')
const { sensitiveLimiter } = require('../middleware/rateLimiter')
const {
  createReviewSchema,
  updateReviewSchema,
  reportReviewSchema,
  listReviewsSchema,
  userIdParamSchema,
  exchangeRequestIdParamSchema,
  idParamSchema
} = require('../validators/review.validator')
const {
  create,
  listForUser,
  listForExchange,
  getOne,
  update,
  remove,
  report
} = require('../controllers/review.controller')

const router = express.Router()

router.use(protect)

router.post('/', validate(createReviewSchema), create)
router.get('/user/:userId', validate(userIdParamSchema, 'params'), validate(listReviewsSchema, 'query'), listForUser)
router.get(
  '/exchange/:exchangeRequestId',
  validate(exchangeRequestIdParamSchema, 'params'),
  validate(listReviewsSchema, 'query'),
  listForExchange
)
router.get('/:id', validate(idParamSchema, 'params'), getOne)
router.patch('/:id', validate(idParamSchema, 'params'), validate(updateReviewSchema), update)
router.post('/:id/report', validate(idParamSchema, 'params'), validate(reportReviewSchema), report)
router.delete('/:id', validate(idParamSchema, 'params'), remove)

module.exports = router
