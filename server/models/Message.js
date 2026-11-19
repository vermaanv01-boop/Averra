const { Schema, model } = require('mongoose')
const { MESSAGE_TYPES } = require('../utils/constants')

const messageSchema = new Schema(
  {
    conversation: {
      type: Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true
    },
    sender: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    content: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 4000
    },
    messageType: {
      type: String,
      enum: MESSAGE_TYPES,
      default: 'text'
    },
    deliveredTo: {
      type: [{ type: Schema.Types.ObjectId, ref: 'User' }],
      default: []
    },
    readBy: {
      type: [{ type: Schema.Types.ObjectId, ref: 'User' }],
      default: []
    },
    clientMessageId: {
      type: String,
      trim: true,
      maxlength: 100,
      default: undefined
    },
    editedAt: {
      type: Date,
      default: null
    },
    deletedAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
)

messageSchema.index({ conversation: 1, createdAt: -1, _id: -1 })
messageSchema.index({ conversation: 1, createdAt: 1, _id: 1 })
messageSchema.index(
  { conversation: 1, sender: 1, clientMessageId: 1 },
  { unique: true, partialFilterExpression: { clientMessageId: { $exists: true } } }
)

const removeVersion = (document, returnedObject) => {
  returnedObject.id = returnedObject._id.toString()
  delete returnedObject._id
  delete returnedObject.__v
  return returnedObject
}

messageSchema.set('toJSON', { transform: removeVersion })
messageSchema.set('toObject', { transform: removeVersion })

const Message = model('Message', messageSchema)

module.exports = Message
