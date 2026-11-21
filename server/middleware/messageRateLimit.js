const AppError = require('../utils/AppError')
const asyncHandler = require('../utils/asyncHandler')
const messageRateLimit = require('../services/messageRateLimit.service')

const enforceMessageRateLimit = asyncHandler(async (req, res, next) => {
  const result = await messageRateLimit.consume(req.user.id)

  if (!result.allowed) {
    return next(
      new AppError('Too many messages, please try again shortly', 429, {
        retryAfterMs: result.retryAfterMs
      })
    )
  }

  next()
})

module.exports = enforceMessageRateLimit
