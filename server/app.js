const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const config = require('./config/env')
const requestContext = require('./middleware/requestContext')
const { rateLimiter, sensitiveLimiter } = require('./middleware/rateLimiter')
const healthRoutes = require('./routes/health.routes')
const authRoutes = require('./routes/auth.routes')
const userRoutes = require('./routes/user.routes')
const skillRoutes = require('./routes/skill.routes')
const discoveryRoutes = require('./routes/discovery.routes')
const exchangeRequestRoutes = require('./routes/exchangeRequest.routes')
const sessionRoutes = require('./routes/session.routes')
const conversationRoutes = require('./routes/conversation.routes')
const messageRoutes = require('./routes/message.routes')
const notificationRoutes = require('./routes/notification.routes')
const reviewRoutes = require('./routes/review.routes')
const adminRoutes = require('./routes/admin.routes')
const { notFound, errorHandler } = require('./middleware/errorHandler')

const app = express()

app.set('trust proxy', config.trustProxy)
app.use(requestContext)
app.use(helmet({
  referrerPolicy: { policy: 'no-referrer' },
  frameguard: { action: 'deny' },
  crossOriginResourcePolicy: { policy: 'same-origin' },
  hsts: config.isProduction ? { maxAge: 15552000, includeSubDomains: true } : false
}))
app.use(cors({
  origin: config.clientOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
  exposedHeaders: ['X-Request-Id', 'RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset']
}))
app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: true, limit: '1mb' }))

app.use('/', healthRoutes)

app.use(rateLimiter)
app.use('/api/auth', authRoutes)
app.use('/api/users', userRoutes)
app.use('/api/skills', skillRoutes)
app.use('/api/discovery', discoveryRoutes)
app.use('/api/exchange-requests', exchangeRequestRoutes)
app.use('/api/sessions', sessionRoutes)
app.use('/api/conversations', conversationRoutes)
app.use('/api/messages', messageRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/reviews', reviewRoutes)
app.use('/api/admin', sensitiveLimiter, adminRoutes)

app.use(notFound)
app.use(errorHandler)

module.exports = app
