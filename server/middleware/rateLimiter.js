const rateLimit = require('express-rate-limit')
const RedisStore = require('rate-limit-redis')
const config = require('../config/env')
const { redisService } = require('../services/redis.service')

const message = {
  success: false,
  message: 'Too many requests, please try again later.'
}

const store = config.redis.mode === 'redis'
  ? new RedisStore({
    prefix: 'averra:rl:',
    sendCommand: async (...args) => {
      const client = await redisService.waitForReady()
      return client.call(...args)
    }
  })
  : undefined

const options = (limit) => ({
  windowMs: config.rateLimit.windowMs,
  limit,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message,
  ...(store ? { store } : {})
})

const rateLimiter = rateLimit(options(config.rateLimit.max))
const authLimiter = rateLimit(options(config.rateLimit.authMax))
const sensitiveLimiter = rateLimit(options(config.rateLimit.sensitiveMax))

module.exports = { rateLimiter, authLimiter, sensitiveLimiter }
