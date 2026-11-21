const rateLimit = require('express-rate-limit')
const RedisStore = require('rate-limit-redis')
const config = require('../config/env')
const { redisService } = require('../services/redis.service')

const message = {
  success: false,
  message: 'Too many requests, please try again later.'
}

const createStore = (prefix) => config.redis.mode !== 'redis'
  ? undefined
  : new RedisStore({
    prefix: `averra:rl:${prefix}:`,
    sendCommand: async (...args) => {
      const client = await redisService.waitForReady()
      return client.call(...args)
    }
  })

const options = (limit, prefix) => ({
  windowMs: config.rateLimit.windowMs,
  limit,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message,
  ...(prefix ? { store: createStore(prefix) } : {})
})

const rateLimiter = rateLimit(options(config.rateLimit.max, 'global'))
const authLimiter = rateLimit(options(config.rateLimit.authMax, 'auth'))
const sensitiveLimiter = rateLimit(options(config.rateLimit.sensitiveMax, 'sensitive'))

module.exports = { rateLimiter, authLimiter, sensitiveLimiter }
