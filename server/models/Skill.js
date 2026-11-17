const { Schema, model } = require('mongoose')
const {
  SKILL_TYPES,
  SKILL_CATEGORIES,
  PROFICIENCY_LEVELS
} = require('../utils/constants')

const skillSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 60
    },
    normalizedName: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },
    category: {
      type: String,
      required: true,
      enum: SKILL_CATEGORIES
    },
    type: {
      type: String,
      required: true,
      enum: SKILL_TYPES
    },
    proficiency: {
      type: String,
      required: true,
      enum: PROFICIENCY_LEVELS
    },
    experience: {
      type: String,
      default: '',
      trim: true,
      maxlength: 1000
    }
  },
  { timestamps: true }
)

skillSchema.index({ user: 1, normalizedName: 1, type: 1 }, { unique: true })
skillSchema.index({ normalizedName: 1, category: 1, type: 1, proficiency: 1 })

const removeVersion = (document, returnedObject) => {
  returnedObject.id = returnedObject._id.toString()
  delete returnedObject._id
  delete returnedObject.__v
  return returnedObject
}

skillSchema.set('toJSON', { transform: removeVersion })
skillSchema.set('toObject', { transform: removeVersion })

const Skill = model('Skill', skillSchema)

module.exports = Skill
