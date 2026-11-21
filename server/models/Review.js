const { Schema, model } = require('mongoose')
const { RATING_VALUES, REVIEW_MODERATION_STATUSES } = require('../utils/constants')

const ratingField = () => ({
  type: Number,
  required: true,
  min: RATING_VALUES[0],
  max: RATING_VALUES[RATING_VALUES.length - 1],
  validate: {
    validator: Number.isInteger,
    message: 'Rating must be a whole number from 1 to 5'
  }
})

const moderationHistorySchema = new Schema(
  {
    status: {
      type: String,
      enum: REVIEW_MODERATION_STATUSES,
      required: true
    },
    reason: {
      type: String,
      trim: true,
      maxlength: 120,
      default: ''
    },
    moderatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: false }
)

const reviewSchema = new Schema(
  {
    exchangeRequest: {
      type: Schema.Types.ObjectId,
      ref: 'ExchangeRequest',
      required: true,
      index: true
    },
    reviewer: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    reviewee: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    overallRating: ratingField,
    teachingRating: ratingField,
    learningRating: ratingField,
    comment: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 2000
    },
    moderationStatus: {
      type: String,
      enum: REVIEW_MODERATION_STATUSES,
      default: 'visible'
    },
    reportCount: {
      type: Number,
      default: 0,
      min: 0
    },
    moderationHistory: {
      type: [moderationHistorySchema],
      default: []
    }
  },
  { timestamps: true }
)

reviewSchema.index({ exchangeRequest: 1, reviewer: 1 }, { unique: true })
reviewSchema.index({ reviewee: 1, moderationStatus: 1, createdAt: -1 })
reviewSchema.index({ exchangeRequest: 1, moderationStatus: 1 })
reviewSchema.index({ moderationStatus: 1, reportCount: -1, createdAt: -1 })

reviewSchema.pre('validate', function (next) {
  if (this.reviewer && this.reviewee && this.reviewer.toString() === this.reviewee.toString()) {
    this.invalidate('reviewee', 'A user cannot review themselves')
  }
  next()
})

const removeVersion = (document, returnedObject) => {
  returnedObject.id = returnedObject._id.toString()
  delete returnedObject._id
  delete returnedObject.__v
  return returnedObject
}

reviewSchema.set('toJSON', { transform: removeVersion })
reviewSchema.set('toObject', { transform: removeVersion })

const Review = model('Review', reviewSchema)

module.exports = Review
