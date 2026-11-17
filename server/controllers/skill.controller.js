const skillService = require('../services/skill.service')
const asyncHandler = require('../utils/asyncHandler')
const { sendSuccess } = require('../utils/httpResponse')

const list = asyncHandler(async (req, res) => {
  const skills = await skillService.listByUser(req.user.id)
  sendSuccess(res, { skills })
})

const create = asyncHandler(async (req, res) => {
  const skill = await skillService.create(req.user.id, req.body)
  sendSuccess(res, { skill }, 201)
})

const update = asyncHandler(async (req, res) => {
  const skill = await skillService.update(req.user.id, req.params.id, req.body)
  sendSuccess(res, { skill })
})

const remove = asyncHandler(async (req, res) => {
  const skill = await skillService.remove(req.user.id, req.params.id)
  sendSuccess(res, { skill })
})

module.exports = { list, create, update, remove }
