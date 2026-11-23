import { io } from 'socket.io-client'
import { isSocketConfigured, SOCKET_URL } from '../utils/config.js'
import { ApiError } from '../utils/errors.js'

export const SOCKET_EVENTS = {
  join: 'conversation:join',
  leave: 'conversation:leave',
  send: 'message:send',
  read: 'message:read',
  typingStart: 'typing:start',
  typingStop: 'typing:stop',
  messageNew: 'message:new',
  messageUpdated: 'message:updated',
  messageDeleted: 'message:deleted',
  messageRead: 'message:read',
  presenceOnline: 'presence:online',
  presenceOffline: 'presence:offline',
  notificationNew: 'notification:new',
  notificationRead: 'notification:read',
  notificationDeleted: 'notification:deleted',
  notificationUnreadCount: 'notification:unread-count'
}

export function createMessagingSocket(token) {
  if (!isSocketConfigured) {
    throw new ApiError('Socket URL is not configured. Set VITE_API_URL.', {
      code: 'SOCKET_NOT_CONFIGURED'
    })
  }
  if (!token) {
    throw new ApiError('Authentication required', { status: 401, code: 'SOCKET_UNAUTHENTICATED' })
  }

  return io(SOCKET_URL, {
    auth: { token },
    autoConnect: false,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
    randomizationFactor: 0.4,
    timeout: 10000,
    transports: ['websocket', 'polling']
  })
}

export function emitWithAck(socket, event, payload, timeoutMs = 8000) {
  return new Promise((resolve) => {
    if (!socket?.connected) {
      resolve({ ok: false, error: 'Not connected to the server' })
      return
    }

    let settled = false
    const finish = (response) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(response)
    }
    const timer = setTimeout(() => finish({ ok: false, error: 'The request timed out' }), timeoutMs)

    socket.timeout(timeoutMs).emit(event, payload, (error, response) => {
      if (error) {
        finish({ ok: false, error: error.message || 'The request timed out' })
        return
      }
      finish(response && typeof response === 'object' ? response : { ok: false, error: 'Unexpected response' })
    })
  })
}
