export const API_BASE_URL = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '')

export const API_PREFIX = '/api'

export const isApiConfigured = Boolean(API_BASE_URL)

export const APP_NAME = 'Averra'
