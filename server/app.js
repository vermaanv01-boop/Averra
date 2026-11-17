const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const config = require('./config/env')
const { rateLimiter } = require('./middleware/rateLimiter')
const healthRoutes = require('./routes/health.routes')
const authRoutes = require('./routes/auth.routes')
const userRoutes = require('./routes/user.routes')
const skillRoutes = require('./routes/skill.routes')
const discoveryRoutes = require('./routes/discovery.routes')
const exchangeRequestRoutes = require('./routes/exchangeRequest.routes')
const sessionRoutes = require('./routes/session.routes')
const { notFound, errorHandler } = require('./middleware/errorHandler')

const app = express()

app.use(helmet())
app.use(cors({ origin: config.clientOrigin, credentials: true }))
app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: true }))
app.use(rateLimiter)

app.use('/', healthRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/users', userRoutes)
app.use('/api/skills', skillRoutes)
app.use('/api/discovery', discoveryRoutes)
app.use('/api/exchange-requests', exchangeRequestRoutes)

app.use(notFound)
app.use(errorHandler)

module.exports = app
