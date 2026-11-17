const mongoose = require('mongoose')
const config = require('../config/env')
const logger = require('../utils/logger')

const notFound = (req, res) => {
  res.status(404).json({
    success: false,
    message: `Cannot ${req.method} ${req.originalUrl}`
  })
}

const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500
  let message = err.message || 'Internal server error'

  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    statusCode = 400
    message = 'Invalid JSON payload'
  } else if (err instanceof mongoose.Error.ValidationError) {
    statusCode = 400
  } else if (err.code === 11000) {
    statusCode = 409
    message = 'Duplicate field value'
  }

  if (statusCode >= 500) {
    logger.error(err.stack || err.message)
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(config.env === 'development' && statusCode >= 500 ? { stack: err.stack } : {})
  })
}

module.exports = { notFound, errorHandler }
