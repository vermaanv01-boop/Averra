const express = require('express')
const validate = require('../middleware/validate')
const protect = require('../middleware/protect')
const {
  idParamSchema,
  emptyBodySchema
} = require('../validators/common.validator')
const {
  createRequestSchema,
  listRequestsSchema
} = require('../validators/exchangeRequest.validator')
const {
  create,
  list,
  getOne,
  accept,
  reject,
  cancel,
  complete
} = require('../controllers/exchangeRequest.controller')

const router = express.Router()

router.use(protect)

router.post('/', validate(createRequestSchema), create)
router.get('/', validate(listRequestsSchema, 'query'), list)
router.get('/:id', validate(idParamSchema, 'params'), getOne)
router.patch('/:id/accept', validate(idParamSchema, 'params'), validate(emptyBodySchema), accept)
router.patch('/:id/reject', validate(idParamSchema, 'params'), validate(emptyBodySchema), reject)
router.patch('/:id/cancel', validate(idParamSchema, 'params'), validate(emptyBodySchema), cancel)
router.patch('/:id/complete', validate(idParamSchema, 'params'), validate(emptyBodySchema), complete)

module.exports = router
