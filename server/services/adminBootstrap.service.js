const bcrypt = require('bcrypt')
const config = require('../config/env')
const User = require('../models/User')
const AppError = require('../utils/AppError')
const { registerSchema } = require('../validators/auth.validator')
const auditService = require('./audit.service')

const bootstrapAdmin = async (payload) => {
  const parsed = registerSchema.safeParse(payload)
  if (!parsed.success) {
    throw new AppError('Invalid administrator credentials', 400)
  }

  const { name, username, email, password } = parsed.data

  if (await User.exists({ role: 'admin' })) {
    throw new AppError('An administrator already exists; bootstrap is disabled', 409)
  }

  const [byEmail, byUsername] = await Promise.all([
    User.findOne({ email }).lean(),
    User.findOne({ username }).lean()
  ])

  if (
    byEmail &&
    byUsername &&
    byEmail._id.toString() !== byUsername._id.toString()
  ) {
    throw new AppError('Administrator email and username belong to different users', 409)
  }

  const existing = byEmail || byUsername
  if (existing?.role === 'admin') {
    throw new AppError('An administrator already exists; bootstrap is disabled', 409)
  }
  if (existing?.accountStatus === 'suspended') {
    throw new AppError('A suspended account cannot be promoted to administrator', 409)
  }

  let admin
  let mode

  if (existing) {
    admin = await User.findByIdAndUpdate(
      existing._id,
      { $set: { role: 'admin' } },
      { new: true, runValidators: true }
    )
    mode = 'promoted'
  } else {
    const passwordHash = await bcrypt.hash(password, config.bcryptSaltRounds)
    try {
      admin = await User.create({ name, username, email, passwordHash, role: 'admin' })
    } catch (error) {
      if (error.code === 11000) {
        throw new AppError('Administrator credentials conflict with an existing user', 409)
      }
      throw error
    }
    mode = 'created'
  }

  await auditService.record({
    actorId: admin.id,
    action: 'admin_bootstrap',
    targetType: 'Admin',
    targetId: admin.id,
    reason: 'Initial administrator bootstrap',
    metadata: { mode }
  })

  return { user: admin.toObject(), mode }
}

module.exports = { bootstrapAdmin }
