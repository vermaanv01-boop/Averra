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
  const response = { success: false, message }

  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    statusCode = 400
    message = 'Invalid JSON payload'
    response.message = message
  } else if (err instanceof mongoose.Error.ValidationError) {
    statusCode = 400
  } else if (err instanceof mongoose.Error.CastError) {
    statusCode = 400
    message = 'Invalid identifier'
    response.message = message
  } else if (err.code === 11000) {
    statusCode = 409
    const field = Object.keys(err.keyPattern || {})[0]
    message = field ? `${field} already exists` : 'Duplicate field value'
    response.message = message
  }

  if (err.details) {
    response.details = err.details
  }

  if (statusCode >= 500) {
    logger.error(err.stack || err.message)
    if (config.env === 'development') {
      response.stack = err.stack
    }
  }

  res.status(statusCode).json(response)
}

module.exports = { notFound, errorHandler }
