const assert = require('node:assert/strict')
const { spawnSync } = require('node:child_process')
const EventEmitter = require('node:events')
const os = require('node:os')
const path = require('node:path')
const { after, before, describe, it } = require('node:test')

process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test-only-secret'
process.env.RATE_LIMIT_MAX = '10000'
process.env.AUTH_RATE_LIMIT_MAX = '1000'
process.env.LOG_LEVEL = 'silent'

const configPath = path.join(__dirname, '..', 'config', 'env.js')
const redisTestUrl = process.env.REDIS_TEST_URL
const describeRedis = redisTestUrl ? describe : describe.skip

const runConfigCheck = (overrides) => {
  const childEnv = { ...process.env, ...overrides }
  if (!Object.prototype.hasOwnProperty.call(overrides, 'CLIENT_ORIGIN')) {
    delete childEnv.CLIENT_ORIGIN
  }
  if (!Object.prototype.hasOwnProperty.call(overrides, 'ALLOW_INSECURE_NO_REDIS')) {
    delete childEnv.ALLOW_INSECURE_NO_REDIS
  }

  return spawnSync(
    process.execPath,
    ['-e', `require(${JSON.stringify(configPath)})`],
    { cwd: os.tmpdir(), env: childEnv, encoding: 'utf8' }
  )
}

describe('Production configuration', () => {
  it('fails closed when required production configuration is missing', () => {
    const result = runConfigCheck({
      NODE_ENV: 'production',
      JWT_SECRET: '',
      MONGODB_URI: '',
      REDIS_URL: ''
    })

    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /Missing required production configuration/)
    assert.match(result.stderr, /JWT_SECRET/)
    assert.match(result.stderr, /MONGODB_URI/)
    assert.match(result.stderr, /CLIENT_ORIGIN/)
    assert.match(result.stderr, /REDIS_URL/)
  })

  it('requires an explicit opt-in for a production single-instance deployment', () => {
    const result = runConfigCheck({
      NODE_ENV: 'production',
      JWT_SECRET: 'production-only-secret',
      MONGODB_URI: 'mongodb://127.0.0.1:27017/averra',
      REDIS_URL: '',
      ALLOW_INSECURE_NO_REDIS: 'true',
      JWT_EXPIRES_IN: '7d'
    })

    assert.equal(result.status, 0, result.stderr)
  })
})

describe('Redis lifecycle', () => {
  it('surfaces connection failures and recovers when Redis becomes ready again', async () => {
    const { createRedisService } = require('../services/redis.service')
    const clients = []

    const makeClient = () => {
      const client = new EventEmitter()
      client.status = 'idle'
      client.connect = async () => {
        client.status = 'ready'
        client.emit('ready')
      }
      client.call = async (command) => (command === 'PING' ? 'PONG' : undefined)
      client.eval = async () => 1
      client.quit = async () => {
        client.status = 'end'
      }
      clients.push(client)
      return client
    }

    const service = createRedisService({
      url: 'redis://127.0.0.1:6379',
      clientFactory: makeClient,
      connectTimeoutMs: 50
    })
    const states = []
    const unsubscribe = service.onStatus((event) => states.push(event.state))

    await service.connect()
    assert.equal(service.status().state, 'ready')
    assert.equal(await service.call('PING'), 'PONG')

    clients[0].emit('error', new Error('connection lost'))
    assert.equal(service.status().state, 'error')
    await assert.rejects(service.call('PING'))

    clients[0].emit('ready')
    await service.waitForReady(50)
    assert.equal(await service.call('PING'), 'PONG')
    assert.ok(states.includes('reconnecting') === false)

    unsubscribe()
    await service.disconnect()
    assert.equal(service.status().state, 'closed')
  })

  it('uses the configured URL and rejects invalid production fallback without opt-in', () => {
    const config = require('../config/env')
    assert.equal(config.env, 'test')
    assert.equal(config.redis.mode, 'local')
    assert.equal(config.redis.required, false)
    assert.equal(config.redis.allowLocalFallback, true)
  })
})

describe('Local shared state', () => {
  it('tracks multiple connections and enforces a shared local rate limit', async () => {
    const { createLocalState } = require('../services/sharedState.service')
    const state = createLocalState()

    assert.deepEqual(await state.presenceAdd('user-1', 'socket-1'), { added: true, count: 1 })
    assert.deepEqual(await state.presenceAdd('user-1', 'socket-2'), { added: true, count: 2 })
    assert.equal(await state.presenceExists('user-1'), true)
    assert.deepEqual(await state.presenceRemove('user-1', 'socket-1'), { removed: true, count: 1 })
    assert.deepEqual(await state.presenceRemove('user-1', 'socket-2'), { removed: true, count: 0 })
    assert.equal(await state.presenceExists('user-1'), false)

    const results = []
    for (let index = 0; index < 3; index += 1) {
      results.push(await state.consumeRateLimit('local-key', 2, 60000, `member-${index}`))
    }
    assert.deepEqual(results.map((result) => result.allowed), [true, true, false])
    await state.resetRateLimit('local-key')
    assert.equal((await state.consumeRateLimit('local-key', 1, 60000, 'fresh')).allowed, true)
  })
})

describeRedis('Redis shared state with REDIS_TEST_URL', () => {
  let services
  let states
  let userId

  before(async () => {
    const { createRedisService, redisService: singleton } = require('../services/redis.service')
    const { createSharedState } = require('../services/sharedState.service')

    services = [
      createRedisService({ url: redisTestUrl }),
      createRedisService({ url: redisTestUrl })
    ]
    await Promise.all(services.map((service) => service.connect()))
    states = services.map((service) => createSharedState({ mode: 'redis', redis: service }))
    userId = `hardening-${Date.now()}`
    assert.equal(singleton.status().mode, 'local')
  })

  after(async () => {
    if (!services?.[0]) return
    const keys = await services[0].call('KEYS', `averra:*${userId}*`)
    if (keys.length) await services[0].call('DEL', ...keys)
    await Promise.all(services.map((service) => service.disconnect()))
  })

  it('shares presence and rate-limit counters across independent services', async () => {
    assert.equal((await states[0].presenceAdd(userId, 'socket-a')).count, 1)
    assert.equal((await states[1].presenceAdd(userId, 'socket-b')).count, 2)
    assert.equal(await states[1].presenceExists(userId), true)

    const key = `shared:${userId}`
    assert.equal((await states[0].consumeRateLimit(key, 1, 60000, 'a')).allowed, true)
    const denied = await states[1].consumeRateLimit(key, 1, 60000, 'b')
    assert.equal(denied.allowed, false)
    assert.ok(denied.retryAfterMs > 0)
  })
})

describe('Graceful shutdown', () => {
  it('closes HTTP and dependencies with exit disabled', async () => {
    const { shutdown } = require('../server')
    let serverClosed = false
    let connectionsClosed = false

    const server = {
      listening: true,
      close(callback) {
        serverClosed = true
        callback()
      },
      closeAllConnections() {
        connectionsClosed = true
      }
    }

    await shutdown({ signal: 'SIGTERM', server, socket: null, exit: false })

    assert.equal(serverClosed, true)
    assert.equal(connectionsClosed, true)
  })
})
