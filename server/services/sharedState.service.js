const config = require('../config/env')
const logger = require('../utils/logger')
const { redisService } = require('./redis.service')

const PREFIX = 'averra'

const RATE_LIMIT_SCRIPT = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local member = ARGV[4]
redis.call('ZREMRANGEBYSCORE', key, 0, now - window)
local count = redis.call('ZCARD', key)
if count >= limit then
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  local retry = window
  if oldest[2] then retry = math.max(0, tonumber(oldest[2]) + window - now) end
  return { 0, retry }
end
redis.call('ZADD', key, now, member)
redis.call('PEXPIRE', key, window)
return { 1, 0 }
`

const createLocalState = () => {
  const presence = new Map()
  const typing = new Map()
  const typingByUser = new Map()
  const rateLimits = new Map()

  const pruneTyping = (key) => {
    const entry = typing.get(key)
    if (entry && entry.expiresAt <= Date.now()) {
      typing.delete(key)
      typingByUser.get(entry.userId)?.delete(key)
      return null
    }
    return entry
  }

  return {
    mode: 'local',
    async presenceAdd(userId, socketId) {
      const sockets = presence.get(userId) || new Set()
      const added = !sockets.has(socketId)
      sockets.add(socketId)
      presence.set(userId, sockets)
      return { added, count: sockets.size }
    },
    async presenceRemove(userId, socketId) {
      const sockets = presence.get(userId)
      if (!sockets) return { removed: false, count: 0 }
      const removed = sockets.delete(socketId)
      if (sockets.size === 0) presence.delete(userId)
      return { removed, count: sockets.size }
    },
    async presenceExists(userId) {
      return presence.has(userId)
    },
    async typingSet(userId, key, value, ttlMs) {
      pruneTyping(key)
      if (!typingByUser.has(userId)) typingByUser.set(userId, new Set())
      typingByUser.get(userId).add(key)
      typing.set(key, { value, userId, expiresAt: Date.now() + ttlMs })
    },
    async typingGet(key) {
      return pruneTyping(key)?.value || null
    },
    async typingUserKeys(userId) {
      const keys = [...(typingByUser.get(userId) || [])]
      return keys.filter((key) => pruneTyping(key))
    },
    async typingDelete(key) {
      const entry = pruneTyping(key)
      typing.delete(key)
      if (entry) typingByUser.get(entry.userId)?.delete(key)
    },
    async typingClearUser(userId) {
      const keys = await this.typingUserKeys(userId)
      for (const key of keys) await this.typingDelete(key)
      typingByUser.delete(userId)
    },
    async consumeRateLimit(key, limit, windowMs, member) {
      const now = Date.now()
      const recent = (rateLimits.get(key) || []).filter((timestamp) => now - timestamp < windowMs)
      if (recent.length >= limit) {
        rateLimits.set(key, recent)
        return { allowed: false, retryAfterMs: Math.max(0, windowMs - (now - recent[0])) }
      }
      recent.push(now)
      rateLimits.set(key, recent)
      return { allowed: true, retryAfterMs: 0, member }
    },
    async resetRateLimit(key) {
      if (key) rateLimits.delete(key)
      else rateLimits.clear()
    },
    async reset() {
      presence.clear()
      typing.clear()
      typingByUser.clear()
      rateLimits.clear()
    }
  }
}

const createRedisState = (redis) => {
  const presenceKey = (userId) => `${PREFIX}:presence:${userId}`
  const typingKey = (key) => `${PREFIX}:typing:${key}`
  const typingUserKey = (userId) => `${PREFIX}:typing:user:${userId}`
  const rateLimitKey = (key) => `${PREFIX}:ratelimit:${key}`

  return {
    mode: 'redis',
    async presenceAdd(userId, socketId) {
      const key = presenceKey(userId)
      const added = await redis.call('SADD', key, socketId)
      const count = await redis.call('SCARD', key)
      return { added: added === 1, count }
    },
    async presenceRemove(userId, socketId) {
      const key = presenceKey(userId)
      const removed = await redis.call('SREM', key, socketId)
      const count = await redis.call('SCARD', key)
      if (count === 0) await redis.call('DEL', key)
      return { removed: removed === 1, count }
    },
    async presenceExists(userId) {
      return (await redis.call('EXISTS', presenceKey(userId))) === 1
    },
    async typingSet(userId, key, value, ttlMs) {
      const stateKey = typingKey(key)
      const userKey = typingUserKey(userId)
      await redis.call('SET', stateKey, JSON.stringify(value), 'PX', ttlMs)
      await redis.call('SADD', userKey, key)
      await redis.call('EXPIRE', userKey, Math.ceil(ttlMs / 1000) + 2)
    },
    async typingGet(key) {
      const value = await redis.call('GET', typingKey(key))
      if (!value) return null
      try {
        return JSON.parse(value)
      } catch {
        return null
      }
    },
    async typingUserKeys(userId) {
      const keys = await redis.call('SMEMBERS', typingUserKey(userId))
      const existing = []
      for (const key of keys) {
        if (await redis.call('EXISTS', typingKey(key))) existing.push(key)
      }
      return existing
    },
    async typingDelete(key) {
      const value = await redis.call('GET', typingKey(key))
      await redis.call('DEL', typingKey(key))
      if (value) {
        try {
          const parsed = JSON.parse(value)
          if (parsed?.userId) await redis.call('SREM', typingUserKey(parsed.userId), key)
        } catch {
          logger.warn('Ignoring malformed Redis typing state')
        }
      }
    },
    async typingClearUser(userId) {
      const keys = await this.typingUserKeys(userId)
      if (keys.length) await redis.call('DEL', ...keys.map(typingKey))
      await redis.call('DEL', typingUserKey(userId))
    },
    async consumeRateLimit(key, limit, windowMs, member) {
      const result = await redis.eval(
        RATE_LIMIT_SCRIPT,
        1,
        rateLimitKey(key),
        Date.now(),
        windowMs,
        limit,
        member
      )
      const [allowed, retryAfterMs] = result
      return { allowed: Number(allowed) === 1, retryAfterMs: Number(retryAfterMs) || 0, member }
    },
    async resetRateLimit(key) {
      await redis.call('DEL', rateLimitKey(key))
    },
    async reset() {
      throw new Error('Shared Redis state cannot be reset globally')
    }
  }
}

const createSharedState = ({ mode = config.redis.mode, redis = redisService } = {}) =>
  mode === 'redis' ? createRedisState(redis) : createLocalState()

const sharedState = createSharedState()

const configureSharedState = (next) => {
  sharedState = next
}

module.exports = {
  createLocalState,
  createRedisState,
  createSharedState,
  getSharedState: () => sharedState,
  configureSharedState
}
