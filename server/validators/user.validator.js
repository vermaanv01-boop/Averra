const { z } = require('zod')

const nameSchema = z.string().trim().min(2, 'Name must be at least 2 characters').max(80)

const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(30)
  .regex(/^[a-z0-9_]+$/)

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Enter a valid email address')

const updateProfileSchema = z
  .object({
    name: nameSchema.optional(),
    username: usernameSchema.optional(),
    email: emailSchema.optional(),
    profileImage: z
      .union([z.literal(''), z.string().trim().url('profileImage must be a valid URL')])
      .optional(),
    bio: z.string().trim().max(500).optional(),
    location: z.string().trim().max(120).optional(),
    interests: z
      .array(z.string().trim().min(1).max(50))
      .max(20, 'interests may contain at most 20 values')
      .optional()
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one profile field is required'
  })

const usernameParamSchema = z
  .object({
    username: usernameSchema
  })
  .strict()

module.exports = { updateProfileSchema, usernameParamSchema }
