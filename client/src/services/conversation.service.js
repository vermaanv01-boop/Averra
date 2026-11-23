import api from './api.js'

export const conversationService = {
  list: () => api.get('/conversations'),
  unreadCount: () => api.get('/conversations/unread-count'),
  getById: (id) => api.get(`/conversations/${encodeURIComponent(id)}`),
  messages: (id, params = {}) =>
    api.get(`/conversations/${encodeURIComponent(id)}/messages`, {
      params: { page: params.page || 1, limit: params.limit || 20 }
    }),
  send: (id, values) => api.post(`/conversations/${encodeURIComponent(id)}/messages`, values),
  markRead: (id) => api.patch(`/conversations/${encodeURIComponent(id)}/read`, {}),
  edit: (id, content) => api.patch(`/messages/${encodeURIComponent(id)}`, { content }),
  remove: (id) => api.delete(`/messages/${encodeURIComponent(id)}`, { data: {} })
}
