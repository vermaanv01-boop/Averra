import api from './api.js'

export const authService = {
  register: (values) => api.post('/auth/register', values),
  login: (values) => api.post('/auth/login', values),
  logout: () => api.post('/auth/logout', {})
}
