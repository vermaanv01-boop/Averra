const User = require('../models/User')
const AppError = require('../utils/AppError')

const toPublicUser = (user) => user.toObject()

const getById = async (userId) => {
  const user = await User.findById(userId)

  if (!user) {
    throw new AppError('User not found', 404)
  }

  return toPublicUser(user)
}

const getByUsername = async (username) => {
  const user = await User.findOne({ username })

  if (!user) {
    throw new AppError('User not found', 404)
  }

  return toPublicUser(user)
}

const updateProfile = async (userId, updates) => {
  const changes = { ...updates }

  if (changes.username) {
    const taken = await User.exists({ username: changes.username, _id: { $ne: userId } })
    if (taken) {
      throw new AppError('Username is already taken', 409)
    }
  }

  if (changes.email) {
    const taken = await User.exists({ email: changes.email, _id: { $ne: userId } })
    if (taken) {
      throw new AppError('Email is already registered', 409)
    }
  }

  if (changes.interests) {
    changes.interests = changes.interests.map((interest) => interest.trim())
  }

  try {
    const user = await User.findByIdAndUpdate(userId, { $set: changes }, {
      new: true,
      runValidators: true
    })

    if (!user) {
      throw new AppError('User not found', 404)
    }

    return toPublicUser(user)
  } catch (error) {
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0]
      throw new AppError(`${field} is already registered`, 409)
    }
    throw error
  }
}

module.exports = { getById, getByUsername, updateProfile }
