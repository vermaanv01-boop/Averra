const reviewService = require('../services/review.service')
const asyncHandler = require('../utils/asyncHandler')
const { sendSuccess } = require('../utils/httpResponse')

const create = asyncHandler(async (req, res) => {
  sendSuccess(res, await reviewService.create(req.user.id, req.body), 201)
})

const listForUser = asyncHandler(async (req, res) => {
  sendSuccess(res, await reviewService.listForUser(req.params.userId, req.query))
})

const listForExchange = asyncHandler(async (req, res) => {
  sendSuccess(
    res,
    await reviewService.listForExchange(req.params.exchangeRequestId, req.query)
  )
})

const getOne = asyncHandler(async (req, res) => {
  sendSuccess(res, await reviewService.getById(req.params.id))
})

const update = asyncHandler(async (req, res) => {
  sendSuccess(res, await reviewService.update(req.user.id, req.params.id, req.body))
})

const remove = asyncHandler(async (req, res) => {
  sendSuccess(res, await reviewService.remove(req.user.id, req.params.id))
})

const report = asyncHandler(async (req, res) => {
  sendSuccess(res, await reviewService.report(req.user.id, req.params.id, req.body))
})

module.exports = {
  create,
  listForUser,
  listForExchange,
  getOne,
  update,
  remove,
  report
}
