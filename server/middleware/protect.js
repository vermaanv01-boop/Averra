const jwt = require('jsonwebtoken')
const config = require('../config/env')
const User = require('../models/User')
const AppError = require('../utils/AppError')
const { isTokenRevoked } = require('../services/auth.service')

const protect = async (req, res, next) => {
  const [scheme, token] = (req.headers.authorization || '').split(' ')

  if (scheme !== 'Bearer' || !token) {
    return next(new AppError('Authentication required', 401))
  }

  try {
    const payload = jwt.verify(token, config.jwt.secret)

    if (!payload.sub || (await isTokenRevoked(payload.jti))) {
      throw new Error('Invalid token')
    }

    const user = await User.findById(payload.sub)

    if (!user) {
      throw new Error('User no longer exists')
    }
    if (user.accountStatus === 'suspended') {
      throw new AppError('Account is suspended', 403)
    }

    req.user = user
    req.token = { jti: payload.jti, exp: payload.exp, sub: payload.sub }
    next()
  } catch (error) {
    if (error instanceof AppError) {
      return next(error)
    }
    next(new AppError('Invalid or expired token', 401))
  }
}

module.exports = protect
