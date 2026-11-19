const http = require('http')
const mongoose = require('mongoose')
const app = require('./app')
const config = require('./config/env')
const connectDB = require('./config/db')
const { initSocket } = require('./socket')
const logger = require('./utils/logger')

const startServer = async () => {
  await connectDB()

  const server = http.createServer(app)
  initSocket(server)

  server.listen(config.port, () => {
    logger.info(`Server listening on port ${config.port}`)
  })

  const shutdown = async (signal) => {
    logger.info(`${signal} received. Shutting down...`)
    server.close(async () => {
      await mongoose.disconnect()
      process.exit(0)
    })
  }

  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))
}

startServer().catch((error) => {
  logger.error(`Failed to start server: ${error.message}`)
  process.exit(1)
})
