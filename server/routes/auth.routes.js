const express = require('express')
const { authLimiter } = require('../middleware/rateLimiter')
const validate = require('../middleware/validate')
const protect = require('../middleware/protect')
const { registerSchema, loginSchema } = require('../validators/auth.validator')
const { emptyBodySchema } = require('../validators/common.validator')
const { register, login, logout } = require('../controllers/auth.controller')

const router = express.Router()

router.post('/register', authLimiter, validate(registerSchema), register)
router.post('/login', authLimiter, validate(loginSchema), login)
router.post('/logout', protect, validate(emptyBodySchema), logout)

module.exports = router
