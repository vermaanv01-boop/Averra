const mongoose = require('mongoose')
const config = require('../config/env')
const logger = require('../utils/logger')

const notFound = (req, res) => {
  res.status(404).json({
    success: false,
    message: `Cannot ${req.method} ${req.path}`,
    requestId: req.id || null
  })
}

const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500
  let message = err.message || 'Internal server error'
  const response = { success: false, requestId: req.id || null }

  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    statusCode = 400
    message = 'Invalid JSON payload'
  } else if (err instanceof mongoose.Error.ValidationError) {
    statusCode = 400
    message = 'Invalid request data'
  } else if (err instanceof mongoose.Error.CastError) {
    statusCode = 400
    message = 'Invalid identifier'
  } else if (err.code === 11000) {
    statusCode = 409
    const field = Object.keys(err.keyPattern || {})[0]
    message = field ? `${field} already exists` : 'Duplicate field value'
  } else if (statusCode >= 500 && !err.isOperational && config.isProduction) {
    message = 'Internal server error'
  }

  response.message = message

  if (err.details && err.isOperational) {
    response.details = err.details
  }

  if (statusCode >= 500) {
    const log = req.log || logger
    log.error('Request failed', {
      method: req.method,
      path: req.path,
      status: statusCode,
      error: err.message,
      stack: config.env === 'development' ? err.stack : undefined
    })
    if (config.env === 'development') {
      response.stack = err.stack
    }
  }

  res.status(statusCode).json(response)
}

module.exports = { notFound, errorHandler }
