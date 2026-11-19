const messagingService = require('../services/messaging.service')
const asyncHandler = require('../utils/asyncHandler')
const { sendSuccess } = require('../utils/httpResponse')

const update = asyncHandler(async (req, res) => {
  sendSuccess(res, await messagingService.editMessage(req.user.id, req.params.id, req.body.content))
})

const remove = asyncHandler(async (req, res) => {
  sendSuccess(res, await messagingService.deleteMessage(req.user.id, req.params.id))
})

module.exports = { update, remove }
