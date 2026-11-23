import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useSocket } from './SocketContext.jsx'
import { notificationService } from '../services/index.js'
import { SOCKET_EVENTS } from '../services/socket.service.js'
import {
  applyNotificationRead,
  removeNotificationById,
  upsertNotification
} from '../utils/notifications.js'

const NotificationContext = createContext(null)
const RECENT_LIMIT = 6

export function NotificationProvider({ children }) {
  const socket = useSocket()
  const [unreadCount, setUnreadCount] = useState(0)
  const [recent, setRecent] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const listenersRef = useRef(new Set())
  const mountedRef = useRef(true)
  const recentSeqRef = useRef(0)

  const notify = useCallback((event, payload) => {
    listenersRef.current.forEach((handler) => handler({ event, payload }))
  }, [])

  const subscribe = useCallback((handler) => {
    listenersRef.current.add(handler)
    return () => listenersRef.current.delete(handler)
  }, [])

  const refreshUnreadCount = useCallback(async () => {
    try {
      const data = await notificationService.unreadCount()
      if (mountedRef.current) setUnreadCount(data?.unreadCount || 0)
    } catch {}
  }, [])

  const refreshRecent = useCallback(async (silent = false) => {
    const sequence = ++recentSeqRef.current
    if (!silent && mountedRef.current) setLoading(true)
    if (!silent && mountedRef.current) setError(null)
    try {
      const data = await notificationService.list({ page: 1, limit: RECENT_LIMIT })
      if (!mountedRef.current || sequence !== recentSeqRef.current) return
      setRecent(Array.isArray(data?.notifications) ? data.notifications : [])
      if (typeof data?.unreadCount === 'number') setUnreadCount(data.unreadCount)
    } catch (caught) {
      if (mountedRef.current && sequence === recentSeqRef.current) setError(caught)
    } finally {
      if (mountedRef.current && sequence === recentSeqRef.current) setLoading(false)
    }
  }, [])

  const markRead = useCallback(async (id) => {
    const data = await notificationService.markRead(id)
    if (!mountedRef.current) return data
    setRecent((previous) =>
      applyNotificationRead(previous, {
        id,
        readAt: data?.notification?.readAt,
        unreadCount: data?.unreadCount
      })
    )
    if (typeof data?.unreadCount === 'number') setUnreadCount(data.unreadCount)
    return data
  }, [])

  const markAllRead = useCallback(async () => {
    const data = await notificationService.markAllRead()
    if (!mountedRef.current) return data
    setRecent((previous) =>
      applyNotificationRead(previous, { ids: previous.map((item) => item.id), readAt: new Date().toISOString() })
    )
    if (typeof data?.unreadCount === 'number') setUnreadCount(data.unreadCount)
    return data
  }, [])

  const remove = useCallback(async (id) => {
    const data = await notificationService.remove(id)
    if (!mountedRef.current) return data
    setRecent((previous) => removeNotificationById(previous, id))
    if (typeof data?.unreadCount === 'number') setUnreadCount(data.unreadCount)
    return data
  }, [])

  useEffect(() => {
    mountedRef.current = true
    refreshUnreadCount()
    refreshRecent()

    const unsubscribe = [
      socket.subscribe('connect', () => {
        refreshUnreadCount()
        refreshRecent(true)
      }),
      socket.subscribe(SOCKET_EVENTS.notificationNew, (notification) => {
        if (!notification?.id) return
        setRecent((previous) => upsertNotification(previous, notification).slice(0, RECENT_LIMIT))
        notify('new', notification)
      }),
      socket.subscribe(SOCKET_EVENTS.notificationRead, (payload) => {
        setRecent((previous) => applyNotificationRead(previous, payload))
        if (typeof payload?.unreadCount === 'number') setUnreadCount(payload.unreadCount)
        notify('read', payload)
      }),
      socket.subscribe(SOCKET_EVENTS.notificationDeleted, (payload) => {
        setRecent((previous) => removeNotificationById(previous, payload?.id))
        if (typeof payload?.unreadCount === 'number') setUnreadCount(payload.unreadCount)
        notify('deleted', payload)
      }),
      socket.subscribe(SOCKET_EVENTS.notificationUnreadCount, (payload) => {
        if (typeof payload?.unreadCount === 'number') setUnreadCount(payload.unreadCount)
        notify('unread-count', payload)
      })
    ]

    return () => {
      unsubscribe.forEach((handler) => handler())
      mountedRef.current = false
    }
  }, [notify, refreshRecent, refreshUnreadCount, socket.subscribe])

  const value = useMemo(
    () => ({
      unreadCount,
      recent,
      loading,
      error,
      refreshUnreadCount,
      refreshRecent,
      markRead,
      markAllRead,
      remove,
      subscribe
    }),
    [
      unreadCount,
      recent,
      loading,
      error,
      refreshUnreadCount,
      refreshRecent,
      markRead,
      markAllRead,
      remove,
      subscribe
    ]
  )

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
}

export function useNotifications() {
  const context = useContext(NotificationContext)
  if (!context) throw new Error('useNotifications must be used inside a NotificationProvider')
  return context
}

export default NotificationProvider
