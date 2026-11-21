const http = require('http')
const app = require('./app')
const config = require('./config/env')
const connectDB = require('./config/db')
const { initSocket, closeSocket } = require('./socket')
const { redisService } = require('./services/redis.service')
const { startOutboxWorker, stopOutboxWorker } = require('./services/outboxWorker')
const logger = require('./utils/logger')

let httpServer = null
let io = null
let shuttingDown = false

const startServer = async () => {
  await connectDB.connectDB()

  if (config.redis.mode === 'redis') {
    await redisService.connect()
  }

  httpServer = http.createServer(app)
  io = initSocket(httpServer)

  await startOutboxWorker()

  await new Promise((resolve, reject) => {
    const onError = (error) => {
      httpServer.removeListener('listening', onListening)
      reject(error)
    }
    const onListening = () => {
      httpServer.removeListener('error', onError)
      resolve()
    }
    httpServer.once('error', onError)
    httpServer.once('listening', onListening)
    httpServer.listen(config.port)
  })

  logger.info('Server listening', { port: config.port, redisMode: config.redis.mode })
  return { httpServer, io }
}

const shutdown = async ({
  signal = 'SIGTERM',
  server = httpServer,
  socket = io,
  exit = true
} = {}) => {
  if (shuttingDown) return
  shuttingDown = true
  logger.info('Shutdown started', { signal })

  const forceTimer = setTimeout(() => {
    logger.error('Forced shutdown after timeout', { timeoutMs: config.shutdownTimeoutMs })
    if (exit) process.exit(1)
  }, config.shutdownTimeoutMs)
  forceTimer.unref()

  try {
    stopOutboxWorker()
    if (socket) await closeSocket(socket)
    if (server?.listening) {
      await new Promise((resolve) => {
        server.close(resolve)
        if (typeof server.closeAllConnections === 'function') server.closeAllConnections()
      })
    }
    if (config.redis.mode === 'redis') await redisService.disconnect()
    await connectDB.disconnectDB()
    clearTimeout(forceTimer)
    logger.info('Shutdown complete', { signal })
    if (exit) process.exit(0)
  } catch (error) {
    clearTimeout(forceTimer)
    logger.error('Shutdown failed', { signal, error: error.message })
    if (exit) process.exit(1)
  }
}

const installProcessHandlers = () => {
  process.on('SIGINT', () => shutdown({ signal: 'SIGINT' }))
  process.on('SIGTERM', () => shutdown({ signal: 'SIGTERM' }))
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', { error: error.message, stack: error.stack })
    shutdown({ signal: 'uncaughtException' })
  })
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection', { error: String(reason) })
    shutdown({ signal: 'unhandledRejection' })
  })
}

if (require.main === module) {
  installProcessHandlers()
  startServer().catch((error) => {
    logger.error('Failed to start server', { error: error.message })
    process.exit(1)
  })
}

module.exports = { startServer, shutdown, installProcessHandlers }
