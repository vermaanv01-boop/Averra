const mongoose = require('mongoose')
const config = require('./env')
const logger = require('../utils/logger')

const connectDB = async () => {
  if (!config.mongoUri) {
    logger.warn('MONGODB_URI is not set; skipping database connection.')
    return null
  }

  try {
    const connection = await mongoose.connect(config.mongoUri, {
      serverSelectionTimeoutMS: 5000
    })
    logger.info('MongoDB connected')
    return connection
  } catch (error) {
    logger.error(`MongoDB connection failed: ${error.message}`)
    throw error
  }
}

module.exports = connectDB
