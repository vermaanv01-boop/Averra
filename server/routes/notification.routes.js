const express = require('express')
const validate = require('../middleware/validate')
const protect = require('../middleware/protect')
const {
  listNotificationsSchema,
  updatePreferencesSchema,
  idParamSchema,
  emptyBodySchema
} = require('../validators/notification.validator')
const {
  list,
  unreadCount,
  markRead,
  markAllRead,
  remove,
  getPreferences,
  updatePreferences
} = require('../controllers/notification.controller')

const router = express.Router()

router.use(protect)

router.get('/', validate(listNotificationsSchema, 'query'), list)
router.get('/unread-count', unreadCount)
router.get('/preferences', getPreferences)
router.patch('/preferences', validate(updatePreferencesSchema), updatePreferences)
router.patch('/read-all', validate(emptyBodySchema), markAllRead)
router.patch('/:id/read', validate(idParamSchema, 'params'), validate(emptyBodySchema), markRead)
router.delete('/:id', validate(idParamSchema, 'params'), remove)

module.exports = router
