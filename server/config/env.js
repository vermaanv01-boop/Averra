require('dotenv').config()

const { envSchema } = require('../validators/env.validator')

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join('; ')
  throw new Error(`Invalid environment configuration: ${details}`)
}

const data = parsed.data

module.exports = {
  env: data.NODE_ENV,
  port: data.PORT,
  mongoUri: data.MONGODB_URI,
  clientOrigin: data.CLIENT_ORIGIN,
  rateLimit: {
    windowMs: data.RATE_LIMIT_WINDOW_MS,
    max: data.RATE_LIMIT_MAX
  }
}
