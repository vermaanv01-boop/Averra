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
const jwtSecret =
  data.JWT_SECRET ||
  (data.NODE_ENV === 'production' ? '' : crypto.randomBytes(32).toString('hex'))

if (!jwtSecret) {
  throw new Error('JWT_SECRET must be set when NODE_ENV is production')
}

if (!data.JWT_SECRET && data.NODE_ENV !== 'test') {
  logger.warn('JWT_SECRET is not set; using an ephemeral development secret.')
}

module.exports = {
  env: data.NODE_ENV,
  port: data.PORT,
  mongoUri: data.MONGODB_URI,
  clientOrigin: data.CLIENT_ORIGIN,
  bcryptSaltRounds: data.BCRYPT_SALT_ROUNDS,
  jwt: {
    secret: jwtSecret,
    expiresIn: data.JWT_EXPIRES_IN
  },
  rateLimit: {
    windowMs: data.RATE_LIMIT_WINDOW_MS,
    max: data.RATE_LIMIT_MAX,
    authMax: data.AUTH_RATE_LIMIT_MAX,
    messageWindowMs: data.MESSAGE_RATE_LIMIT_WINDOW_MS,
    messageMax: data.MESSAGE_RATE_LIMIT_MAX
  }
}
