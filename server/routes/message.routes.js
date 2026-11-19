const express = require('express')
const validate = require('../middleware/validate')
const protect = require('../middleware/protect')
const { idParamSchema, emptyBodySchema } = require('../validators/common.validator')
const { updateMessageSchema } = require('../validators/message.validator')
const { update, remove } = require('../controllers/message.controller')

const router = express.Router()

router.use(protect)

router.patch('/:id', validate(idParamSchema, 'params'), validate(updateMessageSchema), update)
router.delete('/:id', validate(idParamSchema, 'params'), validate(emptyBodySchema), remove)

module.exports = router
