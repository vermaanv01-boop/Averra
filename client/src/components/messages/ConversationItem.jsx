import { cn } from '../../utils/cn.js'
import { formatConversationTime, lastMessagePreview } from '../../utils/messaging.js'
import MessageAvatar from './MessageAvatar.jsx'

export default function ConversationItem({
  conversation,
  currentUserId,
  active = false,
  online = false,
  unreadCount = 0,
  onSelect
}) {
  const other = (conversation.participants || []).find(
    (person) => person?.id && person.id !== currentUserId
  )

  return (
    <button
      type="button"
      onClick={() => onSelect(conversation.id)}
      aria-current={active ? 'true' : undefined}
      className={cn(
        'flex w-full items-start gap-3 border-b border-ink-100 px-4 py-3.5 text-left transition-colors duration-200',
        active ? 'bg-lavender-50' : 'hover:bg-ivory-100'
      )}
    >
      <MessageAvatar person={other} online={online} />

      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate text-sm font-medium text-ink-900">
            {other?.name || other?.username || 'Conversation'}
          </span>
          {conversation.lastMessageAt && (
            <span className="shrink-0 text-[11px] text-ink-500">
              {formatConversationTime(conversation.lastMessageAt)}
            </span>
          )}
        </span>
        <span className="mt-1 flex items-center justify-between gap-2">
          <span className={cn('truncate text-xs', unreadCount ? 'text-ink-800' : 'text-ink-500')}>
            {lastMessagePreview(conversation)}
          </span>
          {unreadCount > 0 && (
            <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-lavender-600 px-1.5 text-[10px] font-semibold text-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </span>
      </span>
    </button>
  )
}
