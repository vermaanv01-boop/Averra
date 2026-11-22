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

export function getConflictDetails(error) {
  if (!Array.isArray(error?.details)) return []
  return error.details
    .filter((detail) => detail && (detail.id || detail.title || detail.startAt))
    .map((detail) => ({
      id: detail.id || '',
      title: detail.title || 'Conflicting session',
      startAt: detail.startAt || '',
      endAt: detail.endAt || ''
    }))
}
