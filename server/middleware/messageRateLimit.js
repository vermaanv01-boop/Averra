const AppError = require('../utils/AppError')
const messageRateLimit = require('../services/messageRateLimit.service')

const enforceMessageRateLimit = (req, res, next) => {
  const result = messageRateLimit.consume(req.user.id)

  if (!result.allowed) {
    return next(
      new AppError('Too many messages, please try again shortly', 429, {
        retryAfterMs: result.retryAfterMs
      })
    )
  }

  next()
}

module.exports = enforceMessageRateLimit
