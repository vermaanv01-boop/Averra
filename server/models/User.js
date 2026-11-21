const { Schema, model } = require('mongoose')
const { USER_ROLES, ACCOUNT_STATUSES } = require('../utils/constants')

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const usernamePattern = /^[a-z0-9_]+$/
const urlPattern = /^https?:\/\/\S+$/i

const userSchema = new Schema(
  {
    role: {
      type: String,
      enum: USER_ROLES,
      default: 'user',
      required: true,
      index: true
    },
    accountStatus: {
      type: String,
      enum: ACCOUNT_STATUSES,
      default: 'active',
      required: true,
      index: true
    },
    suspension: {
      reason: {
        type: String,
        trim: true,
        maxlength: 500,
        default: ''
      },
      suspendedAt: {
        type: Date,
        default: null
      },
      suspendedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        default: null
      },
      restoredAt: {
        type: Date,
        default: null
      },
      restoredBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        default: null
      }
    },
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 80
    },
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      minlength: 3,
      maxlength: 30,
      match: usernamePattern
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      match: emailPattern
    },
    passwordHash: {
      type: String,
      required: true,
      select: false
    },
    profileImage: {
      type: String,
      default: '',
      trim: true,
      validate: {
        validator: (value) => !value || urlPattern.test(value),
        message: 'profileImage must be an http or https URL'
      }
    },
    bio: {
      type: String,
      default: '',
      trim: true,
      maxlength: 500
    },
    location: {
      type: String,
      default: '',
      trim: true,
      maxlength: 120
    },
    interests: {
      type: [String],
      default: [],
      validate: {
        validator: (values) =>
          values.length <= 20 &&
          values.every((value) => value.trim().length > 0 && value.length <= 50),
        message: 'interests must contain at most 20 non-empty values of 50 characters or fewer'
      }
    },
    notificationPreferences: {
      exchangeRequests: { type: Boolean, default: true },
      sessions: { type: Boolean, default: true },
      messages: { type: Boolean, default: true }
    },
    reputation: {
      totalReviews: { type: Number, default: 0, min: 0 },
      averageOverallRating: { type: Number, default: 0, min: 0, max: 5 },
      averageTeachingRating: { type: Number, default: 0, min: 0, max: 5 },
      averageLearningRating: { type: Number, default: 0, min: 0, max: 5 },
      ratingDistribution: { type: [Number], default: [0, 0, 0, 0, 0] },
      completedExchanges: { type: Number, default: 0, min: 0 },
      score: { type: Number, default: 0, min: 0, max: 5 },
      recalculatedAt: { type: Date, default: null }
    }
  },
  { timestamps: true }
)

const removePrivateFields = (document, returnedObject) => {
  returnedObject.id = returnedObject._id.toString()
  delete returnedObject._id
  delete returnedObject.passwordHash
  delete returnedObject.__v
  return returnedObject
}

userSchema.set('toJSON', { transform: removePrivateFields })
userSchema.set('toObject', { transform: removePrivateFields })

const User = model('User', userSchema)

module.exports = User
