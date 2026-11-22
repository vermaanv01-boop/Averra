import axios from 'axios'
import { getStoredToken } from '../utils/authStorage.js'
import { API_BASE_URL, API_PREFIX, isApiConfigured } from '../utils/config.js'
import { ApiError } from '../utils/errors.js'

const unauthorizedListeners = new Set()
const PUBLIC_AUTH_ENDPOINT = /^\/auth\/(login|register)$/

function createRequestId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function normalizeError(error) {
  if (error instanceof ApiError) return error

  const response = error?.response
  const data = response?.data
  const status = response?.status ?? null
  const requestId = data?.requestId || response?.headers?.['x-request-id'] || null

  if (data && typeof data === 'object') {
    return new ApiError(data.message || 'Request failed', {
      status,
      details: data.details ?? null,
      requestId,
      code: data.code ?? null
    })
  }

  if (error?.code === 'ECONNABORTED') {
    return new ApiError('The request timed out. Please try again.', {
      status,
      requestId,
      code: error.code
    })
  }

  if (!response) {
    return new ApiError('Unable to reach the server. Please try again.', {
      requestId,
      code: error?.code || 'NETWORK_ERROR'
    })
  }

  return new ApiError(error?.message || 'Request failed', {
    status,
    requestId,
    code: error?.code ?? null
  })
}

const api = axios.create({
  baseURL: isApiConfigured ? `${API_BASE_URL}${API_PREFIX}` : undefined,
  timeout: 10000,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json'
  }
})

api.interceptors.request.use((config) => {
  if (!isApiConfigured) {
    return Promise.reject(
      new ApiError('API base URL is not configured. Set VITE_API_URL.', {
        code: 'API_NOT_CONFIGURED'
      })
    )
  }

  const token = getStoredToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  config.headers['X-Request-Id'] = createRequestId()
  return config
})

api.interceptors.response.use(
  (response) => {
    const payload = response.data
    if (payload && typeof payload === 'object' && Object.prototype.hasOwnProperty.call(payload, 'success')) {
      if (!payload.success) {
        throw new ApiError(payload.message || 'Request failed', {
          status: response.status,
          details: payload.details ?? null,
          requestId: payload.requestId ?? response.headers?.['x-request-id'] ?? null,
          code: payload.code ?? null
        })
      }
      return payload.data
    }
    return payload
  },
  (error) => {
    const apiError = normalizeError(error)
    const requestUrl = error?.config?.url || ''

    if (apiError.status === 401 && !PUBLIC_AUTH_ENDPOINT.test(requestUrl)) {
      unauthorizedListeners.forEach((listener) => listener(apiError))
    }

    return Promise.reject(apiError)
  }
)

export function subscribeToUnauthorized(listener) {
  unauthorizedListeners.add(listener)
  return () => unauthorizedListeners.delete(listener)
}

export { ApiError, isApiConfigured }
export default api
