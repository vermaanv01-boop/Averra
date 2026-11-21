const { Schema, model } = require('mongoose')
const { AUDIT_ACTIONS, AUDIT_TARGET_TYPES } = require('../utils/constants')

const targetSchema = new Schema(
  {
    type: {
      type: String,
      enum: AUDIT_TARGET_TYPES,
      required: true
    },
    id: {
      type: Schema.Types.ObjectId,
      required: true
    }
  },
  { _id: false }
)

const auditLogSchema = new Schema(
  {
    actor: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    action: {
      type: String,
      enum: AUDIT_ACTIONS,
      required: true
    },
    target: {
      type: targetSchema,
      required: true
    },
    reason: {
      type: String,
      trim: true,
      maxlength: 500,
      default: ''
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: () => ({})
    }
  },
  { timestamps: true, minimize: false }
)

auditLogSchema.index({ createdAt: -1 })
auditLogSchema.index({ action: 1, createdAt: -1 })
auditLogSchema.index({ 'target.type': 1, 'target.id': 1, createdAt: -1 })

const rejectMutation = (next) => next(new Error('Audit logs are immutable'))

auditLogSchema.pre(
  [
    'findOneAndUpdate',
    'updateOne',
    'updateMany',
    'findOneAndDelete',
    'deleteOne',
    'deleteMany'
  ],
  rejectMutation
)

auditLogSchema.pre('save', function (next) {
  if (!this.isNew) {
    return next(new Error('Audit logs are immutable'))
  }
  next()
})

const removeVersion = (document, returnedObject) => {
  returnedObject.id = returnedObject._id.toString()
  delete returnedObject._id
  delete returnedObject.__v
  return returnedObject
}

auditLogSchema.set('toJSON', { transform: removeVersion })
auditLogSchema.set('toObject', { transform: removeVersion })

const AuditLog = model('AuditLog', auditLogSchema)

module.exports = AuditLog
