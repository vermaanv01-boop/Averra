const express = require('express')
const validate = require('../middleware/validate')
const protect = require('../middleware/protect')
const { searchUsersSchema, matchesSchema } = require('../validators/discovery.validator')
const { searchUsers, findMatches } = require('../controllers/discovery.controller')

const router = express.Router()

router.get('/users', validate(searchUsersSchema, 'query'), searchUsers)
router.get('/matches', protect, validate(matchesSchema, 'query'), findMatches)

module.exports = router
