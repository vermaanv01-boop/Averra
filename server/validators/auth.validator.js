const { z } = require('zod')

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Enter a valid email address')

const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'Username must be at least 3 characters')
  .max(30, 'Username must be at most 30 characters')
  .regex(/^[a-z0-9_]+$/, 'Username may only contain lowercase letters, numbers and underscores')

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters')

const registerSchema = z
  .object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
    username: usernameSchema,
    email: emailSchema,
    password: passwordSchema
  })
  .strict()

const loginSchema = z
  .object({
    email: emailSchema,
    password: z.string().min(1, 'Password is required')
  })
  .strict()

module.exports = { registerSchema, loginSchema }
