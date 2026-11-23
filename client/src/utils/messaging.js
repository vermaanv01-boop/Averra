export function createClientMessageId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `web-${crypto.randomUUID()}`
  }
  return `web-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function senderId(message) {
  const sender = message?.sender
  return typeof sender === 'string' ? sender : sender?.id || ''
}

export function senderName(message) {
  const sender = message?.sender
  return typeof sender === 'object' && sender ? sender.name || sender.username || '' : ''
}

export function isOwnMessage(message, currentUserId) {
  return Boolean(currentUserId) && senderId(message) === currentUserId
}

export function sortMessages(messages) {
  return [...messages].sort((left, right) => {
    const leftTime = Date.parse(left.createdAt) || 0
    const rightTime = Date.parse(right.createdAt) || 0
    if (leftTime !== rightTime) return leftTime - rightTime
    return String(left.id || left.clientMessageId || '').localeCompare(
      String(right.id || right.clientMessageId || '')
    )
  })
}

export function upsertMessage(messages, incoming) {
  if (!incoming) return messages
  const byId = incoming.id
    ? messages.findIndex((message) => message.id === incoming.id)
    : -1
  const byClientId = incoming.clientMessageId
    ? messages.findIndex((message) => message.clientMessageId === incoming.clientMessageId)
    : -1
  const index = byId >= 0 ? byId : byClientId

  if (index < 0) return sortMessages([...messages, incoming])

  const next = [...messages]
  next[index] = { ...next[index], ...incoming }
  return sortMessages(next)
}

export function removeMessage(messages, id) {
  return messages.filter((message) => message.id !== id)
}

export function applyReadReceipt(messages, receipt) {
  const ids = new Set(receipt?.messageIds || [])
  const reader = receipt?.readBy
  if (ids.size === 0 || !reader) return messages

  return messages.map((message) => {
    if (!ids.has(message.id)) return message
    const readBy = Array.from(new Set([...(message.readBy || []), reader].filter(Boolean)))
    return { ...message, readBy }
  })
}

export function hasBeenReadByOther(message, currentUserId) {
  return (message?.readBy || []).some((id) => id && id !== currentUserId)
}

export function validateMessageContent(content) {
  const value = typeof content === 'string' ? content.trim() : ''
  if (!value) return { error: 'Message cannot be empty', content: '' }
  if (value.length > 4000) return { error: 'Messages must be 4000 characters or fewer', content: value }
  return { error: '', content: value }
}

export function getOtherParticipant(conversation, currentUserId) {
  return (conversation?.participants || []).find((person) => person?.id && person.id !== currentUserId) || null
}

export function conversationTitle(conversation, currentUserId) {
  return getOtherParticipant(conversation, currentUserId)?.name || 'Conversation'
}

export function lastMessagePreview(conversation) {
  const last = conversation?.lastMessage
  if (!last) return 'No messages yet'
  return last.content || 'Message deleted'
}

function parseDate(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatMessageTime(value) {
  const date = parseDate(value)
  if (!date) return ''
  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(date)
}

export function formatConversationTime(value) {
  const date = parseDate(value)
  if (!date) return ''
  const now = new Date()
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  if (sameDay) return formatMessageTime(value)
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date)
}
