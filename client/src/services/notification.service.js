import api from './api.js'

const LIST_KEYS = ['page', 'limit', 'isRead', 'type']

function listParams(params = {}) {
  const clean = {}
  LIST_KEYS.forEach((key) => {
    const value = params[key]
    if (value === undefined || value === null || value === '') return
    clean[key] = key === 'page' || key === 'limit' ? Number(value) : value
    if (key === 'isRead') clean[key] = value ? 'true' : 'false'
  })
  return clean
}

export const notificationService = {
  list: (params = {}) => api.get('/notifications', { params: listParams(params) }),
  unreadCount: () => api.get('/notifications/unread-count'),
  preferences: () => api.get('/notifications/preferences'),
  updatePreferences: (values) => api.patch('/notifications/preferences', values),
  markRead: (id) => api.patch(`/notifications/${encodeURIComponent(id)}/read`, {}),
  markAllRead: () => api.patch('/notifications/read-all', {}),
  remove: (id) => api.delete(`/notifications/${encodeURIComponent(id)}`)
}
