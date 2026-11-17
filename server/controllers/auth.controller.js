const authService = require('../services/auth.service')
const asyncHandler = require('../utils/asyncHandler')
const { sendSuccess } = require('../utils/httpResponse')

const register = asyncHandler(async (req, res) => {
  const result = await authService.register(req.body)
  sendSuccess(res, { user: result.user, token: result.token }, 201)
})

const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body)
  sendSuccess(res, { user: result.user, token: result.token })
})

const logout = asyncHandler(async (req, res) => {
  authService.logout(req.token)
  sendSuccess(res, { message: 'Logged out successfully' })
})

module.exports = { register, login, logout }
