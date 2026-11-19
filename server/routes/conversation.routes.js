const express = require('express')
const validate = require('../middleware/validate')
const protect = require('../middleware/protect')
const enforceMessageRateLimit = require('../middleware/messageRateLimit')
const { idParamSchema, emptyBodySchema } = require('../validators/common.validator')
const {
  createMessageSchema,
  listMessagesSchema
} = require('../validators/message.validator')
const {
  list,
  getOne,
  messages,
  unreadCount,
  createMessage,
  markRead
} = require('../controllers/conversation.controller')

const router = express.Router()

router.use(protect)

router.get('/', list)
router.get('/unread-count', unreadCount)
router.get('/:id/messages', validate(idParamSchema, 'params'), validate(listMessagesSchema, 'query'), messages)
router.post(
  '/:id/messages',
  validate(idParamSchema, 'params'),
  validate(createMessageSchema),
  enforceMessageRateLimit,
  createMessage
)
router.patch('/:id/read', validate(idParamSchema, 'params'), validate(emptyBodySchema), markRead)
router.get('/:id', validate(idParamSchema, 'params'), getOne)

module.exports = router
