const rateLimit = require('express-rate-limit')
const config = require('../config/env')

const message = {
  success: false,
  message: 'Too many requests, please try again later.'
}

const rateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  limit: config.rateLimit.max,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message
})

const authLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  limit: config.rateLimit.authMax,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message
})

module.exports = { rateLimiter, authLimiter }
