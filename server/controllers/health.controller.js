const mongoose = require('mongoose')
const config = require('../config/env')
const { redisService } = require('../services/redis.service')
const { sendSuccess } = require('../utils/httpResponse')

const databaseStates = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting'
}

const buildChecks = () => {
  const redis = redisService.status()
  return {
    database: databaseStates[mongoose.connection.readyState] || 'unknown',
    redis: {
      mode: redis.mode,
      state: redis.state
    }
  }
}

const getHealth = (req, res) => {
  sendSuccess(res, {
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    database: databaseStates[mongoose.connection.readyState] || 'unknown',
    checks: buildChecks()
  })
}

const getReadiness = (req, res) => {
  const checks = buildChecks()
  const databaseReady = mongoose.connection.readyState === 1
  const redisReady = !config.redis.required || checks.redis.state === 'ready'
  const ready = databaseReady && redisReady

  res.status(ready ? 200 : 503).json({
    success: ready,
    data: {
      status: ready ? 'ready' : 'not_ready',
      timestamp: new Date().toISOString(),
      checks
    }
  })
}

module.exports = { getHealth, getReadiness }
