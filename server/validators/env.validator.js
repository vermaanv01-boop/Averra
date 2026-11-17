const { z } = require('zod')

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().max(65535).default(5000),
  MONGODB_URI: z.string().trim().optional().default(''),
  CLIENT_ORIGIN: z.string().trim().url().default('http://localhost:5173'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
  JWT_SECRET: z.string().trim().optional().default(''),
  JWT_EXPIRES_IN: z.string().trim().default('7d'),
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(4).max(17).default(12)
})

module.exports = { envSchema }
