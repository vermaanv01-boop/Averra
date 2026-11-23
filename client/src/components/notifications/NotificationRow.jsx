import { Check, ChevronRight, Trash2 } from 'lucide-react'
import MessageAvatar from '../messages/MessageAvatar.jsx'
import {
  actorSummary,
  formatNotificationTime,
  notificationGroup,
  NOTIFICATION_TYPE_LABELS
} from '../../utils/notifications.js'
import NotificationIcon from './NotificationIcon.jsx'

export default function NotificationRow({ notification, busy, onOpen, onMarkRead, onDelete }) {
  const group = notificationGroup(notification?.type)
  const time = formatNotificationTime(notification?.createdAt)

  return (
    <li
      className={`group flex items-start gap-3 border-b border-ink-100 px-4 py-4 transition-colors last:border-b-0 ${
        notification?.isRead ? 'bg-white' : 'bg-lavender-50/40'
      }`}
    >
      <div className="relative shrink-0">
        <MessageAvatar person={actorSummary(notification)} size="md" />
        <span className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full border border-white bg-white text-lavender-700 shadow-soft">
          <NotificationIcon type={notification?.type} className="h-3 w-3" />
        </span>
      </div>

      <button
        type="button"
        onClick={() => onOpen(notification)}
        className="min-w-0 flex-1 text-left"
        aria-label={`Open notification: ${notification?.title || 'Notification'}`}
      >
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
          <p className="flex min-w-0 items-center gap-2 text-sm font-medium text-ink-900">
            {!notification?.isRead && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-lavender-500" />}
            <span className="truncate">{notification?.title || 'Notification'}</span>
          </p>
          {time && <time className="shrink-0 text-xs text-ink-500">{time}</time>}
        </div>
        <p className="mt-1 line-clamp-2 text-sm leading-6 text-ink-600">{notification?.message || ''}</p>
        <p className="mt-1.5 flex items-center gap-2 text-xs text-ink-500">
          <span>{group?.label || 'Notification'}</span>
          <span aria-hidden="true">·</span>
          <span>{NOTIFICATION_TYPE_LABELS[notification?.type] || 'Activity'}</span>
        </p>
      </button>

      <div className="flex shrink-0 items-center gap-1">
        {!notification?.isRead && (
          <button
            type="button"
            disabled={busy}
            aria-label="Mark as read"
            title="Mark as read"
            onClick={() => onMarkRead(notification)}
            className="grid h-8 w-8 place-items-center rounded-lg text-ink-500 transition-colors hover:bg-lavender-100 hover:text-lavender-700 disabled:opacity-50"
          >
            <Check className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
        <button
          type="button"
          disabled={busy}
          aria-label="Delete notification"
          title="Delete notification"
          onClick={() => onDelete(notification)}
          className="grid h-8 w-8 place-items-center rounded-lg text-ink-500 transition-colors hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </button>
        <ChevronRight className="h-4 w-4 text-ink-300" aria-hidden="true" />
      </div>
    </li>
  )
}
