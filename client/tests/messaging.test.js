import assert from 'node:assert/strict'
import test from 'node:test'
import {
  applyReadReceipt,
  conversationTitle,
  createClientMessageId,
  getOtherParticipant,
  hasBeenReadByOther,
  isOwnMessage,
  lastMessagePreview,
  removeMessage,
  senderId,
  senderName,
  sortMessages,
  upsertMessage,
  validateMessageContent
} from '../src/utils/messaging.js'

const OWNER = 'owner-id'
const FRIEND = 'friend-id'

function message(id, createdAt, overrides = {}) {
  return {
    id,
    conversationId: 'conversation-id',
    sender: { id: FRIEND, name: 'Friend' },
    content: `Message ${id}`,
    createdAt,
    ...overrides
  }
}

test('client message ids are unique and prefixed for optimistic messages', () => {
  const first = createClientMessageId()
  const second = createClientMessageId()
  assert.match(first, /^web-/)
  assert.notEqual(first, second)
})

test('sender helpers accept populated and string senders', () => {
  const populated = message('m1', '2026-01-01T00:00:00.000Z')
  assert.equal(senderId(populated), FRIEND)
  assert.equal(senderName(populated), 'Friend')
  assert.equal(senderId({ sender: OWNER }), OWNER)
  assert.equal(senderName({ sender: OWNER }), '')
  assert.equal(isOwnMessage(populated, FRIEND), true)
  assert.equal(isOwnMessage(populated, OWNER), false)
})

test('messages sort by creation time and then by stable identifier', () => {
  const messages = [
    message('b', '2026-01-02T00:00:00.000Z'),
    message('a', '2026-01-01T00:00:00.000Z'),
    message('c', '2026-01-01T00:00:00.000Z', { id: '', clientMessageId: 'client-c' })
  ]
  assert.deepEqual(
    sortMessages(messages).map((item) => item.id || item.clientMessageId),
    ['a', 'client-c', 'b']
  )
})

test('upsert replaces by server id and by client id without duplicating', () => {
  const existing = [
    message('m1', '2026-01-01T00:00:00.000Z', { clientMessageId: 'client-1', content: 'Old' })
  ]

  const byId = upsertMessage(existing, message('m1', '2026-01-01T00:00:00.000Z', { content: 'Updated' }))
  assert.equal(byId.length, 1)
  assert.equal(byId[0].content, 'Updated')

  const byClientId = upsertMessage(existing, message('', '2026-01-01T00:00:00.000Z', {
    clientMessageId: 'client-1',
    content: 'Saved'
  }))
  assert.equal(byClientId.length, 1)
  assert.equal(byClientId[0].content, 'Saved')

  const added = upsertMessage(existing, message('m2', '2026-01-02T00:00:00.000Z'))
  assert.equal(added.length, 2)
  assert.equal(added[1].id, 'm2')
})

test('removeMessage removes only the requested identifier', () => {
  const messages = [message('m1', '2026-01-01T00:00:00.000Z'), message('m2', '2026-01-02T00:00:00.000Z')]
  assert.deepEqual(removeMessage(messages, 'm1').map((item) => item.id), ['m2'])
})

test('read receipts append the reader once and ignore empty payloads', () => {
  const messages = [message('m1', '2026-01-01T00:00:00.000Z', { readBy: [FRIEND] })]
  const receipt = applyReadReceipt(messages, { messageIds: ['m1'], readBy: FRIEND })
  assert.deepEqual(receipt[0].readBy, [FRIEND])
  assert.equal(hasBeenReadByOther(receipt[0], OWNER), true)
  assert.equal(hasBeenReadByOther(receipt[0], FRIEND), false)
  assert.equal(applyReadReceipt(messages, { messageIds: [], readBy: FRIEND }), messages)
})

test('message content validation trims and enforces the backend limit', () => {
  assert.deepEqual(validateMessageContent('   '), { error: 'Message cannot be empty', content: '' })
  assert.deepEqual(validateMessageContent('  hello  '), { error: '', content: 'hello' })
  assert.match(validateMessageContent('a'.repeat(4001)).error, /4000/)
})

test('conversation helpers describe the other participant and last message', () => {
  const conversation = {
    participants: [
      { id: OWNER, name: 'Owner' },
      { id: FRIEND, name: 'Friend', username: 'friend' }
    ],
    lastMessage: { content: 'See you then', sender: FRIEND }
  }
  assert.equal(getOtherParticipant(conversation, OWNER)?.id, FRIEND)
  assert.equal(conversationTitle(conversation, OWNER), 'Friend')
  assert.equal(lastMessagePreview(conversation), 'See you then')
  assert.equal(lastMessagePreview({}), 'No messages yet')
  assert.equal(lastMessagePreview({ lastMessage: { content: '' } }), 'Message deleted')
})
