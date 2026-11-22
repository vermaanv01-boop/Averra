import api from './api.js'

const LIST_KEYS = ['box', 'status', 'page', 'limit', 'sort']

function listParams(params = {}) {
  const clean = {}
  LIST_KEYS.forEach((key) => {
    const value = params[key]
    if (value === undefined || value === null || value === '') return
    clean[key] = key === 'page' || key === 'limit' ? Number(value) : value
  })
  return clean
}

export const exchangeRequestService = {
  create: (values) => api.post('/exchange-requests', values),
  list: (params = {}) => api.get('/exchange-requests', { params: listParams(params) })
}
