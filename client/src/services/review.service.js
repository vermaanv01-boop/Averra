import api from './api.js'

const LIST_KEYS = ['page', 'limit', 'sort']

function listParams(params = {}) {
  const clean = {}
  LIST_KEYS.forEach((key) => {
    const value = params[key]
    if (value === undefined || value === null || value === '') return
    clean[key] = key === 'page' || key === 'limit' ? Number(value) : value
  })
  return clean
}

export const reviewService = {
  create: (values) => api.post('/reviews', values),
  listForUser: (userId, params = {}) =>
    api.get(`/reviews/user/${encodeURIComponent(userId)}`, { params: listParams(params) }),
  listForExchange: (exchangeRequestId, params = {}) =>
    api.get(`/reviews/exchange/${encodeURIComponent(exchangeRequestId)}`, { params: listParams(params) }),
  getById: (id) => api.get(`/reviews/${encodeURIComponent(id)}`)
}
