const { Schema, model } = require('mongoose')
const { NOTIFICATION_TYPES, NOTIFICATION_ENTITY_TYPES } = require('../utils/constants')

const OUTBOX_STATUSES = ['pending', 'processing', 'delivered', 'dead']

const notificationOutboxSchema = new Schema(
  {
    eventId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200
    },
    recipientId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    actorId: {
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
      maxlength: 150
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500
    },
    relatedEntityId: {
      type: Schema.Types.ObjectId,
      default: null
    },
    relatedEntityType: {
      type: String,
      enum: [...NOTIFICATION_ENTITY_TYPES, null],
      default: null
    },
    status: {
      type: String,
      enum: OUTBOX_STATUSES,
      default: 'pending'
    },
    attempts: {
      type: Number,
      default: 0
    },
    nextAttemptAt: {
      type: Date,
      default: Date.now
    },
    claimedAt: {
      type: Date,
      default: null
    },
    deliveredAt: {
      type: Date,
      default: null
    },
    lastError: {
      type: String,
      default: null
    }
  },
  { timestamps: true, versionKey: false }
)

notificationOutboxSchema.index({ eventId: 1 }, { unique: true })
notificationOutboxSchema.index({ status: 1, nextAttemptAt: 1 })

const NotificationOutbox = model('NotificationOutbox', notificationOutboxSchema)

module.exports = NotificationOutbox
module.exports.OUTBOX_STATUSES = OUTBOX_STATUSES
