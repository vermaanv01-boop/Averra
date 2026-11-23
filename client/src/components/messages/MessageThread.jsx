import { useEffect, useRef } from 'react'
import { ArrowLeft, MessageSquareText, RefreshCw } from 'lucide-react'
import { Link } from 'react-router-dom'
import Alert from '../ui/Alert.jsx'
import Button from '../ui/Button.jsx'
import EmptyState from '../common/EmptyState.jsx'
import Spinner from '../ui/Spinner.jsx'
import ConnectionStatus from './ConnectionStatus.jsx'
import MessageAvatar from './MessageAvatar.jsx'
import MessageBubble from './MessageBubble.jsx'
import MessageComposer from './MessageComposer.jsx'
import TypingIndicator from './TypingIndicator.jsx'

export default function MessageThread({
  conversation,
  currentUserId,
  otherPerson,
  messages,
  loading,
  loadingOlder,
  error,
  hasOlder,
  online,
  typingPerson,
  connection,
  authError,
  busy,
  sending,
  onBack,
  onLoadOlder,
  onSend,
  onEdit,
  onDelete,
  onRetry,
  onDiscard,
  onTypingStart,
  onTypingStop
}) {
  const scrollRef = useRef(null)
  const lastIdRef = useRef(null)

  useEffect(() => {
    if (!conversation) {
      lastIdRef.current = null
      return
    }
    const lastId = messages[messages.length - 1]?.id || messages[messages.length - 1]?.clientMessageId || ''
    if (lastId === lastIdRef.current) return
    lastIdRef.current = lastId
    const frame = requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    })
    return () => cancelAnimationFrame(frame)
  }, [messages, conversation?.id])

  if (!conversation) {
    return (
      <section className="hidden min-h-[24rem] flex-col items-center justify-center rounded-card border border-ink-200/80 bg-white shadow-soft md:flex">
        <EmptyState
          icon={MessageSquareText}
          title="Select a conversation"
          description="Choose a conversation from the list to read and reply to messages."
          action={
            <Link to="/app/discovery" className="text-sm text-lavender-700 underline-offset-4 hover:underline">
              Find exchange partners
            </Link>
          }
        />
      </section>
    )
  }

  return (
    <section className="flex min-h-[32rem] flex-col overflow-hidden rounded-card border border-ink-200/80 bg-white shadow-soft md:h-full md:min-h-0">
      <header className="flex items-center gap-3 border-b border-ink-100 px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to conversations"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-ink-200 text-ink-600 transition-colors hover:bg-ivory-100 md:hidden"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        </button>
        <MessageAvatar person={otherPerson} size="sm" online={online} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink-900">
            {otherPerson?.name || otherPerson?.username || 'Conversation'}
          </p>
          <p className="truncate text-xs text-ink-500">
            {typingPerson
              ? `${typingPerson.name || typingPerson.username || 'Participant'} is typing…`
              : online
                ? 'Online'
                : otherPerson?.username
                  ? `@${otherPerson.username}`
                  : 'Offline'}
          </p>
        </div>
        <ConnectionStatus connection={connection} authError={authError} />
      </header>

      {authError && (
        <div className="border-b border-red-100 px-4 py-2">
          <Alert variant="error">{authError}</Alert>
        </div>
      )}

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-ivory-50/50 px-4 py-5">
        {hasOlder && (
          <div className="flex justify-center">
            <Button
              variant="secondary"
              size="sm"
              loading={loadingOlder}
              disabled={loading || loadingOlder}
              onClick={onLoadOlder}
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              Load older messages
            </Button>
          </div>
        )}

        {loading ? (
          <div className="grid h-40 place-items-center">
            <Spinner label="Loading messages" />
          </div>
        ) : error ? (
          <Alert variant="error" title="Could not load messages">
            {error.message}
          </Alert>
        ) : messages.length === 0 ? (
          <EmptyState
            title="No messages yet"
            description="Say hello to start the conversation."
          />
        ) : (
          messages.map((message) => (
            <MessageBubble
              key={message.id || message.clientMessageId}
              message={message}
              currentUserId={currentUserId}
              otherPerson={otherPerson}
              busy={busy}
              onEdit={onEdit}
              onDelete={onDelete}
              onRetry={onRetry}
              onDiscard={onDiscard}
            />
          ))
        )}

        {typingPerson && <TypingIndicator person={typingPerson} />}
      </div>

      <MessageComposer
        disabled={Boolean(authError) || !connection || connection === 'error'}
        sending={false}
        onSend={onSend}
        onTypingStart={onTypingStart}
        onTypingStop={onTypingStop}
      />
    </section>
  )
}
