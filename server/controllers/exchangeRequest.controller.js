const exchangeRequestService = require('../services/exchangeRequest.service')
const asyncHandler = require('../utils/asyncHandler')
const { sendSuccess } = require('../utils/httpResponse')

const create = asyncHandler(async (req, res) => {
  const request = await exchangeRequestService.create(req.user.id, req.body)
  sendSuccess(res, { request }, 201)
})

const list = asyncHandler(async (req, res) => {
  const result = await exchangeRequestService.list(req.user.id, req.query)
  sendSuccess(res, result)
})

const getOne = asyncHandler(async (req, res) => {
  const request = await exchangeRequestService.getByIdForUser(req.user.id, req.params.id)
  sendSuccess(res, { request })
})

const accept = asyncHandler(async (req, res) => {
  const request = await exchangeRequestService.transition(req.user.id, req.params.id, 'accept')
  sendSuccess(res, { request })
})

const reject = asyncHandler(async (req, res) => {
  const request = await exchangeRequestService.transition(req.user.id, req.params.id, 'reject')
  sendSuccess(res, { request })
})

const cancel = asyncHandler(async (req, res) => {
  const request = await exchangeRequestService.transition(req.user.id, req.params.id, 'cancel')
  sendSuccess(res, { request })
})

const complete = asyncHandler(async (req, res) => {
  const request = await exchangeRequestService.transition(req.user.id, req.params.id, 'complete')
  sendSuccess(res, { request })
})

module.exports = { create, list, getOne, accept, reject, cancel, complete }
