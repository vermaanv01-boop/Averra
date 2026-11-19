const config = require('../config/env')

const attempts = new Map()

const consume = (userId) => {
  const key = userId.toString()
  const now = Date.now()
  const windowMs = config.rateLimit.messageWindowMs
  const recent = (attempts.get(key) || []).filter((timestamp) => now - timestamp < windowMs)

  if (recent.length >= config.rateLimit.messageMax) {
    attempts.set(key, recent)
    return { allowed: false, retryAfterMs: windowMs - (now - recent[0]) }
  }

  recent.push(now)
  attempts.set(key, recent)
  return { allowed: true, retryAfterMs: 0 }
}

const reset = () => attempts.clear()

module.exports = { consume, reset }
