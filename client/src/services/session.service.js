import api from './api.js'

const LIST_KEYS = ['status', 'from', 'to', 'page', 'limit', 'sort']

function listParams(params = {}) {
  const clean = {}
  LIST_KEYS.forEach((key) => {
    const value = params[key]
    if (value === undefined || value === null || value === '') return
    clean[key] = key === 'page' || key === 'limit' ? Number(value) : value
  })
  return clean
}

export const sessionService = {
  list: (params = {}) => api.get('/sessions', { params: listParams(params) }),
  listUpcoming: (params = {}) => api.get('/sessions/upcoming', { params: listParams(params) }),
  listPendingInvitations: (params = {}) =>
    api.get('/sessions/pending-invitations', { params: listParams(params) }),
  listCompleted: (params = {}) => api.get('/sessions/completed', { params: listParams(params) }),
  listCancelled: (params = {}) => api.get('/sessions/cancelled', { params: listParams(params) }),
  getById: (id) => api.get(`/sessions/${encodeURIComponent(id)}`),
  create: (values) => api.post('/sessions', values),
  accept: (id) => api.patch(`/sessions/${encodeURIComponent(id)}/accept`, {}),
  decline: (id) => api.patch(`/sessions/${encodeURIComponent(id)}/decline`, {}),
  requestReschedule: (id, values) =>
    api.post(`/sessions/${encodeURIComponent(id)}/reschedule-requests`, values),
  acceptReschedule: (id, proposalId) =>
    api.patch(
      `/sessions/${encodeURIComponent(id)}/reschedule-requests/${encodeURIComponent(proposalId)}/accept`,
      {}
    ),
  rejectReschedule: (id, proposalId) =>
    api.patch(
      `/sessions/${encodeURIComponent(id)}/reschedule-requests/${encodeURIComponent(proposalId)}/reject`,
      {}
    ),
  cancel: (id, reason) => api.patch(`/sessions/${encodeURIComponent(id)}/cancel`, { reason }),
  complete: (id) => api.patch(`/sessions/${encodeURIComponent(id)}/complete`, {})
}
