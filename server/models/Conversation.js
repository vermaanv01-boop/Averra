const { Schema, model } = require('mongoose')

const conversationSchema = new Schema(
  {
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
    exchangeRequest: {
      type: Schema.Types.ObjectId,
      ref: 'ExchangeRequest',
      required: true,
      unique: true
    },
    lastMessage: {
      type: Schema.Types.ObjectId,
      ref: 'Message',
      default: null
    },
    lastMessageAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
)

conversationSchema.index({ exchangeRequest: 1 }, { unique: true })
conversationSchema.index({ participants: 1, lastMessageAt: -1 })
conversationSchema.index({ lastMessageAt: -1 })

const removeVersion = (document, returnedObject) => {
  returnedObject.id = returnedObject._id.toString()
  delete returnedObject._id
  delete returnedObject.__v
  return returnedObject
}

conversationSchema.set('toJSON', { transform: removeVersion })
conversationSchema.set('toObject', { transform: removeVersion })

const Conversation = model('Conversation', conversationSchema)

module.exports = Conversation
