const { Schema, model } = require('mongoose')
const { isValidTimeZone } = require('../utils/dateTime')
const {
  SESSION_STATUSES,
  MEETING_METHODS,
  RESCHEDULE_STATUSES
} = require('../utils/constants')

const reschedulingSchema = new Schema(
  {
    proposedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    scheduledDate: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/
    },
    startTime: {
      type: String,
      required: true,
      match: /^([01]\d|2[0-3]):[0-5]\d$/
    },
    duration: {
      type: Number,
      required: true,
      min: 15,
      max: 480
    },
    timezone: {
      type: String,
      required: true,
      trim: true,
      maxlength: 64,
      validate: {
        validator: isValidTimeZone,
        message: 'timezone must be a valid IANA timezone'
      }
    },
    startAt: {
      type: Date,
      required: true
    },
    endAt: {
      type: Date,
      required: true
    },
    status: {
      type: String,
      enum: RESCHEDULE_STATUSES,
      default: 'pending'
    },
    proposedAt: {
      type: Date,
      default: Date.now
    },
    resolvedAt: {
      type: Date,
      default: null
    },
    resolvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  },
  { timestamps: false }
)

const sessionSchema = new Schema(
  {
    exchangeRequest: {
      type: Schema.Types.ObjectId,
      ref: 'ExchangeRequest',
      required: true,
      index: true
    },
    proposedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    participants: {
      type: [
        {
          type: Schema.Types.ObjectId,
          ref: 'User',
          required: true
        }
      ],
      required: true,
      validate: {
        validator: (values) =>
          values.length === 2 && values[0].toString() !== values[1].toString(),
        message: 'participants must contain two distinct users'
      }
    },
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 120
    },
    description: {
      type: String,
      default: '',
      trim: true,
      maxlength: 1000
    },
    scheduledDate: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/
    },
    startTime: {
      type: String,
      required: true,
      match: /^([01]\d|2[0-3]):[0-5]\d$/
    },
    duration: {
      type: Number,
      required: true,
      min: 15,
      max: 480
    },
    timezone: {
      type: String,
      required: true,
      trim: true,
      maxlength: 64,
      validate: {
        validator: isValidTimeZone,
        message: 'timezone must be a valid IANA timezone'
      }
    },
    startAt: {
      type: Date,
      required: true
    },
    endAt: {
      type: Date,
      required: true,
      validate: {
        validator: function (value) {
          return value > this.startAt
        },
        message: 'endAt must be after startAt'
      }
    },
    meetingMethod: {
      type: String,
      required: true,
      enum: MEETING_METHODS
    },
    meetingLink: {
      type: String,
      default: '',
      trim: true
    },
    location: {
      type: String,
      default: '',
      trim: true
    },
    status: {
      type: String,
      enum: SESSION_STATUSES,
      default: 'pending'
    },
    cancellationReason: {
      type: String,
      default: '',
      trim: true,
      maxlength: 300
    },
    cancelledAt: {
      type: Date,
      default: null
    },
    reschedulingHistory: {
      type: [reschedulingSchema],
      default: []
    },
    completedAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
)

sessionSchema.index({ participants: 1, startAt: 1 })
sessionSchema.index({ exchangeRequest: 1, status: 1 })
sessionSchema.index({ status: 1, startAt: 1 })

const removeVersion = (document, returnedObject) => {
  returnedObject.id = returnedObject._id.toString()
  delete returnedObject._id
  delete returnedObject.__v
  return returnedObject
}

sessionSchema.set('toJSON', { transform: removeVersion })
sessionSchema.set('toObject', { transform: removeVersion })

const Session = model('Session', sessionSchema)

module.exports = Session
