const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const config = require('./config/env')
const rateLimiter = require('./middleware/rateLimiter')
const healthRoutes = require('./routes/health.routes')
const { notFound, errorHandler } = require('./middleware/errorHandler')

const app = express()

app.use(helmet())
app.use(cors({ origin: config.clientOrigin, credentials: true }))
app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: true }))
app.use(rateLimiter)

app.use('/', healthRoutes)

app.use(notFound)
app.use(errorHandler)

module.exports = app
