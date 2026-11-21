const { randomUUID } = require('crypto')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const config = require('../config/env')
const User = require('../models/User')
const RevokedToken = require('../models/RevokedToken')
const AppError = require('../utils/AppError')

const issueToken = (userId) => {
  const jti = randomUUID()
  const token = jwt.sign({ sub: userId, jti }, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn
  })
  return { token, jti }
}

const toPublicUser = (user) => user.toObject()

const cleanupExpiredTokens = () =>
  RevokedToken.deleteMany({ expiresAt: { $lte: new Date() } })

const isTokenRevoked = async (jti) => {
  if (!jti) return false
  const record = await RevokedToken.exists({ jti, expiresAt: { $gt: new Date() } })
  return Boolean(record)
}

const register = async ({ name, username, email, password }) => {
  const existingUser = await User.findOne({ $or: [{ email }, { username }] }).lean()

  if (existingUser) {
    const message =
      existingUser.email === email
        ? 'Email is already registered'
        : 'Username is already taken'
    throw new AppError(message, 409)
  }

  const passwordHash = await bcrypt.hash(password, config.bcryptSaltRounds)

  try {
    const user = await User.create({
      name,
      username,
      email,
      passwordHash,
      role: 'user',
      accountStatus: 'active'
    })
    const { token } = issueToken(user.id)
    return { user: toPublicUser(user), token }
  } catch (error) {
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0]
      throw new AppError(`${field} is already registered`, 409)
    }
    throw error
  }
}

const login = async ({ email, password }) => {
  const user = await User.findOne({ email }).select('+passwordHash')

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new AppError('Invalid email or password', 401)
  }
  if (user.accountStatus === 'suspended') {
    throw new AppError('Account is suspended', 403)
  }

  const { token } = issueToken(user.id)
  return { user: toPublicUser(user), token }
}

const logout = async (token) => {
  if (!token?.jti || !token?.exp) return

  const expiresAt = new Date(token.exp * 1000)
  if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) return

  try {
    await RevokedToken.updateOne(
      { jti: token.jti },
      {
        $setOnInsert: {
          jti: token.jti,
          userId: token.sub || null,
          expiresAt,
          revokedAt: new Date()
        }
      },
      { upsert: true }
    )
  } catch (error) {
    if (error.code !== 11000) throw error
  }
}

module.exports = {
  register,
  login,
  logout,
  isTokenRevoked,
  cleanupExpiredTokens
}
