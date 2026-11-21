const { Schema, model } = require('mongoose')

const revokedTokenSchema = new Schema(
  {
    jti: {
      type: String,
      required: true,
      trim: true
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    expiresAt: {
      type: Date,
      required: true
    },
    revokedAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true, versionKey: false }
)

revokedTokenSchema.index({ jti: 1 }, { unique: true })
revokedTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

const RevokedToken = model('RevokedToken', revokedTokenSchema)

module.exports = RevokedToken
