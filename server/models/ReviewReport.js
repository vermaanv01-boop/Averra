const { Schema, model } = require('mongoose')
const {
  REVIEW_REPORT_REASONS,
  REPORT_STATUSES,
  REPORT_ACTIONS
} = require('../utils/constants')

const reviewReportSchema = new Schema(
  {
    review: {
      type: Schema.Types.ObjectId,
      ref: 'Review',
      required: true,
      index: true
    },
    reporter: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    reason: {
      type: String,
      enum: REVIEW_REPORT_REASONS,
      required: true
    },
    details: {
      type: String,
      trim: true,
      maxlength: 500,
      default: ''
    }
  },
  { timestamps: true }
)

reviewReportSchema.index({ review: 1, reporter: 1 }, { unique: true })

const removeVersion = (document, returnedObject) => {
  returnedObject.id = returnedObject._id.toString()
  delete returnedObject._id
  delete returnedObject.__v
  return returnedObject
}

reviewReportSchema.set('toJSON', { transform: removeVersion })
reviewReportSchema.set('toObject', { transform: removeVersion })

const ReviewReport = model('ReviewReport', reviewReportSchema)

module.exports = ReviewReport
