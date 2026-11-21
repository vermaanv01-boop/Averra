const adminService = require('../services/admin.service')
const asyncHandler = require('../utils/asyncHandler')
const { sendSuccess } = require('../utils/httpResponse')

const listUsers = asyncHandler(async (req, res) => {
  sendSuccess(res, await adminService.listUsers(req.user.id, req.query))
})

const getUser = asyncHandler(async (req, res) => {
  sendSuccess(res, {
    user: await adminService.getUser(req.user.id, req.params.id)
  })
})

const suspendUser = asyncHandler(async (req, res) => {
  sendSuccess(res, {
    user: await adminService.suspendUser(req.user.id, req.params.id, req.body)
  })
})

const restoreUser = asyncHandler(async (req, res) => {
  sendSuccess(res, {
    user: await adminService.restoreUser(req.user.id, req.params.id, req.body)
  })
})

const listModeration = asyncHandler(async (req, res) => {
  sendSuccess(res, await adminService.listModeration(req.user.id, req.query))
})

const getReview = asyncHandler(async (req, res) => {
  sendSuccess(res, {
    review: await adminService.getReview(req.user.id, req.params.id)
  })
})

const moderateReview = asyncHandler(async (req, res) => {
  sendSuccess(res, {
    review: await adminService.moderateReview(req.user.id, req.params.id, req.body)
  })
})

const listReports = asyncHandler(async (req, res) => {
  sendSuccess(res, await adminService.listReports(req.user.id, req.query))
})

const getReport = asyncHandler(async (req, res) => {
  sendSuccess(res, {
    report: await adminService.getReport(req.user.id, req.params.id)
  })
})

const decideReport = asyncHandler(async (req, res) => {
  sendSuccess(res, {
    report: await adminService.decideReport(req.user.id, req.params.id, req.body)
  })
})

const statistics = asyncHandler(async (req, res) => {
  sendSuccess(res, await adminService.statistics(req.user.id))
})

const listAuditLogs = asyncHandler(async (req, res) => {
  sendSuccess(res, await adminService.listAuditLogs(req.user.id, req.query))
})

module.exports = {
  listUsers,
  getUser,
  suspendUser,
  restoreUser,
  listModeration,
  getReview,
  moderateReview,
  listReports,
  getReport,
  decideReport,
  statistics,
  listAuditLogs
}
