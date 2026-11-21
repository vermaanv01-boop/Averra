const adminService = require('../services/admin.service')
const asyncHandler = require('../utils/asyncHandler')

const requireAdmin = asyncHandler(async (req, res, next) => {
  req.admin = await adminService.assertAdmin(req.user.id)
  next()
})

module.exports = requireAdmin
