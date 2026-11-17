const express = require('express')
const validate = require('../middleware/validate')
const protect = require('../middleware/protect')
const { updateProfileSchema, usernameParamSchema } = require('../validators/user.validator')
const { getMe, updateMe, getPublicProfile } = require('../controllers/user.controller')

const router = express.Router()

router.get('/me', protect, getMe)
router.patch('/me', protect, validate(updateProfileSchema), updateMe)
router.get('/:username', validate(usernameParamSchema, 'params'), getPublicProfile)

module.exports = router
