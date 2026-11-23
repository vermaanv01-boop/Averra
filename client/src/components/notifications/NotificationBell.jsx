import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Bell, CheckCheck, ChevronRight, LoaderCircle } from 'lucide-react'
import { useNotifications } from '../../contexts/NotificationContext.jsx'
import NotificationIcon from './NotificationIcon.jsx'
import {
  formatNotificationTime,
  notificationDestination,
  notificationGroup
} from '../../utils/notifications.js'

export default function NotificationBell() {
  const { unreadCount, recent, loading, error, markRead, markAllRead } = useNotifications()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const containerRef = useRef(null)
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    setOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!open) return undefined
    function handlePointer(event) {
      if (!containerRef.current?.contains(event.target)) setOpen(false)
    }
    function handleKey(event) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handlePointer)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handlePointer)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  async function openNotification(notification) {
    const destination = notificationDestination(notification)
    if (!destination) {
      setNotice('This notification no longer points to an available destination.')
      return
    }
    setBusy(true)
    setNotice('')
    try {
      if (!notification.isRead) await markRead(notification.id)
      setOpen(false)
      navigate(destination)
    } catch (caught) {
      setNotice(caught.message || 'Could not open this notification.')
    } finally {
      setBusy(false)
    }
  }

  async function handleMarkAll() {
    setBusy(true)
    setNotice('')
    try {
      await markAllRead()
    } catch (caught) {
      setNotice(caught.message || 'Could not mark notifications as read.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => {
          setOpen((value) => !value)
          setNotice('')
        }}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-ink-200 text-ink-700 transition-colors hover:bg-ivory-100 hover:text-ink-900"
      >
        <Bell className="h-4 w-4" aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute -right-1.5 -top-1.5 grid min-w-[18px] place-items-center rounded-full border-2 border-white bg-lavender-600 px-1 text-[10px] font-semibold leading-4 text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Recent notifications"
          className="animate-fade-in fixed inset-x-3 top-16 z-50 max-h-[70vh] overflow-hidden rounded-card border border-ink-200 bg-white shadow-lift sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-3 sm:w-96"
        >
          <div className="flex items-center justify-between gap-3 border-b border-ink-100 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-ink-900">Notifications</p>
              <p className="text-xs text-ink-500">{unreadCount} unread</p>
            </div>
            <button
              type="button"
              disabled={busy || unreadCount === 0}
              onClick={handleMarkAll}
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-lavender-700 transition-colors hover:bg-lavender-50 disabled:opacity-50"
            >
              <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Mark all read
            </button>
          </div>

          <div className="max-h-[22rem] overflow-y-auto">
            {loading ? (
              <div className="grid h-28 place-items-center text-xs text-ink-500">
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin text-lavender-600" aria-hidden="true" />
                Loading notifications
              </div>
            ) : error ? (
              <p className="px-4 py-6 text-center text-sm text-red-700">{error.message}</p>
            ) : recent.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-ink-500">No notifications yet.</p>
            ) : (
              <ul className="divide-y divide-ink-100">
                {recent.map((notification) => (
                  <li key={notification.id}>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => openNotification(notification)}
                      className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-ivory-50 disabled:opacity-60 ${
                        notification.isRead ? '' : 'bg-lavender-50/50'
                      }`}
                    >
                      <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border border-lavender-200 bg-white text-lavender-700">
                        <NotificationIcon type={notification.type} className="h-3.5 w-3.5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          {!notification.isRead && <span className="h-1.5 w-1.5 rounded-full bg-lavender-500" />}
                          <span className="truncate text-sm font-medium text-ink-900">{notification.title}</span>
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-ink-600">{notification.message}</span>
                        <span className="mt-1 block text-[11px] text-ink-500">
                          {notificationGroup(notification.type)?.label} · {formatNotificationTime(notification.createdAt)}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {notice && <p className="border-t border-red-100 px-4 py-2 text-xs text-red-700">{notice}</p>}

          <div className="border-t border-ink-100 px-4 py-3">
            <Link
              to="/app/notifications"
              onClick={() => setOpen(false)}
              className="inline-flex items-center gap-1 text-sm font-medium text-lavender-700 transition-colors hover:text-lavender-800"
            >
              View all notifications
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
