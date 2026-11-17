const { z } = require('zod')

const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[a-f\d]{24}$/i, 'Enter a valid identifier')

const idParamSchema = z
  .object({
    id: objectIdSchema
  })
  .strict()

module.exports = { objectIdSchema, idParamSchema }
