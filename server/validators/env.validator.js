const { z } = require('zod')

const booleanFromEnv = z.preprocess(
  (value) => (value === undefined ? 'false' : value),
  z.enum(['true', 'false']).transform((value) => value === 'true')
)

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().max(65535).default(5000),
  MONGODB_URI: z.string().trim().optional().default(''),
  CLIENT_ORIGIN: z.string().trim().url().default('http://localhost:5173'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
  SENSITIVE_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),
  MESSAGE_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
  MESSAGE_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(30),
  REVIEW_REPORT_THRESHOLD: z.coerce.number().int().min(1).default(3),
  JWT_SECRET: z.string().trim().optional().default(''),
  JWT_EXPIRES_IN: z.string().trim().regex(/^\d+[smhdwy]$/, 'must be a duration such as 7d or 15m').default('7d'),
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(4).max(17).default(12),
  REDIS_URL: z
    .string()
    .trim()
    .refine((value) => !value || /^rediss?:\/\//.test(value), 'must be a redis:// or rediss:// URL')
    .optional()
    .default(''),
  ALLOW_INSECURE_NO_REDIS: booleanFromEnv.default('false'),
  TRUST_PROXY: z.string().trim().refine(
    (value) => value === 'true' || value === 'false' || /^\d+$/.test(value),
    'must be true, false, or a proxy hop count'
  ).default('false'),
  LOG_LEVEL: z.enum(['silent', 'error', 'warn', 'info', 'debug']).default('info'),
  MONGO_CONNECT_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
  MONGO_CONNECT_RETRIES: z.coerce.number().int().min(0).max(10).default(3),
  MONGO_TRANSACTIONS_DISABLED: booleanFromEnv.default('false'),
  OUTBOX_WORKER_ENABLED: booleanFromEnv.default('true'),
  OUTBOX_POLL_INTERVAL_MS: z.coerce.number().int().min(100).default(5000),
  OUTBOX_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(20).default(5),
  OUTBOX_CLAIM_TIMEOUT_MS: z.coerce.number().int().min(1000).default(60000),
  SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().min(1000).default(10000)
})

module.exports = { envSchema }
