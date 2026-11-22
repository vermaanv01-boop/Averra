const AppError = require('../utils/AppError')

const formatIssues = (error) =>
  error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message
  }))

const validate = (schema, source = 'body') => (req, res, next) => {
  const result = schema.safeParse(req[source] || {})

  if (!result.success) {
    return next(new AppError('Invalid request data', 400, formatIssues(result.error)))
  }

  req[source] = result.data
  next()
}

module.exports = validate
