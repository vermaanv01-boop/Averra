const messagingService = require('../services/messaging.service')
const asyncHandler = require('../utils/asyncHandler')
const { sendSuccess } = require('../utils/httpResponse')

const list = asyncHandler(async (req, res) => {
  sendSuccess(res, await messagingService.listConversations(req.user.id))
})

const getOne = asyncHandler(async (req, res) => {
  sendSuccess(res, await messagingService.getConversation(req.user.id, req.params.id))
})

const messages = asyncHandler(async (req, res) => {
  sendSuccess(res, await messagingService.listMessages(req.user.id, req.params.id, req.query))
})

const unreadCount = asyncHandler(async (req, res) => {
  sendSuccess(res, await messagingService.unreadCounts(req.user.id))
})

const createMessage = asyncHandler(async (req, res) => {
  const result = await messagingService.createMessage(
    req.user.id,
    req.params.id,
    req.body
  )
  sendSuccess(res, { message: result.message, created: result.created }, 201)
})

const markRead = asyncHandler(async (req, res) => {
  sendSuccess(res, await messagingService.markRead(req.user.id, req.params.id))
})

module.exports = { list, getOne, messages, unreadCount, createMessage, markRead }
