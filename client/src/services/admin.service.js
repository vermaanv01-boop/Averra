import api from './api.js'

function listParams(params = {}, keys = []) {
  const clean = {}
  keys.forEach((key) => {
    const value = params[key]
    if (value === undefined || value === null || value === '') return
    clean[key] = key === 'page' || key === 'limit' ? Number(value) : value
  })
  return clean
}

export const adminService = {
  statistics: () => api.get('/admin/statistics'),

  listUsers: (params = {}) =>
    api.get('/admin/users', {
      params: listParams(params, ['page', 'limit', 'search', 'role', 'status', 'sort'])
    }),
  getUser: (id) => api.get(`/admin/users/${encodeURIComponent(id)}`),
  suspendUser: (id, reason) => api.patch(`/admin/users/${encodeURIComponent(id)}/suspend`, { reason }),
  restoreUser: (id, reason = '') => api.patch(`/admin/users/${encodeURIComponent(id)}/restore`, { reason }),

  listReviews: (params = {}) =>
    api.get('/admin/reviews', { params: listParams(params, ['page', 'limit', 'status']) }),
  getReview: (id) => api.get(`/admin/reviews/${encodeURIComponent(id)}`),
  moderateReview: (id, status, reason = '') =>
    api.patch(`/admin/reviews/${encodeURIComponent(id)}/moderate`, { status, reason }),

  listReports: (params = {}) =>
    api.get('/admin/reports', {
      params: listParams(params, ['page', 'limit', 'status', 'reason'])
    }),
  getReport: (id) => api.get(`/admin/reports/${encodeURIComponent(id)}`),
  decideReport: (id, action, reason) =>
    api.patch(`/admin/reports/${encodeURIComponent(id)}`, { action, reason }),

  listAuditLogs: (params = {}) =>
    api.get('/admin/audit-logs', {
      params: listParams(params, ['page', 'limit', 'action', 'targetType'])
    })
}
