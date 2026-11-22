import api from './api.js'

export const exchangeRequestService = {
  create: (values) => api.post('/exchange-requests', values)
}
