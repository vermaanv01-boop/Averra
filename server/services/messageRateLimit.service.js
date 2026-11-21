const { randomUUID } = require('crypto')
const config = require('../config/env')
const { getSharedState } = require('./sharedState.service')

const consume = async (userId) => {
  const key = userId.toString()
  const result = await getSharedState().consumeRateLimit(
    key,
    config.rateLimit.messageMax,
    config.rateLimit.messageWindowMs,
    randomUUID()
  )
  return { allowed: result.allowed, retryAfterMs: result.retryAfterMs }
}

const reset = () => getSharedState().resetRateLimit()

module.exports = { consume, reset }
