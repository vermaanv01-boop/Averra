export class ApiError extends Error {
  constructor(message, options = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = options.status ?? null
    this.details = options.details ?? null
    this.requestId = options.requestId ?? null
    this.code = options.code ?? null
  }
}
