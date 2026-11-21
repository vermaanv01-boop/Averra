const notificationService = require('../services/notification.service')
const asyncHandler = require('../utils/asyncHandler')
const { sendSuccess } = require('../utils/httpResponse')

const list = asyncHandler(async (req, res) => {
  sendSuccess(res, await notificationService.list(req.user.id, req.query))
})

const unreadCount = asyncHandler(async (req, res) => {
  sendSuccess(res, await notificationService.unreadCount(req.user.id))
})

const markRead = asyncHandler(async (req, res) => {
  sendSuccess(res, await notificationService.markRead(req.user.id, req.params.id))
})

const markAllRead = asyncHandler(async (req, res) => {
  sendSuccess(res, await notificationService.markAllRead(req.user.id))
})

const remove = asyncHandler(async (req, res) => {
  sendSuccess(res, await notificationService.remove(req.user.id, req.params.id))
})

const getPreferences = asyncHandler(async (req, res) => {
  sendSuccess(res, await notificationService.getPreferences(req.user.id))
})

const updatePreferences = asyncHandler(async (req, res) => {
  sendSuccess(res, await notificationService.updatePreferences(req.user.id, req.body))
})

module.exports = {
  list,
  unreadCount,
  markRead,
  markAllRead,
  remove,
  getPreferences,
  updatePreferences
}
