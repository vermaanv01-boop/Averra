import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import useAuth from '../hooks/useAuth.js'
import { createMessagingSocket, emitWithAck, SOCKET_EVENTS } from '../services/socket.service.js'

const SocketContext = createContext(null)

const SERVER_LISTENERS = [
  'connect',
  'disconnect',
  'connect_error',
  'reconnect_attempt',
  SOCKET_EVENTS.messageNew,
  SOCKET_EVENTS.messageUpdated,
  SOCKET_EVENTS.messageDeleted,
  SOCKET_EVENTS.messageRead,
  SOCKET_EVENTS.typingStart,
  SOCKET_EVENTS.typingStop,
  SOCKET_EVENTS.presenceOnline,
  SOCKET_EVENTS.presenceOffline
]

export function SocketProvider({ children }) {
  const { token, status: authStatus } = useAuth()
  const [connection, setConnection] = useState('offline')
  const [authError, setAuthError] = useState(null)
  const socketRef = useRef(null)
  const listenersRef = useRef(new Map())
  const activeRef = useRef(null)

  useEffect(() => {
    if (!token || authStatus !== 'authenticated') {
      activeRef.current = null
      setConnection('offline')
      return undefined
    }

    let socket
    try {
      socket = createMessagingSocket(token)
    } catch (error) {
      setAuthError(error.message)
      setConnection('error')
      return undefined
    }

    socketRef.current = socket
    setAuthError(null)
    setConnection('connecting')

    const dispatch = (event) => (...args) => {
      listenersRef.current.get(event)?.forEach((handler) => handler(...args))
    }
    const handlers = new Map()

    SERVER_LISTENERS.forEach((event) => {
      const handler = dispatch(event)
      handlers.set(event, handler)
      socket.on(event, handler)
    })

    handlers.set('connected', () => {
      setConnection('connected')
      setAuthError(null)
      if (activeRef.current) {
        socket.emit(SOCKET_EVENTS.join, { conversationId: activeRef.current }, () => {})
      }
    })
    socket.on('connect', handlers.get('connected'))

    handlers.set('disconnected', () => setConnection('disconnected'))
    socket.on('disconnect', handlers.get('disconnected'))

    handlers.set('failed', (error) => {
      setConnection('error')
      if (error?.message === 'Unauthorized') {
        setAuthError('Your session is no longer valid. Please sign in again.')
        socket.disconnect()
      }
    })
    socket.on('connect_error', handlers.get('failed'))

    handlers.set('retrying', () => setConnection('reconnecting'))
    socket.on('reconnect_attempt', handlers.get('retrying'))

    socket.connect()

    return () => {
      socket.removeAllListeners()
      socket.disconnect()
      if (socketRef.current === socket) socketRef.current = null
      activeRef.current = null
      setConnection('offline')
    }
  }, [token, authStatus])

  const subscribe = useCallback((event, handler) => {
    const handlers = listenersRef.current.get(event) || new Set()
    handlers.add(handler)
    listenersRef.current.set(event, handlers)
    return () => {
      handlers.delete(handler)
      if (handlers.size === 0) listenersRef.current.delete(event)
    }
  }, [])

  const setActiveConversation = useCallback((conversationId) => {
    const previous = activeRef.current
    if (previous === conversationId) return
    activeRef.current = conversationId

    const socket = socketRef.current
    if (!socket?.connected) return
    if (previous) socket.emit(SOCKET_EVENTS.leave, { conversationId: previous }, () => {})
    if (conversationId) socket.emit(SOCKET_EVENTS.join, { conversationId }, () => {})
  }, [])

  const emit = useCallback((event, payload) => {
    socketRef.current?.emit(event, payload, () => {})
  }, [])

  const request = useCallback(
    (event, payload, timeout) => emitWithAck(socketRef.current, event, payload, timeout),
    []
  )

  const value = useMemo(
    () => ({
      connection,
      connected: connection === 'connected',
      authError,
      subscribe,
      emit,
      request,
      setActiveConversation
    }),
    [connection, authError, subscribe, emit, request, setActiveConversation]
  )

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
}

export function useSocket() {
  const context = useContext(SocketContext)
  if (!context) throw new Error('useSocket must be used inside a SocketProvider')
  return context
}

export default SocketProvider
