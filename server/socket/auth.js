const jwt = require('jsonwebtoken')
const config = require('../config/env')
const User = require('../models/User')
const Conversation = require('../models/Conversation')
const { isTokenRevoked } = require('../services/auth.service')

const extractToken = (handshake) => {
  const authToken = handshake.auth?.token
  if (authToken) return authToken

  const [scheme, token] = (handshake.headers?.authorization || '').split(' ')
  return scheme === 'Bearer' ? token : null
}

const authenticateSocket = async (socket, next) => {
  try {
    const token = extractToken(socket.handshake)
    if (!token) {
      throw new Error('Unauthorized')
    }

    const payload = jwt.verify(token, config.jwt.secret)
    if (!payload.sub || isTokenRevoked(payload.jti)) {
      throw new Error('Unauthorized')
    }

    const user = await User.findById(payload.sub)
      .select('name username profileImage accountStatus')
      .lean()
    if (!user || user.accountStatus === 'suspended') {
      throw new Error('Unauthorized')
    }

    const conversations = await Conversation.find({ participants: user._id })
      .select('_id')
      .lean()

    socket.data.user = {
      id: user._id.toString(),
      name: user.name,
      username: user.username,
      profileImage: user.profileImage
    }
    socket.data.conversationIds = conversations.map((conversation) => conversation._id.toString())
    next()
  } catch {
    next(new Error('Unauthorized'))
  }
}

module.exports = authenticateSocket
