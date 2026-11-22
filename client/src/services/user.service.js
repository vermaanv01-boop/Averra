import api from './api.js'

export const userService = {
  getMe: () => api.get('/users/me'),
  updateMe: (values) => api.patch('/users/me', values),
  getByUsername: (username) => api.get(`/users/${encodeURIComponent(username)}`)
}
