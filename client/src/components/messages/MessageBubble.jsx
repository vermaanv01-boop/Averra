import { useEffect, useState } from 'react'
import { Check, CircleAlert, Clock3, Pencil, Trash2, X } from 'lucide-react'
import Button from '../ui/Button.jsx'
import Textarea from '../ui/Textarea.jsx'
import { cn } from '../../utils/cn.js'
import {
  formatMessageTime,
  hasBeenReadByOther,
  isOwnMessage,
  validateMessageContent
} from '../../utils/messaging.js'
import MessageAvatar from './MessageAvatar.jsx'

export default function MessageBubble({
  message,
  currentUserId,
  otherPerson,
  busy = false,
  onEdit,
  onDelete,
  onRetry,
  onDiscard
}) {
  const own = isOwnMessage(message, currentUserId)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(message.content || '')
  const [error, setError] = useState('')

  useEffect(() => {
    setEditing(false)
    setDraft(message.content || '')
    setError('')
  }, [message.id, message.content])

  async function handleEdit() {
    const validation = validateMessageContent(draft)
    if (validation.error) {
      setError(validation.error)
      return
    }
    const failure = await onEdit(message, validation.content)
    if (failure) {
      setError(failure)
      return
    }
    setEditing(false)
    setError('')
  }

  return (
    <div className={cn('group flex w-full gap-2.5', own ? 'justify-end' : 'justify-start')}>
      {!own && <MessageAvatar person={otherPerson} size="sm" className="mt-5" />}

      <div className={cn('flex max-w-[85%] flex-col gap-1 sm:max-w-[70%]', own && 'items-end')}>
        {!own && otherPerson && (
          <span className="px-1 text-xs font-medium text-lavender-700">
            {otherPerson.name || otherPerson.username || 'Participant'}
          </span>
        )}

        {editing ? (
          <div className="w-full min-w-[min(20rem,70vw)] space-y-2">
            <Textarea
              value={draft}
              rows={3}
              maxLength={4000}
              autoFocus
              aria-label="Edit message"
              error={error}
              onChange={(event) => {
                setDraft(event.target.value)
                setError('')
              }}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  setEditing(false)
                  setError('')
                }
              }}
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => {
                  setEditing(false)
                  setError('')
                }}
              >
                Cancel
              </Button>
              <Button size="sm" loading={busy} onClick={handleEdit}>
                Save
              </Button>
            </div>
          </div>
        ) : (
          <div
            className={cn(
              'whitespace-pre-wrap break-words rounded-lg border px-3.5 py-2.5 text-sm leading-6 shadow-soft',
              message.status === 'failed'
                ? 'border-red-200 bg-red-50 text-red-800'
                : own
                  ? 'border-lavender-200 bg-lavender-50 text-ink-900'
                  : 'border-ink-100 bg-white text-ink-800'
            )}
          >
            {message.content}
          </div>
        )}

        <div className={cn('flex items-center gap-2 px-1 text-[10px] text-ink-500', own && 'flex-row-reverse')}>
          <span>{formatMessageTime(message.createdAt)}</span>
          {message.editedAt && <span>edited</span>}
          {own && !message.id && (
            <span className="inline-flex items-center gap-1">
              <Clock3 className="h-3 w-3" aria-hidden="true" /> Sending
            </span>
          )}
          {own && message.id && message.status !== 'failed' && (
            <span className={cn('inline-flex items-center gap-1', hasBeenReadByOther(message, currentUserId) && 'text-lavender-700')}>
              <Check className="h-3 w-3" aria-hidden="true" />
              {hasBeenReadByOther(message, currentUserId) ? 'Read' : 'Delivered'}
            </span>
          )}
          {message.status === 'failed' && (
            <span className="inline-flex items-center gap-1 text-red-600">
              <CircleAlert className="h-3 w-3" aria-hidden="true" /> Not sent
            </span>
          )}
        </div>

        {message.status === 'failed' && (
          <div className="flex gap-2 px-1">
            <Button variant="subtle" size="sm" disabled={busy} onClick={() => onRetry(message)}>
              Retry
            </Button>
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => onDiscard(message)}>
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              Discard
            </Button>
          </div>
        )}

        {own && message.id && !editing && (
          <div className={cn('flex gap-1 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100')}>
            <button
              type="button"
              disabled={busy}
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-ink-500 transition-colors hover:bg-ivory-100 hover:text-ink-900 disabled:opacity-50"
            >
              <Pencil className="h-3 w-3" aria-hidden="true" /> Edit
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onDelete(message)}
              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-ink-500 transition-colors hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
            >
              <Trash2 className="h-3 w-3" aria-hidden="true" /> Delete
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
