const { Schema, model } = require('mongoose')
const { REQUEST_STATUSES } = require('../utils/constants')

const exchangeRequestSchema = new Schema(
  {
    sender: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    recipient: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    offeredSkill: {
      type: Schema.Types.ObjectId,
      ref: 'Skill',
      required: true
    },
    requestedSkill: {
      type: Schema.Types.ObjectId,
      ref: 'Skill',
      required: true
    },
    status: {
      type: String,
      enum: REQUEST_STATUSES,
      default: 'pending'
    },
    respondedAt: {
      type: Date,
      default: null
    },
    completedAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
)

exchangeRequestSchema.index({ recipient: 1, status: 1, createdAt: -1 })
exchangeRequestSchema.index({ sender: 1, status: 1, createdAt: -1 })
exchangeRequestSchema.index(
  { sender: 1, recipient: 1, offeredSkill: 1, requestedSkill: 1 },
  { unique: true, partialFilterExpression: { status: 'pending' } }
)

const removeVersion = (document, returnedObject) => {
  delete returnedObject.__v
  return returnedObject
}

exchangeRequestSchema.set('toJSON', { transform: removeVersion })
exchangeRequestSchema.set('toObject', { transform: removeVersion })

const ExchangeRequest = model('ExchangeRequest', exchangeRequestSchema)

module.exports = ExchangeRequest
