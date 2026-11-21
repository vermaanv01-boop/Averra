const mongoose = require('mongoose')
const config = require('./env')
const logger = require('../utils/logger')

let eventsRegistered = false

const registerConnectionEvents = () => {
  if (eventsRegistered) return
  eventsRegistered = true

  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected')
  })
  mongoose.connection.on('reconnected', () => {
    logger.info('MongoDB reconnected')
  })
  mongoose.connection.on('error', (error) => {
    logger.error('MongoDB connection error', { error: error.message })
  })
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const connectDB = async () => {
  registerConnectionEvents()

  if (!config.mongoUri) {
    logger.warn('MONGODB_URI is not set; skipping database connection.')
    return null
  }

  const attempts = config.database.connectRetries + 1
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const connection = await mongoose.connect(config.mongoUri, {
        serverSelectionTimeoutMS: config.database.connectTimeoutMs
      })
      logger.info('MongoDB connected')
      return connection
    } catch (error) {
      logger.error('MongoDB connection failed', { attempt, attempts, error: error.message })
      if (attempt === attempts) throw error
      await delay(Math.min(2000, 250 * 2 ** (attempt - 1)))
    }
  }

  return null
}

const isDatabaseReady = () => mongoose.connection.readyState === 1

const disconnectDB = () => mongoose.disconnect()

module.exports = connectDB
module.exports.connectDB = connectDB
module.exports.isDatabaseReady = isDatabaseReady
module.exports.disconnectDB = disconnectDB
