import api from './api.js'

export const skillService = {
  list: () => api.get('/skills'),
  create: (values) => api.post('/skills', values),
  update: (id, values) => api.patch(`/skills/${encodeURIComponent(id)}`, values),
  remove: (id) => api.delete(`/skills/${encodeURIComponent(id)}`)
}
