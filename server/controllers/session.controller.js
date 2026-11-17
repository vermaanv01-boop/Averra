const sessionService = require('../services/session.service')
const asyncHandler = require('../utils/asyncHandler')
const { sendSuccess } = require('../utils/httpResponse')

const create = asyncHandler(async (req, res) => {
  const session = await sessionService.create(req.user.id, req.body)
  sendSuccess(res, { session }, 201)
})

const getOne = asyncHandler(async (req, res) => {
  const session = await sessionService.getByIdForUser(req.user.id, req.params.id)
  sendSuccess(res, { session })
})

const listAll = asyncHandler(async (req, res) => {
  const result = await sessionService.list(req.user.id, req.query)
  sendSuccess(res, result)
})

const upcoming = asyncHandler(async (req, res) => {
  const result = await sessionService.listUpcoming(req.user.id, req.query)
  sendSuccess(res, result)
})

const pendingInvitations = asyncHandler(async (req, res) => {
  const result = await sessionService.listPendingInvitations(req.user.id, req.query)
  sendSuccess(res, result)
})

const completed = asyncHandler(async (req, res) => {
  const result = await sessionService.listCompleted(req.user.id, req.query)
  sendSuccess(res, result)
})

const cancelled = asyncHandler(async (req, res) => {
  const result = await sessionService.listCancelled(req.user.id, req.query)
  sendSuccess(res, result)
})

const accept = asyncHandler(async (req, res) => {
  const session = await sessionService.respondToInvitation(req.user.id, req.params.id, 'accept')
  sendSuccess(res, { session })
})

const decline = asyncHandler(async (req, res) => {
  const session = await sessionService.respondToInvitation(req.user.id, req.params.id, 'decline')
  sendSuccess(res, { session })
})

const requestReschedule = asyncHandler(async (req, res) => {
  const session = await sessionService.requestReschedule(req.user.id, req.params.id, req.body)
  sendSuccess(res, { session })
})

const acceptReschedule = asyncHandler(async (req, res) => {
  const session = await sessionService.respondToReschedule(
    req.user.id,
    req.params.id,
    req.params.proposalId,
    'accept'
  )
  sendSuccess(res, { session })
})

const rejectReschedule = asyncHandler(async (req, res) => {
  const session = await sessionService.respondToReschedule(
    req.user.id,
    req.params.id,
    req.params.proposalId,
    'reject'
  )
  sendSuccess(res, { session })
})

const cancel = asyncHandler(async (req, res) => {
  const session = await sessionService.cancel(req.user.id, req.params.id, req.body.reason)
  sendSuccess(res, { session })
})

const complete = asyncHandler(async (req, res) => {
  const session = await sessionService.complete(req.user.id, req.params.id)
  sendSuccess(res, { session })
})

module.exports = {
  create,
  getOne,
  listAll,
  upcoming,
  pendingInvitations,
  completed,
  cancelled,
  accept,
  decline,
  requestReschedule,
  acceptReschedule,
  rejectReschedule,
  cancel,
  complete
}
