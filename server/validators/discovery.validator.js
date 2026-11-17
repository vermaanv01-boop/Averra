const { z } = require('zod')
const { SKILL_CATEGORIES, SKILL_TYPES, PROFICIENCY_LEVELS } = require('../utils/constants')

const searchUsersSchema = z
  .object({
    skill: z.string().trim().min(1).max(60).optional(),
    category: z.enum(SKILL_CATEGORIES).optional(),
    proficiency: z.enum(PROFICIENCY_LEVELS).optional(),
    type: z.enum(SKILL_TYPES).default('teach'),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
    sort: z.enum(['recent', 'name', 'username', 'skills']).default('recent')
  })
  .strict()

const matchesSchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
    category: z.enum(SKILL_CATEGORIES).optional()
  })
  .strict()

module.exports = { searchUsersSchema, matchesSchema }
