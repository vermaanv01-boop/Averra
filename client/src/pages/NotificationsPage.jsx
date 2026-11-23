import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCheck, RefreshCw } from 'lucide-react'
import PageHeader from '../components/common/PageHeader.jsx'
import Alert from '../components/ui/Alert.jsx'
import Button from '../components/ui/Button.jsx'
import EmptyState from '../components/common/EmptyState.jsx'
import Modal from '../components/ui/Modal.jsx'
import Pagination from '../components/discovery/Pagination.jsx'
import NotificationPreferences from '../components/notifications/NotificationPreferences.jsx'
import NotificationRow from '../components/notifications/NotificationRow.jsx'
import { useNotifications } from '../contexts/NotificationContext.jsx'
import { notificationService } from '../services/index.js'
import { applyNotificationRead, DEFAULT_NOTIFICATION_PREFERENCES, isNotificationType, NOTIFICATION_GROUPS, NOTIFICATION_TYPE_LABELS, normalizePreferences, notificationDestination, removeNotificationById } from '../utils/notifications.js'
import { cn } from '../utils/cn.js'

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'read', label: 'Read' }
]
const PAGE_SIZE = 10

export default function NotificationsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const {
    unreadCount,
    markRead,
    markAllRead,
    remove,
    refreshUnreadCount,
    subscribe
  } = useNotifications()

  const status = ['unread', 'read'].includes(searchParams.get('status')) ? searchParams.get('status') : 'all'
  const requestedType = searchParams.get('type')
  const typeFilter = isNotificationType(requestedType) ? requestedType : ''
  const page = Math.max(1, Number(searchParams.get('page')) || 1)

  const [notifications, setNotifications] = useState([])
  const [pagination, setPagination] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [actionError, setActionError] = useState('')
  const [busy, setBusy] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [preferences, setPreferences] = useState(DEFAULT_NOTIFICATION_PREFERENCES)
  const [preferencesLoading, setPreferencesLoading] = useState(true)
  const [preferencesError, setPreferencesError] = useState(null)
  const [preferencesSaving, setPreferencesSaving] = useState(false)

  const sequenceRef = useRef(0)
  const reloadTimerRef = useRef(null)

  const setParams = useCallback(
    (patch, resetPage = true) => {
      const next = new URLSearchParams(searchParams)
      Object.entries(patch).forEach(([key, value]) => {
        if (value === null || value === undefined || value === '') next.delete(key)
        else next.set(key, String(value))
      })
      if (resetPage) next.delete('page')
      setSearchParams(next, { replace: true })
    },
    [searchParams, setSearchParams]
  )

  const load = useCallback(
    async (silent = false) => {
      const sequence = ++sequenceRef.current
      if (!silent) setLoading(true)
      setError(null)
      try {
        const params = { page, limit: PAGE_SIZE }
        if (status === 'unread') params.isRead = false
        if (status === 'read') params.isRead = true
        if (typeFilter) params.type = typeFilter
        const data = await notificationService.list(params)
        if (sequence !== sequenceRef.current) return
        setNotifications(Array.isArray(data?.notifications) ? data.notifications : [])
        setPagination(data?.pagination || null)
      } catch (caught) {
        if (sequence === sequenceRef.current) setError(caught)
      } finally {
        if (sequence === sequenceRef.current) setLoading(false)
      }
    },
    [page, status, typeFilter]
  )

  const scheduleReload = useCallback(() => {
    clearTimeout(reloadTimerRef.current)
    reloadTimerRef.current = setTimeout(() => load(true), 200)
  }, [load])

  const loadPreferences = useCallback(async () => {
    setPreferencesLoading(true)
    setPreferencesError(null)
    try {
      const data = await notificationService.preferences()
      setPreferences(normalizePreferences(data?.preferences))
    } catch (caught) {
      setPreferencesError(caught)
    } finally {
      setPreferencesLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    loadPreferences()
  }, [loadPreferences])

  useEffect(() => subscribe(() => scheduleReload()), [subscribe, scheduleReload])

  useEffect(() => () => clearTimeout(reloadTimerRef.current), [])

  function applyLocalRead(ids, readAt) {
    setNotifications((previous) => {
      const next = applyNotificationRead(previous, { ids, readAt })
      return status === 'unread' ? next.filter((notification) => !ids.includes(notification.id)) : next
    })
    if (status === 'unread' && pagination) {
      const total = Math.max(0, pagination.total - ids.length)
      setPagination({ ...pagination, total, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) })
    }
  }

  async function handleMarkRead(notification) {
    setBusy(true)
    setActionError('')
    try {
      const data = await markRead(notification.id)
      applyLocalRead([notification.id], data?.notification?.readAt)
      scheduleReload()
    } catch (caught) {
      setActionError(caught.message || 'Could not mark the notification as read.')
    } finally {
      setBusy(false)
    }
  }

  async function handleMarkAll() {
    setBusy(true)
    setActionError('')
    try {
      const data = await markAllRead()
      if (status === 'unread') {
        setNotifications([])
        setPagination((previous) => (previous ? { ...previous, total: 0, totalPages: 1 } : previous))
      } else {
        applyLocalRead(
          notifications.map((notification) => notification.id),
          new Date().toISOString()
        )
      }
      if (typeof data?.unreadCount === 'number') refreshUnreadCount()
      scheduleReload()
    } catch (caught) {
      setActionError(caught.message || 'Could not mark notifications as read.')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setBusy(true)
    setActionError('')
    try {
      await remove(deleteTarget.id)
      setNotifications((previous) => removeNotificationById(previous, deleteTarget.id))
      setDeleteTarget(null)
      scheduleReload()
    } catch (caught) {
      setActionError(caught.message || 'Could not delete the notification.')
      setDeleteTarget(null)
    } finally {
      setBusy(false)
    }
  }

  async function handleOpen(notification) {
    const destination = notificationDestination(notification)
    if (!destination) {
      setActionError('This notification no longer points to an available destination.')
      return
    }
    setBusy(true)
    setActionError('')
    try {
      if (!notification.isRead) {
        const data = await markRead(notification.id)
        applyLocalRead([notification.id], data?.notification?.readAt)
      }
      navigate(destination)
    } catch (caught) {
      setActionError(caught.message || 'Could not open this notification.')
    } finally {
      setBusy(false)
    }
  }

  async function handlePreferenceChange(key, value) {
    const previous = preferences
    setPreferences({ ...previous, [key]: value })
    setPreferencesSaving(true)
    setPreferencesError(null)
    try {
      const data = await notificationService.updatePreferences({ [key]: value })
      setPreferences(normalizePreferences(data?.preferences))
    } catch (caught) {
      setPreferences(previous)
      setPreferencesError(caught)
    } finally {
      setPreferencesSaving(false)
    }
  }

  return (
    <div className="animate-rise space-y-8">
      <PageHeader
        eyebrow="Notifications"
        title="Stay close to what matters"
        description="Follow exchange activity, session updates, messages and reviews in one place."
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              loading={loading}
              onClick={() => {
                load()
                refreshUnreadCount()
              }}
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Refresh
            </Button>
            <Button variant="subtle" size="sm" disabled={busy || unreadCount === 0} onClick={handleMarkAll}>
              <CheckCheck className="h-4 w-4" aria-hidden="true" />
              Mark all read
            </Button>
          </>
        }
      />

      {actionError && <Alert variant="error">{actionError}</Alert>}

      <div className="flex flex-wrap items-center gap-3">
        <div role="tablist" aria-label="Notification status" className="inline-flex rounded-xl border border-ink-200 bg-white p-1 shadow-soft">
          {FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              role="tab"
              aria-selected={status === filter.id}
              onClick={() => setParams({ status: filter.id === 'all' ? null : filter.id })}
              className={cn(
                'rounded-lg px-4 py-2 text-sm transition-colors',
                status === filter.id ? 'bg-ink-900 text-white' : 'text-ink-600 hover:bg-ivory-100 hover:text-ink-900'
              )}
            >
              {filter.label}
              {filter.id === 'unread' && unreadCount > 0 ? ` (${unreadCount})` : ''}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-2 text-xs text-ink-500">
          Category
          <select
            value={typeFilter}
            onChange={(event) => setParams({ type: event.target.value || null })}
            className="h-9 rounded-lg border border-ink-200 bg-white px-3 text-sm text-ink-900"
          >
            <option value="">All categories</option>
            {NOTIFICATION_GROUPS.map((group) => (
              <optgroup key={group.id} label={group.label}>
                {group.types.map((type) => (
                  <option key={type} value={type}>
                    {NOTIFICATION_TYPE_LABELS[type]}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
      </div>

      <section className="overflow-hidden rounded-card border border-ink-200/80 bg-white shadow-soft">
        {error ? (
          <div className="p-5">
            <Alert
              variant="error"
              title="Could not load notifications"
              action={
                <Button size="sm" variant="secondary" onClick={() => load()}>
                  Retry
                </Button>
              }
            >
              {error.message}
            </Alert>
          </div>
        ) : loading ? (
          <NotificationSkeleton />
        ) : notifications.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title="Nothing here yet"
              description="Notifications for your exchanges, sessions, messages and reviews will appear here."
            />
          </div>
        ) : (
          <ul>
            {notifications.map((notification) => (
              <NotificationRow
                key={notification.id}
                notification={notification}
                busy={busy}
                onOpen={handleOpen}
                onMarkRead={handleMarkRead}
                onDelete={setDeleteTarget}
              />
            ))}
          </ul>
        )}

        {!loading && !error && (
          <div className="px-4 pb-5 sm:px-6">
            <Pagination
              pagination={pagination}
              disabled={busy}
              onPageChange={(next) => setParams({ page: next }, false)}
            />
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-card border border-ink-200/80 bg-white shadow-soft">
        <NotificationPreferences
          preferences={preferences}
          loading={preferencesLoading}
          saving={preferencesSaving}
          error={preferencesError}
          onChange={handlePreferenceChange}
        />
      </section>

      <Modal
        open={Boolean(deleteTarget)}
        title="Delete this notification?"
        description="It will be removed from your notification list."
        size="sm"
        onClose={() => setDeleteTarget(null)}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="ghost" disabled={busy} onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" loading={busy} onClick={handleDelete}>
              Delete
            </Button>
          </div>
        }
      >
        <p className="text-sm leading-6 text-ink-600">This cannot be undone.</p>
      </Modal>
    </div>
  )
}

function NotificationSkeleton() {
  return (
    <div className="space-y-4 p-5" aria-hidden="true">
      {[0, 1, 2, 3].map((item) => (
        <div key={item} className="flex animate-pulse items-start gap-3">
          <div className="h-10 w-10 shrink-0 rounded-full bg-ivory-200" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-1/3 rounded bg-ivory-200" />
            <div className="h-3 w-2/3 rounded bg-ivory-100" />
          </div>
        </div>
      ))}
    </div>
  )
}
