const express = require('express')
const validate = require('../middleware/validate')
const protect = require('../middleware/protect')
const { idParamSchema } = require('../validators/common.validator')
const { createSkillSchema, updateSkillSchema } = require('../validators/skill.validator')
const { list, create, update, remove } = require('../controllers/skill.controller')

const router = express.Router()

router.use(protect)

router.get('/', list)
router.post('/', validate(createSkillSchema), create)
router.patch('/:id', validate(idParamSchema, 'params'), validate(updateSkillSchema), update)
router.delete('/:id', validate(idParamSchema, 'params'), remove)

module.exports = router
