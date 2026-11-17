const mongoose = require('mongoose')
const { sendSuccess } = require('../utils/httpResponse')

const databaseStates = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting'
}

const getHealth = (req, res) => {
  sendSuccess(res, {
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    database: databaseStates[mongoose.connection.readyState] || 'unknown'
  })
}

module.exports = { getHealth }
