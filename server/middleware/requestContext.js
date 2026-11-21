const { randomUUID } = require('crypto')
const logger = require('../utils/logger')

const REQUEST_ID_PATTERN = /^[a-zA-Z0-9._-]{1,64}$/

const requestContext = (req, res, next) => {
  const supplied = req.get('x-request-id')
  const requestId = supplied && REQUEST_ID_PATTERN.test(supplied) ? supplied : randomUUID()
  const startedAt = process.hrtime.bigint()

  req.id = requestId
  req.log = logger.child({ requestId })
  res.setHeader('x-request-id', requestId)

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6
    req.log.info('Request completed', {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: Math.round(durationMs * 100) / 100
    })
  })

  next()
}

module.exports = requestContext
