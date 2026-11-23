import { MessageSquareText, RefreshCw } from 'lucide-react'
import { Link } from 'react-router-dom'
import EmptyState from '../common/EmptyState.jsx'
import Alert from '../ui/Alert.jsx'
import Button from '../ui/Button.jsx'
import ConversationItem from './ConversationItem.jsx'

function ConversationSkeleton() {
  return (
    <div className="space-y-4 p-4" aria-hidden="true">
      {[0, 1, 2, 3].map((item) => (
        <div key={item} className="flex animate-pulse items-center gap-3">
          <div className="h-10 w-10 shrink-0 rounded-full bg-ivory-200" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-2/3 rounded bg-ivory-200" />
            <div className="h-2.5 w-4/5 rounded bg-ivory-100" />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function ConversationList({
  conversations,
  currentUserId,
  activeId,
  onlineIds,
  unreadCounts,
  loading,
  error,
  onSelect,
  onRetry
}) {
  return (
    <aside className="flex min-h-0 flex-col overflow-hidden rounded-card border border-ink-200/80 bg-white shadow-soft md:h-full">
      <div className="flex items-center justify-between gap-3 border-b border-ink-100 px-4 py-4">
        <div>
          <h2 className="text-lg leading-tight text-ink-900">Messages</h2>
          <p className="mt-0.5 text-xs text-ink-500">Your accepted exchanges</p>
        </div>
        <Button variant="secondary" size="sm" onClick={onRetry} disabled={loading} aria-label="Refresh conversations">
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <ConversationSkeleton />
        ) : error ? (
          <div className="p-4">
            <Alert variant="error" title="Could not load conversations" action={<Button size="sm" variant="secondary" onClick={onRetry}>Retry</Button>}>
              {error.message}
            </Alert>
          </div>
        ) : conversations.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={MessageSquareText}
              title="No conversations yet"
              description="Conversations appear when an exchange request is accepted. Find a partner to get started."
              action={
                <a
                  href="/app/discovery"
                  className="inline-flex h-9 items-center rounded-lg border border-ink-900 bg-ink-900 px-4 text-sm font-medium text-white transition-colors hover:bg-ink-800"
                >
                  Discover people
                </a>
              }
            />
          </div>
        ) : (
          conversations.map((conversation) => (
            <ConversationItem
              key={conversation.id}
              conversation={conversation}
              currentUserId={currentUserId}
              active={conversation.id === activeId}
              online={onlineIds.has(conversation.participants?.find((p) => p?.id !== currentUserId)?.id)}
              unreadCount={unreadCounts[conversation.id] || 0}
              onSelect={onSelect}
            />
          ))
        )}
      </div>
    </aside>
  )
}
