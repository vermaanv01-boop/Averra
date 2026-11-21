const config = require('../config/env')
const logger = require('../utils/logger')

const DEFAULT_CONNECT_TIMEOUT_MS = 5000

const createRedisService = ({
  url = config.redis.url,
  clientFactory,
  connectTimeoutMs = DEFAULT_CONNECT_TIMEOUT_MS
} = {}) => {
  const listeners = new Set()
  let client = null
  let subscriber = null
  let state = url ? 'idle' : 'local'

  const emit = (nextState) => {
    const previous = state
    state = nextState
    for (const listener of listeners) {
      try {
        listener({ state, previous, mode: url ? 'redis' : 'local' })
      } catch (error) {
        logger.error('Redis state listener failed', { error: error.message })
      }
    }
  }

  const attachListeners = (instance, label) => {
    if (!instance || typeof instance.on !== 'function') return
    instance.on('ready', () => {
      if (client && instance === client) emit('ready')
      logger.debug('Redis client ready', { client: label })
    })
    instance.on('reconnecting', () => {
      if (client && instance === client) emit('reconnecting')
      logger.warn('Redis client reconnecting', { client: label })
    })
    instance.on('error', (error) => {
      if (client && instance === client) emit('error')
      logger.error('Redis client error', { client: label, error: error.message })
    })
    instance.on('end', () => {
      if (client && instance === client && state !== 'closed') emit('disconnected')
    })
  }

  const makeClient = () => {
    if (clientFactory) return clientFactory(url)
    const Redis = require('ioredis')
    return new Redis(url, {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: null,
      retryStrategy: (times) => Math.min(times * 50, 2000)
    })
  }

  const connectOne = async (instance) => {
    if (!instance) return
    if (typeof instance.connect === 'function' && instance.status !== 'ready') {
      await instance.connect()
    }
  }

  const connect = async () => {
    if (!url) {
      emit('local')
      return null
    }
    if (client) {
      if (state === 'ready') return client
      await waitForReady()
      return client
    }

    emit('connecting')
    try {
      client = makeClient()
      attachListeners(client, 'main')
      const duplicate = clientFactory
        ? clientFactory(url)
        : typeof client.duplicate === 'function' ? client.duplicate() : makeClient()
      subscriber = duplicate
      attachListeners(subscriber, 'subscriber')

      await Promise.all([connectOne(client), connectOne(subscriber)])
      await waitForReady()
      emit('ready')
      logger.info('Redis connected')
      return client
    } catch (error) {
      emit('error')
      logger.error('Redis connection failed', { error: error.message })
      throw error
    }
  }

  const waitForReady = (timeoutMs = connectTimeoutMs) =>
    new Promise((resolve, reject) => {
      if (!url) {
        reject(new Error('Redis is not configured'))
        return
      }
      if (state === 'ready' && client) {
        resolve(client)
        return
      }

      let timer
      const unsubscribe = onStatus((event) => {
        if (event.state === 'ready') {
          cleanup()
          resolve(client)
        } else if (event.state === 'error' || event.state === 'disconnected') {
          cleanup()
          reject(new Error('Redis connection is unavailable'))
        }
      })

      const cleanup = () => {
        clearTimeout(timer)
        unsubscribe()
      }

      timer = setTimeout(() => {
        cleanup()
        reject(new Error('Timed out waiting for Redis'))
      }, timeoutMs)
    })

  const onStatus = (listener) => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }

  const command = async (name, args = []) => {
    const instance = await waitForReady()
    if (typeof instance[name] !== 'function') {
      throw new Error(`Redis client does not support ${name}`)
    }
    return instance[name](...args)
  }

  const call = (...args) => command('call', args)

  const evalScript = (script, numKeys, ...args) => command('eval', [script, numKeys, ...args])

  const getPubSub = () => (state === 'ready' && client ? { pub: client, sub: subscriber } : null)

  const disconnect = async () => {
    if (!client && !subscriber) {
      emit('closed')
      return
    }

    const clients = [subscriber, client].filter(Boolean)
    client = null
    subscriber = null

    await Promise.all(clients.map(async (instance) => {
      try {
        if (typeof instance.quit === 'function') {
          await instance.quit()
        } else if (typeof instance.disconnect === 'function') {
          instance.disconnect()
        }
      } catch (error) {
        logger.warn('Redis client close failed', { error: error.message })
      }
    }))
    emit('closed')
  }

  return {
    connect,
    disconnect,
    waitForReady,
    onStatus,
    command,
    call,
    eval: evalScript,
    getPubSub,
    getClient: () => client,
    status: () => ({ mode: url ? 'redis' : 'local', state, connected: state === 'ready' })
  }
}

const redisService = createRedisService()

module.exports = { createRedisService, redisService }
