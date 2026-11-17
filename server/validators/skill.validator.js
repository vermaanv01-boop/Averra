const { z } = require('zod')
const { SKILL_CATEGORIES, SKILL_TYPES, PROFICIENCY_LEVELS } = require('../utils/constants')

const nameSchema = z.string().trim().min(2).max(60)

const createSkillSchema = z
  .object({
    name: nameSchema,
    category: z.enum(SKILL_CATEGORIES),
    type: z.enum(SKILL_TYPES),
    proficiency: z.enum(PROFICIENCY_LEVELS),
    experience: z.string().trim().max(1000).optional().default('')
  })
  .strict()

const updateSkillSchema = z
  .object({
    name: nameSchema.optional(),
    category: z.enum(SKILL_CATEGORIES).optional(),
    type: z.enum(SKILL_TYPES).optional(),
    proficiency: z.enum(PROFICIENCY_LEVELS).optional(),
    experience: z.string().trim().max(1000).optional()
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one skill field is required'
  })

module.exports = { createSkillSchema, updateSkillSchema }
