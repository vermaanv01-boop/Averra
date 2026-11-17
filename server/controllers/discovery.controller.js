const discoveryService = require('../services/discovery.service')
const asyncHandler = require('../utils/asyncHandler')
const { sendSuccess } = require('../utils/httpResponse')

const searchUsers = asyncHandler(async (req, res) => {
  const result = await discoveryService.searchUsers(req.query)
  sendSuccess(res, result)
})

const findMatches = asyncHandler(async (req, res) => {
  const result = await discoveryService.findMatches(req.user.id, req.query)
  sendSuccess(res, result)
})

module.exports = { searchUsers, findMatches }
