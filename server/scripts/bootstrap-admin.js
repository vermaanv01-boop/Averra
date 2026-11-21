const mongoose = require('mongoose')
const config = require('../config/env')
const connectDB = require('../config/db')
const logger = require('../utils/logger')
const { bootstrapAdmin } = require('../services/adminBootstrap.service')

const requiredVariables = ['ADMIN_NAME', 'ADMIN_USERNAME', 'ADMIN_EMAIL', 'ADMIN_PASSWORD']
const missing = requiredVariables.filter((key) => !process.env[key])

if (missing.length) {
  logger.error(`Missing bootstrap environment variables: ${missing.join(', ')}`)
  process.exit(1)
}

if (!config.mongoUri) {
  logger.error('MONGODB_URI must be set to bootstrap an administrator')
  process.exit(1)
}

const run = async () => {
  await connectDB()

  const result = await bootstrapAdmin({
    name: process.env.ADMIN_NAME,
    username: process.env.ADMIN_USERNAME,
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD
  })

  logger.info(
    `Administrator ${result.mode}: ${result.user.id} (${result.user.email})`
  )
}

run()
  .catch((error) => {
    logger.error(`Administrator bootstrap failed: ${error.message}`)
    process.exitCode = 1
  })
  .finally(async () => {
    await mongoose.disconnect()
  })
