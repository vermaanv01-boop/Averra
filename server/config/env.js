const crypto = require('crypto')
require('dotenv').config()

const { envSchema } = require('../validators/env.validator')
const logger = require('../utils/logger')

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join('; ')
  throw new Error(`Invalid environment configuration: ${details}`)
}

const data = parsed.data
const isProduction = data.NODE_ENV === 'production'
const insecureLocalFallback = data.ALLOW_INSECURE_NO_REDIS
const missingProductionConfig = []

if (isProduction && !data.JWT_SECRET) missingProductionConfig.push('JWT_SECRET')
if (isProduction && !data.MONGODB_URI) missingProductionConfig.push('MONGODB_URI')
if (isProduction && !process.env.CLIENT_ORIGIN) missingProductionConfig.push('CLIENT_ORIGIN')
if (isProduction && !data.REDIS_URL && !insecureLocalFallback) {
  missingProductionConfig.push('REDIS_URL (or ALLOW_INSECURE_NO_REDIS=true for a single-instance deployment)')
}

if (missingProductionConfig.length) {
  throw new Error(`Missing required production configuration: ${missingProductionConfig.join(', ')}`)
}

const jwtSecret =
  data.JWT_SECRET || (isProduction ? '' : crypto.randomBytes(32).toString('hex'))

if (!jwtSecret) {
  throw new Error('JWT_SECRET must be set when NODE_ENV is production')
}

if (!data.JWT_SECRET && data.NODE_ENV !== 'test') {
  logger.warn('JWT_SECRET is not set; using an ephemeral development secret.')
}

if (!data.REDIS_URL && !isProduction) {
  logger.warn('REDIS_URL is not set; using local-only state. This is not distributed-safe.')
}

if (isProduction && insecureLocalFallback) {
  logger.warn('Redis is disabled in production; only one backend instance may run.')
}

const trustProxy =
  data.TRUST_PROXY === 'true' ? true
    : data.TRUST_PROXY === 'false' ? false
      : Number(data.TRUST_PROXY)

module.exports = {
  env: data.NODE_ENV,
  isProduction,
  port: data.PORT,
  mongoUri: data.MONGODB_URI,
  clientOrigin: data.CLIENT_ORIGIN,
  trustProxy,
  bcryptSaltRounds: data.BCRYPT_SALT_ROUNDS,
  jwt: {
    secret: jwtSecret,
    expiresIn: data.JWT_EXPIRES_IN
  },
  rateLimit: {
    windowMs: data.RATE_LIMIT_WINDOW_MS,
    max: data.RATE_LIMIT_MAX,
    authMax: data.AUTH_RATE_LIMIT_MAX,
    sensitiveMax: data.SENSITIVE_RATE_LIMIT_MAX,
    messageWindowMs: data.MESSAGE_RATE_LIMIT_WINDOW_MS,
    messageMax: data.MESSAGE_RATE_LIMIT_MAX
  },
  redis: {
    url: data.REDIS_URL,
    mode: data.REDIS_URL ? 'redis' : 'local',
    required: isProduction && !insecureLocalFallback,
    allowLocalFallback: insecureLocalFallback || !isProduction
  },
  database: {
    connectTimeoutMs: data.MONGO_CONNECT_TIMEOUT_MS,
    connectRetries: data.MONGO_CONNECT_RETRIES,
    transactionsDisabled: data.MONGO_TRANSACTIONS_DISABLED
  },
  outbox: {
    workerEnabled: data.OUTBOX_WORKER_ENABLED && data.NODE_ENV !== 'test',
    pollIntervalMs: data.OUTBOX_POLL_INTERVAL_MS,
    maxAttempts: data.OUTBOX_MAX_ATTEMPTS,
    claimTimeoutMs: data.OUTBOX_CLAIM_TIMEOUT_MS
  },
  shutdownTimeoutMs: data.SHUTDOWN_TIMEOUT_MS,
  review: {
    reportThreshold: data.REVIEW_REPORT_THRESHOLD
  }
}
