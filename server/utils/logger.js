const LEVELS = { silent: 0, error: 1, warn: 2, info: 3, debug: 4 }
const REDACTED_KEYS = new Set([
  'password',
  'passwordhash',
  'token',
  'authorization',
  'jwt',
  'secret',
  'jwtsecret',
  'cookie',
  'cookies',
  'apikey',
  'clientmessageid',
  'message'
])

const configuredLevel = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'test' ? 'silent' : 'info')
const threshold = LEVELS[configuredLevel] ?? LEVELS.info
const jsonOutput = process.env.NODE_ENV === 'production'

const redact = (value, depth = 0) => {
  if (!value || typeof value !== 'object' || depth > 5) return value
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1))

  const result = {}
  for (const [key, item] of Object.entries(value)) {
    result[key] = REDACTED_KEYS.has(key.toLowerCase()) ? '[REDACTED]' : redact(item, depth + 1)
  }
  return result
}

const write = (stream, payload) => {
  stream(payload + '\n')
}

const createLogger = (context = {}) => {
  const log = (level, message, meta = {}) => {
    if (LEVELS[level] > threshold || threshold === LEVELS.silent) return

    const entry = {
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      message,
      ...redact(meta),
      ...redact(context)
    }

    if (jsonOutput) {
      const stream = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log
      write(stream, JSON.stringify(entry))
      return
    }

    const details = Object.keys(meta).length || Object.keys(context).length
      ? ' ' + JSON.stringify(redact({ ...meta, ...context }))
      : ''
    const line = `[${entry.timestamp}] ${entry.level}: ${message}${details}`
    const stream = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log
    write(stream, line)
  }

  return {
    info: (message, meta) => log('info', message, meta),
    warn: (message, meta) => log('warn', message, meta),
    error: (message, meta) => log('error', message, meta),
    debug: (message, meta) => log('debug', message, meta),
    child: (childContext) => createLogger({ ...context, ...redact(childContext) })
  }
}

module.exports = createLogger()
