const { Schema, model } = require('mongoose')
const { NOTIFICATION_TYPES, NOTIFICATION_ENTITY_TYPES } = require('../utils/constants')

const notificationSchema = new Schema(
  {
    recipient: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    actor: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    type: {
      type: String,
      enum: NOTIFICATION_TYPES,
      required: true
    },
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 150
    },
    message: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 500
    },
    relatedEntity: {
      type: Schema.Types.ObjectId,
      refPath: 'relatedEntityType',
      default: null
    },
    relatedEntityType: {
      type: String,
      enum: [...NOTIFICATION_ENTITY_TYPES, null],
      default: null
    },
    isRead: {
      type: Boolean,
      default: false
    },
    readAt: {
      type: Date,
      default: null
    },
    dedupeKey: {
      type: String,
      trim: true,
      maxlength: 200,
      default: undefined
    }
  },
  { timestamps: true }
)

notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 })
notificationSchema.index({ recipient: 1, type: 1, createdAt: -1 })
notificationSchema.index({ recipient: 1, isRead: 1, type: 1, createdAt: -1 })
notificationSchema.index({ recipient: 1, createdAt: -1 })
notificationSchema.index({ dedupeKey: 1 }, { unique: true, sparse: true })

notificationSchema.validate(
  (document) => Boolean(document.relatedEntity) === Boolean(document.relatedEntityType),
  'relatedEntity and relatedEntityType must be provided together'
)

const removeInternalFields = (document, returnedObject) => {
  returnedObject.id = returnedObject._id.toString()
  delete returnedObject._id
  delete returnedObject.__v
  delete returnedObject.dedupeKey
  return returnedObject
}

notificationSchema.set('toJSON', { transform: removeInternalFields })
notificationSchema.set('toObject', { transform: removeInternalFields })

const Notification = model('Notification', notificationSchema)

module.exports = Notification
