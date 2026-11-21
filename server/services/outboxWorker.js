const config = require('../config/env')
const logger = require('../utils/logger')
const notificationOutbox = require('./notificationOutbox.service')

let timer = null
let running = false

const processBatch = async () => {
  if (running) return
  running = true
  try {
    await notificationOutbox.processDueBatch(50)
  } catch (error) {
    logger.error('Notification outbox worker failed', { error: error.message })
  } finally {
    running = false
  }
}

const startOutboxWorker = async () => {
  if (!config.outbox.workerEnabled || timer) return false
  await notificationOutbox.recover()
  timer = setInterval(processBatch, config.outbox.pollIntervalMs)
  logger.info('Notification outbox worker started')
  return true
}

const stopOutboxWorker = () => {
  if (!timer) return
  clearInterval(timer)
  timer = null
  logger.info('Notification outbox worker stopped')
}

module.exports = { startOutboxWorker, stopOutboxWorker, processBatch }
