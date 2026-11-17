const userService = require('../services/user.service')
const asyncHandler = require('../utils/asyncHandler')
const { sendSuccess } = require('../utils/httpResponse')

const getMe = asyncHandler(async (req, res) => {
  const user = await userService.getById(req.user.id)
  sendSuccess(res, { user })
})

const updateMe = asyncHandler(async (req, res) => {
  const user = await userService.updateProfile(req.user.id, req.body)
  sendSuccess(res, { user })
})

const getPublicProfile = asyncHandler(async (req, res) => {
  const user = await userService.getByUsername(req.params.username)
  sendSuccess(res, { user })
})

module.exports = { getMe, updateMe, getPublicProfile }
