import { useCallback, useEffect, useRef, useState } from 'react'
import PageHeader from '../components/common/PageHeader.jsx'
import Alert from '../components/ui/Alert.jsx'
import Button from '../components/ui/Button.jsx'
import Modal from '../components/ui/Modal.jsx'
import ConversationList from '../components/messages/ConversationList.jsx'
import MessageThread from '../components/messages/MessageThread.jsx'
import { useSocket } from '../contexts/SocketContext.jsx'
import useAuth from '../hooks/useAuth.js'
import { conversationService } from '../services/index.js'
import { SOCKET_EVENTS } from '../services/socket.service.js'
import { cn } from '../utils/cn.js'
import {
  applyReadReceipt,
  createClientMessageId,
  getOtherParticipant,
  removeMessage,
  senderId,
  sortMessages,
  upsertMessage,
  validateMessageContent
} from '../utils/messaging.js'

const PAGE_SIZE = 20

function emptyThread(conversationId = null) {
  return {
    conversationId,
    messages: [],
    page: 1,
    totalPages: 1,
    hasOlder: false,
    loading: false,
    loadingOlder: false,
    error: null
  }
}

export default function MessagesPage() {
  const { user } = useAuth()
  const socket = useSocket()

  const [conversations, setConversations] = useState([])
  const [conversationsLoading, setConversationsLoading] = useState(true)
  const [conversationsError, setConversationsError] = useState(null)
  const [unreadCounts, setUnreadCounts] = useState({})
  const [activeId, setActiveId] = useState(null)
  const [thread, setThread] = useState(() => emptyThread())
  const [onlineIds, setOnlineIds] = useState(() => new Set())
  const [typing, setTyping] = useState({})
  const [sending, setSending] = useState(false)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const activeIdRef = useRef(null)
  const threadRef = useRef(thread)
  const sendingRef = useRef(false)
  const requestSeqRef = useRef(0)
  const typingTimersRef = useRef(new Map())

  useEffect(() => {
    activeIdRef.current = activeId
  }, [activeId])

  useEffect(() => {
    threadRef.current = thread
  }, [thread])

  const loadConversations = useCallback(async () => {
    setConversationsLoading(true)
    setConversationsError(null)
    try {
      const data = await conversationService.list()
      const list = Array.isArray(data?.conversations) ? data.conversations : []
      setConversations(list)
      setUnreadCounts(
        Object.fromEntries(list.map((conversation) => [conversation.id, conversation.unreadCount || 0]))
      )
    } catch (error) {
      setConversationsError(error)
    } finally {
      setConversationsLoading(false)
    }
  }, [])

  const refreshUnread = useCallback(async () => {
    try {
      const data = await conversationService.unreadCount()
      const counts = Object.fromEntries(
        (data?.conversations || []).map((item) => [item.conversationId, item.unreadCount])
      )
      setUnreadCounts((previous) => ({ ...previous, ...counts }))
      setConversations((previous) =>
        previous.map((conversation) =>
          Object.prototype.hasOwnProperty.call(counts, conversation.id)
            ? { ...conversation, unreadCount: counts[conversation.id] }
            : conversation
        )
      )
    } catch {}
  }, [])

  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  const markRead = useCallback(
    async (conversationId) => {
      try {
        const data = await conversationService.markRead(conversationId)
        setThread((previous) =>
          previous.conversationId === conversationId
            ? {
                ...previous,
                messages: applyReadReceipt(previous.messages, {
                  messageIds: data?.messageIds || [],
                  readBy: data?.readBy || user?.id
                })
              }
            : previous
        )
        setUnreadCounts((previous) => ({ ...previous, [conversationId]: 0 }))
        setConversations((previous) =>
          previous.map((conversation) =>
            conversation.id === conversationId ? { ...conversation, unreadCount: 0 } : conversation
          )
        )
        await refreshUnread()
      } catch {}
    },
    [refreshUnread, user?.id]
  )

  const loadMessages = useCallback(async (conversationId, mode = 'initial') => {
    const sequence = ++requestSeqRef.current
    setThread((previous) => ({
      ...previous,
      conversationId,
      loading: mode === 'initial',
      loadingOlder: mode === 'older',
      error: null
    }))

    try {
      let page = 1
      let payload

      if (mode === 'older') {
        page = Math.max(1, threadRef.current.page - 1)
        payload = await conversationService.messages(conversationId, { page, limit: PAGE_SIZE })
      } else {
        payload = await conversationService.messages(conversationId, { page: 1, limit: PAGE_SIZE })
        const totalPages = payload?.pagination?.totalPages || 1
        if (totalPages > 1) {
          page = totalPages
          payload = await conversationService.messages(conversationId, { page, limit: PAGE_SIZE })
        }
      }

      if (sequence !== requestSeqRef.current) return

      const incoming = Array.isArray(payload?.messages) ? payload.messages : []
      setThread((previous) => {
        const pending = mode === 'initial'
          ? previous.messages.filter((message) => message.status === 'sending' || message.status === 'failed')
          : []
        return {
          ...previous,
          conversationId,
          messages: sortMessages([
            ...pending,
            ...(mode === 'older' ? incoming : []),
            ...(mode === 'older' ? previous.messages : incoming)
          ]),
          page,
          totalPages: payload?.pagination?.totalPages || page,
          hasOlder: page > 1,
          loading: false,
          loadingOlder: false,
          error: null
        }
      })
    } catch (error) {
      if (sequence !== requestSeqRef.current) return
      setThread((previous) => ({ ...previous, loading: false, loadingOlder: false, error }))
    }
  }, [])

  const updatePreview = useCallback((conversationId, message) => {
    setConversations((previous) =>
      previous
        .map((conversation) =>
          conversation.id === conversationId
            ? {
                ...conversation,
                lastMessage: {
                  id: message.id,
                  content: message.content,
                  sender: senderId(message),
                  createdAt: message.createdAt
                },
                lastMessageAt: message.createdAt
              }
            : conversation
        )
        .sort(
          (left, right) =>
            new Date(right.lastMessageAt || right.updatedAt || 0) -
            new Date(left.lastMessageAt || left.updatedAt || 0)
        )
    )
  }, [])

  const openConversation = useCallback(
    async (conversationId) => {
      if (activeIdRef.current === conversationId) return
      activeIdRef.current = conversationId
      setActiveId(conversationId)
      socket.setActiveConversation(conversationId)
      setActionError(null)
      setThread(emptyThread(conversationId))
      setUnreadCounts((previous) => ({ ...previous, [conversationId]: 0 }))
      setConversations((previous) =>
        previous.map((conversation) =>
          conversation.id === conversationId ? { ...conversation, unreadCount: 0 } : conversation
        )
      )
      await Promise.all([loadMessages(conversationId, 'initial'), markRead(conversationId)])
    },
    [loadMessages, markRead, socket.setActiveConversation]
  )

  const closeConversation = useCallback(() => {
    const id = activeIdRef.current
    if (id) socket.emit(SOCKET_EVENTS.typingStop, { conversationId: id })
    activeIdRef.current = null
    setActiveId(null)
    socket.setActiveConversation(null)
    setThread(emptyThread())
    setActionError(null)
  }, [socket.emit, socket.setActiveConversation])

  const sendMessage = useCallback(
    async (conversationId, content, existing = null) => {
      if (sendingRef.current) return false
      const validation = validateMessageContent(content)
      if (validation.error) {
        setActionError(validation.error)
        return false
      }

      sendingRef.current = true
      setSending(true)
      setActionError(null)

      const clientMessageId = existing?.clientMessageId || createClientMessageId()
      const optimistic = {
        id: existing?.id || '',
        conversationId,
        clientMessageId,
        sender: {
          id: user?.id,
          name: user?.name,
          username: user?.username,
          profileImage: user?.profileImage || ''
        },
        content: validation.content,
        messageType: 'text',
        deliveredTo: existing?.deliveredTo || [],
        readBy: existing?.readBy || [],
        editedAt: null,
        deletedAt: null,
        createdAt: existing?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'sending'
      }

      setThread((previous) =>
        previous.conversationId === conversationId
          ? {
              ...previous,
              messages: upsertMessage(
                previous.messages.filter((message) => message.clientMessageId !== clientMessageId),
                optimistic
              )
            }
          : previous
      )

      const payload = {
        conversationId,
        content: validation.content,
        clientMessageId,
        messageType: 'text'
      }

      try {
        const result = socket.connected
          ? await socket.request(SOCKET_EVENTS.send, payload)
          : await conversationService.send(conversationId, payload)
        const saved = result?.message || null
        if (!saved) throw new Error(result?.error || 'Message could not be sent')

        setThread((previous) =>
          previous.conversationId === conversationId
            ? { ...previous, messages: upsertMessage(previous.messages, { ...saved, status: 'sent' }) }
            : previous
        )
        updatePreview(conversationId, saved)
        return true
      } catch (error) {
        setThread((previous) =>
          previous.conversationId === conversationId
            ? {
                ...previous,
                messages: upsertMessage(previous.messages, { ...optimistic, status: 'failed' })
              }
            : previous
        )
        setActionError(error.message || 'Message could not be sent')
        return false
      } finally {
        sendingRef.current = false
        setSending(false)
      }
    },
    [socket.connected, socket.request, updatePreview, user]
  )

  const editMessage = useCallback(
    async (message, content) => {
      try {
        const data = await conversationService.edit(message.id, content)
        if (data?.message) {
          setThread((previous) =>
            previous.conversationId === message.conversationId
              ? { ...previous, messages: upsertMessage(previous.messages, data.message) }
              : previous
          )
          setConversations((previous) =>
            previous.map((conversation) =>
              conversation.lastMessage?.id === message.id
                ? {
                    ...conversation,
                    lastMessage: { ...conversation.lastMessage, content: data.message.content }
                  }
                : conversation
            )
          )
        }
        return ''
      } catch (error) {
        return error.message || 'Message could not be edited'
      }
    },
    []
  )

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return
    setBusy(true)
    try {
      await conversationService.remove(deleteTarget.id)
      setThread((previous) =>
        previous.conversationId === deleteTarget.conversationId
          ? { ...previous, messages: removeMessage(previous.messages, deleteTarget.id) }
          : previous
      )
      setConversations((previous) =>
        previous.map((conversation) =>
          conversation.lastMessage?.id === deleteTarget.id
            ? { ...conversation, lastMessage: null, lastMessageAt: null }
            : conversation
        )
      )
      setDeleteTarget(null)
      setActionError(null)
    } catch (error) {
      setActionError(error.message || 'Message could not be deleted')
      setDeleteTarget(null)
    } finally {
      setBusy(false)
    }
  }, [deleteTarget])

  useEffect(() => {
    const subscriptions = [
      socket.subscribe('connect', () => {
        loadConversations()
        refreshUnread()
        if (activeIdRef.current) loadMessages(activeIdRef.current, 'initial')
      }),
      socket.subscribe('disconnect', () => {
        setOnlineIds(new Set())
        setTyping({})
      }),
      socket.subscribe(SOCKET_EVENTS.messageNew, (message) => {
        if (!message?.conversationId) return
        const conversationId = message.conversationId
        const isActive = conversationId === activeIdRef.current
        const isOwn = senderId(message) === user?.id
        setThread((previous) =>
          previous.conversationId === conversationId
            ? { ...previous, messages: upsertMessage(previous.messages, message) }
            : previous
        )
        setConversations((previous) =>
          previous.map((conversation) =>
            conversation.id === conversationId
              ? {
                  ...conversation,
                  lastMessage: {
                    id: message.id,
                    content: message.content,
                    sender: senderId(message),
                    createdAt: message.createdAt
                  },
                  lastMessageAt: message.createdAt,
                  unreadCount: isActive || isOwn ? 0 : (conversation.unreadCount || 0) + 1
                }
              : conversation
          )
        )
        if (!isActive && !isOwn) {
          setUnreadCounts((previous) => ({ ...previous, [conversationId]: (previous[conversationId] || 0) + 1 }))
        } else if (isActive && !isOwn && !document.hidden) {
          markRead(conversationId)
        }
      }),
      socket.subscribe(SOCKET_EVENTS.messageUpdated, (message) => {
        if (!message?.conversationId) return
        setThread((previous) =>
          previous.conversationId === message.conversationId
            ? { ...previous, messages: upsertMessage(previous.messages, message) }
            : previous
        )
        setConversations((previous) =>
          previous.map((conversation) =>
            conversation.lastMessage?.id === message.id
              ? { ...conversation, lastMessage: { ...conversation.lastMessage, content: message.content } }
              : conversation
          )
        )
      }),
      socket.subscribe(SOCKET_EVENTS.messageDeleted, (payload) => {
        if (!payload?.conversationId) return
        setThread((previous) =>
          previous.conversationId === payload.conversationId
            ? { ...previous, messages: removeMessage(previous.messages, payload.id) }
            : previous
        )
        setConversations((previous) =>
          previous.map((conversation) =>
            conversation.lastMessage?.id === payload.id
              ? { ...conversation, lastMessage: null, lastMessageAt: null }
              : conversation
          )
        )
      }),
      socket.subscribe(SOCKET_EVENTS.messageRead, (payload) => {
        if (!payload?.conversationId) return
        setThread((previous) =>
          previous.conversationId === payload.conversationId
            ? { ...previous, messages: applyReadReceipt(previous.messages, payload) }
            : previous
        )
      }),
      socket.subscribe(SOCKET_EVENTS.presenceOnline, (payload) => {
        if (!payload?.userId) return
        setOnlineIds((previous) => new Set(previous).add(payload.userId))
      }),
      socket.subscribe(SOCKET_EVENTS.presenceOffline, (payload) => {
        if (!payload?.userId) return
        setOnlineIds((previous) => {
          const next = new Set(previous)
          next.delete(payload.userId)
          return next
        })
      })
    ]

    const clearTyping = (conversationId) => {
      clearTimeout(typingTimersRef.current.get(conversationId))
      typingTimersRef.current.delete(conversationId)
      setTyping((previous) => {
        const next = { ...previous }
        delete next[conversationId]
        return next
      })
    }
    subscriptions.push(
      socket.subscribe(SOCKET_EVENTS.typingStart, ({ conversationId, user: person }) => {
        if (!conversationId || !person?.id || person.id === user?.id) return
        clearTimeout(typingTimersRef.current.get(conversationId))
        setTyping((previous) => ({
          ...previous,
          [conversationId]: { id: person.id, name: person.name, username: person.username }
        }))
        typingTimersRef.current.set(conversationId, setTimeout(() => clearTyping(conversationId), 3500))
      }),
      socket.subscribe(SOCKET_EVENTS.typingStop, ({ conversationId, user: person }) => {
        if (!conversationId || (person?.id && person.id === user?.id)) return
        clearTyping(conversationId)
      })
    )

    return () => {
      subscriptions.forEach((unsubscribe) => unsubscribe())
      typingTimersRef.current.forEach((timer) => clearTimeout(timer))
      typingTimersRef.current.clear()
    }
  }, [socket.subscribe, loadConversations, refreshUnread, loadMessages, markRead, user?.id])

  useEffect(() => {
    const handleFocus = () => {
      if (activeIdRef.current && !document.hidden) markRead(activeIdRef.current)
    }
    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleFocus)
    return () => {
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleFocus)
    }
  }, [markRead])

  useEffect(
    () => () => {
      const id = activeIdRef.current
      if (id) socket.emit(SOCKET_EVENTS.typingStop, { conversationId: id })
    },
    [socket.emit]
  )

  const activeConversation = conversations.find((conversation) => conversation.id === activeId) || null
  const otherPerson = getOtherParticipant(activeConversation, user?.id)
  const typingPerson = typing[activeId] || null
  const unreadTotal = Object.values(unreadCounts).reduce((sum, count) => sum + (Number(count) || 0), 0)

  function handleTypingStart() {
    if (activeIdRef.current) socket.emit(SOCKET_EVENTS.typingStart, { conversationId: activeIdRef.current })
  }

  function handleTypingStop() {
    if (activeIdRef.current) socket.emit(SOCKET_EVENTS.typingStop, { conversationId: activeIdRef.current })
  }

  function discardMessage(message) {
    setThread((previous) => ({
      ...previous,
      messages: previous.messages.filter((item) => item.clientMessageId !== message.clientMessageId)
    }))
  }

  return (
    <div className="animate-rise space-y-6">
      <PageHeader
        eyebrow="Messages"
        title="Conversations with your exchange partners"
        description="Talk through the details, share updates and keep every exchange moving."
        actions={
          unreadTotal > 0 ? (
            <span className="inline-flex h-8 items-center rounded-full border border-lavender-200 bg-lavender-50 px-3 text-xs font-medium text-lavender-700">
              {unreadTotal} unread
            </span>
          ) : null
        }
      />

      {actionError && !deleteTarget && (
        <Alert variant="error" title="Message not sent">
          {actionError}
        </Alert>
      )}

      <div className="grid min-h-0 gap-5 md:h-[calc(100vh-16rem)] md:min-h-[34rem] md:grid-cols-[18rem_minmax(0,1fr)] lg:grid-cols-[21rem_minmax(0,1fr)]">
        <div className={cn('min-h-0', activeId && 'hidden md:block')}>
          <ConversationList
            conversations={conversations}
            currentUserId={user?.id}
            activeId={activeId}
            onlineIds={onlineIds}
            unreadCounts={unreadCounts}
            loading={conversationsLoading}
            error={conversationsError}
            onSelect={openConversation}
            onRetry={() => {
              loadConversations()
              refreshUnread()
            }}
          />
        </div>

        <div className={cn('min-h-0', !activeId && 'hidden md:block')}>
          <MessageThread
            conversation={activeConversation}
            currentUserId={user?.id}
            otherPerson={otherPerson}
            messages={thread.messages}
            loading={thread.loading}
            loadingOlder={thread.loadingOlder}
            error={thread.error}
            hasOlder={thread.hasOlder}
            online={Boolean(otherPerson && onlineIds.has(otherPerson.id))}
            typingPerson={typingPerson}
            connection={socket.connection}
            authError={socket.authError}
            busy={busy}
            sending={sending}
            onBack={closeConversation}
            onLoadOlder={() => loadMessages(activeId, 'older')}
            onSend={(content) => sendMessage(activeId, content)}
            onEdit={editMessage}
            onDelete={setDeleteTarget}
            onRetry={(message) => sendMessage(message.conversationId, message.content, message)}
            onDiscard={discardMessage}
            onTypingStart={handleTypingStart}
            onTypingStop={handleTypingStop}
          />
        </div>
      </div>

      <Modal
        open={Boolean(deleteTarget)}
        title="Delete this message?"
        description="It will be removed from the conversation for both participants."
        size="sm"
        onClose={() => setDeleteTarget(null)}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="ghost" disabled={busy} onClick={() => setDeleteTarget(null)}>
              Keep message
            </Button>
            <Button variant="danger" loading={busy} onClick={confirmDelete}>
              Delete
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-sm leading-6 text-ink-600">This cannot be undone.</p>
          {actionError && <Alert variant="error">{actionError}</Alert>}
        </div>
      </Modal>
    </div>
  )
}
